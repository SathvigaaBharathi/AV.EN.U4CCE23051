# Notification System Design

Hey there! This is my design document for the campus notification system. I'll be going through the different stages below.

## Stage 1: API Endpoints

We need basic REST endpoints to fetch and read notifications.

**1. Fetch Notifications**
`GET /api/notifications`
Query params: `studentId` (who is asking), `status` (like 'unread' or 'all'), `limit`

**2. Mark as Read**
`PATCH /api/notifications/:id/read`
Body: maybe just `{ "isRead": true }`. Or even a POST to `/api/notifications/:id/mark-read`.

**Real-time updates:**
For real-time, we have two good options: WebSockets or Polling.
Polling is just the frontend asking the server every 5 seconds "hey, any new notifications?". It's super easy to write but can overload the server if 50k students do it.
WebSockets keep a continuous open line between the server and the browser. When the server gets a new notification, it just pushes it down the pipe instantly. I think WebSockets (like Socket.io) is better for a campus system so we don't spam our own servers with empty requests.

## Stage 2: Database Schema & Scaling

I think SQL (like PostgreSQL) is a safe bet here because the data is structured and we might need complex queries later.

**Simple Schema:**
`Notifications Table`
- `id` (Primary Key, UUID)
- `student_id` (Integer)
- `message` (Text)
- `type` (String - like 'Placement', 'Event')
- `is_read` (Boolean, default false)
- `created_at` (Timestamp)

**Fetching Unread Notifications (Queries):**
```sql
-- Just getting the unread ones for a specific student
SELECT * FROM notifications 
WHERE student_id = 1042 AND is_read = false 
ORDER BY created_at DESC 
LIMIT 20;

-- count unread for the badge on the UI
SELECT COUNT(*) FROM notifications 
WHERE student_id = 1042 AND is_read = false;
```

**Scaling (Indexing and Partitioning):**
If this gets huge, we need to index the `student_id` and `is_read` columns so the DB doesn't scan the whole table every time. Also, we could partition the table by date (like, one partition per month) because older notifications are rarely queried.

## Stage 3: Slow Query Analysis

The query `SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt ASC;` is slow.
Why? Because it's probably missing a composite index. The DB has to find all records for 1042, then filter the false ones, then sort them. 

**Optimized approach:**
We need to add a composite index on `(studentID, isRead, createdAt)`. This way the DB jumps straight to the unread notifications for that student, already sorted by time.

```sql
CREATE INDEX idx_student_unread ON notifications(studentID, isRead, createdAt);
```

**Why not index every column?**
If we index every single column, our reads will be fast, but our writes will be painfully slow. Every time we insert a new notification, the DB has to update all those indexes. This "write overhead" isn't worth it, especially for columns we rarely search by.

**Query: Students who got a Placement notification in the last 7 days**
Assuming PostgreSQL syntax:
```sql
SELECT DISTINCT studentID 
FROM notifications 
WHERE notificationType = 'Placement' 
  AND createdAt >= NOW() - INTERVAL '7 days';
```

## Stage 4: Performance Tweaks

To make it even faster, we can use Redis caching and Pagination.
- **Redis Cache:** When a student logs in, we can fetch their top 20 unread notifications and store them in Redis. Next time they open the menu, it loads from RAM instantly instead of hitting Postgres. We just need to invalidate the cache when they read one or get a new one.
- **Pagination:** Instead of sending all 500 unread notifications to the frontend at once, we use pagination (like `?limit=20&page=1`) so the UI loads fast and the DB does less work.

---

## Stage 5: Reliability & Message Queues

Currently, the `notify_all` function loops through 50,000 students synchronously. 

**The flaws:**
- It blocks the main thread. While it's looping, the server can't do anything else.
- If it fails at student 25,000 (maybe the email server times out), the loop crashes and the remaining 25k students don't get notified. There's no retry logic.

**Redesign with a Message Queue:**
We should decouple the database save and the email sending. Sending an email takes time and can fail. Saving to a DB is fast. We can use a queue like RabbitMQ or BullMQ.

The new flow:
1. Save the notification to the database for all 50k students (can be done in a quick batch insert).
2. Add 50k "send email" jobs to the message queue.
3. Background workers pull jobs from the queue and send the emails. If an email fails, the queue automatically retries it a few minutes later without affecting the rest.

**Revised Pseudocode:**

```javascript
// using something like BullMQ
import { emailQueue } from './queueSetup';

async function notify_all(message, type) {
    // 1. Batch insert into DB first (fast)
    const newNotifications = await db.notifications.batchInsert(50000_students, message);
    
    // 2. Add jobs to the queue
    for (let i = 0; i < 50000; i++) {
        // Just adding to the queue, not waiting for the email to actually send
        await emailQueue.add('sendEmailJob', {
            studentId: studentList[i].id,
            email: studentList[i].email,
            message: message
        }, {
            attempts: 3, // retry logic
            backoff: 5000 // wait 5s before retrying
        });
    }
    
    return { status: "processing in background" };
}

// In a separate worker file:
emailQueue.process(async (job) => {
    // This runs in the background
    await sendActualEmail(job.data.email, job.data.message);
});
```

By decoupling them, the user doesn't have to wait for 50k emails to send before getting a response, and we handle failures gracefully.

---

## Stage 6: Priority Inbox Maintenance

The Priority Inbox feature fetches notifications and sorts them by weight (Placement > Result > Event) and then by recency.

**How to maintain the top 10 efficiently as new notifications come in:**
Since we're building a real-time system, sorting the entire array of unread notifications every time a new websocket message arrives is inefficient.
Instead, we can use an approach similar to a **Min-Heap (Priority Queue)** or simply maintain a sorted array of size 10.
When a new notification arrives:
1. Calculate its weight.
2. Compare it against the lowest priority notification currently in our top 10 list (the one at index 9).
3. If the new notification has a higher weight (or equal weight but newer timestamp), we insert it into our sorted list at the correct position and pop off the last item so the list stays at size 10.
4. If it has a lower priority, we just ignore it for the top 10 view.
This makes the insertion operation `O(log n)` or `O(n)` for a small array of 10, instead of `O(N log N)` where N is all unread notifications.
