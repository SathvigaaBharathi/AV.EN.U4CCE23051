# Notification System Design

A design document for a campus-wide notification system covering API design, database schema, query optimization, caching, reliability, and priority inbox logic.

---

## Stage 1: API Endpoints

### REST Endpoints

**Fetch Notifications**
```
GET /api/notifications
```
Query params:
- `studentId` — which student is requesting
- `status` — `unread` or `all`
- `limit` — max results to return

**Mark as Read**
```
PATCH /api/notifications/:id/read
Body: { "isRead": true }
```

### Real-time Updates

Two options: polling or WebSockets.

Polling has the frontend ask the server every few seconds for new notifications. Simple to implement but generates a lot of empty requests at scale (50k students = 50k requests every 5 seconds).

WebSockets (e.g. Socket.io) keep a persistent connection open. The server pushes new notifications instantly when they arrive. Better for a campus-scale system since it eliminates unnecessary traffic.

---

## Stage 2: Database Schema & Scaling

SQL (PostgreSQL) is a good fit here — the data is structured and we may need complex queries later.

### Schema

**notifications**

| Column | Type | Notes |
|---|---|---|
| id | UUID | Primary Key |
| student_id | Integer | |
| message | Text | |
| type | String | `Placement`, `Result`, `Event` |
| is_read | Boolean | default `false` |
| created_at | Timestamp | |

### Useful Queries

```sql
-- Unread notifications for a student
SELECT * FROM notifications
WHERE student_id = $1 AND is_read = false
ORDER BY created_at DESC
LIMIT 20;

-- Unread count (for badge)
SELECT COUNT(*) FROM notifications
WHERE student_id = $1 AND is_read = false;
```

### Scaling

Index `student_id` and `is_read` so the DB doesn't full-scan on every request. Partition the table by month since older notifications are rarely queried.

---

## Stage 3: Slow Query Analysis

**Slow query:**
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

**Why it's slow:** No composite index. The DB scans all rows for student 1042, then filters unread ones, then sorts.

**Fix — add a composite index:**
```sql
CREATE INDEX idx_student_unread ON notifications(studentID, isRead, createdAt);
```

This lets the DB jump directly to unread notifications for a student, already in order.

**Why not index every column?**
Each index speeds up reads but slows down writes — every insert or update has to update all indexes. For columns we rarely filter on, the write overhead isn't worth it.

**Students who received a Placement notification in the last 7 days:**
```sql
SELECT DISTINCT studentID
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days';
```

---

## Stage 4: Performance Tweaks

### Redis Caching

On login, fetch the student's top 20 unread notifications and cache them in Redis. Subsequent requests load from memory instead of hitting Postgres. Invalidate the cache when a notification is read or a new one arrives.

### Pagination

Instead of returning all notifications at once, use `?limit=20&page=1`. Keeps response sizes small and reduces DB load.

---

## Stage 5: Reliability & Message Queues

### The Problem

The current `notify_all` function loops through 50,000 students synchronously:
- Blocks the main thread while looping
- If it crashes halfway (e.g. email server timeout), the remaining students never get notified
- No retry logic

### Redesign with a Message Queue

Decouple the DB write from the email send. Saving to DB is fast; sending email is slow and can fail.

**New flow:**
1. Batch insert the notification for all students into the DB (fast)
2. Add 50k "send email" jobs to a queue (BullMQ / RabbitMQ)
3. Background workers pull jobs and send emails. Failed jobs are retried automatically

```javascript
import { emailQueue } from './queueSetup';

async function notify_all(message, type) {
    // fast batch insert
    await db.notifications.batchInsert(studentList, message);

    // queue email jobs
    for (const student of studentList) {
        await emailQueue.add('sendEmail', {
            studentId: student.id,
            email: student.email,
            message
        }, {
            attempts: 3,
            backoff: 5000
        });
    }

    return { status: 'processing in background' };
}

// separate worker
emailQueue.process(async (job) => {
    await sendEmail(job.data.email, job.data.message);
});
```

The user gets an immediate response. Failures are retried without affecting other jobs.

---

## Stage 6: Priority Inbox

Notifications are sorted by type weight, then by recency:

| Type | Weight |
|---|---|
| Placement | 3 |
| Result | 2 |
| Event | 1 |
| Other | 0 |

### Efficient Top-10 Maintenance

Sorting the full unread list every time a new WebSocket message arrives is wasteful. Instead, maintain a sorted list of size 10:

1. Calculate the new notification's weight
2. Compare against the lowest-priority item currently in the top 10 (index 9)
3. If the new one ranks higher, insert it at the correct position and drop the last item
4. If it ranks lower, ignore it for the top 10 view

This keeps insertion at O(n) for a fixed-size array of 10, instead of O(N log N) over all unread notifications.

```javascript
function getPriorityInbox(notifications) {
    const unread = notifications.filter(n => !n.isRead);

    unread.sort((a, b) => {
        const wA = getWeight(a.type);
        const wB = getWeight(b.type);
        if (wA !== wB) return wB - wA;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return unread.slice(0, 10);
}

function getWeight(type) {
    return { Placement: 3, Result: 2, Event: 1 }[type] ?? 0;
}
```
