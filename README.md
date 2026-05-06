# Campus Notification System

A full-stack notification system for campus-wide announcements. Includes a React frontend, backend priority sorting logic, and a custom logging middleware.

## Project Structure

```
.
├── notification_app_fe/          # React frontend (Vite + MUI)
├── notification_app_be/          # Backend priority inbox logic
├── logging_middleware/           # Custom logger for evaluation service
├── notification_system_design.md # Full design document
└── payload.json                  # API credentials (gitignored)
```

## Quick Start

### Frontend

```bash
cd notification_app_fe
npm install
cp .env.example .env
# Fill in VITE_API_TOKEN in .env
npm run dev
```

Runs at `http://localhost:3000`.

### Backend

The backend logic is in `notification_app_be/priorityInbox.js`. It exports a `getPriorityInbox` function that sorts notifications by type weight and recency.

## Features

- Fetch notifications from a REST API
- Priority Inbox — sorts by Placement > Result > Event, then by timestamp
- Mark as read (persisted in localStorage)
- Type filtering and top-N selection
- Centralized logging to evaluation service

## Design

See [notification_system_design.md](./notification_system_design.md) for the full system design covering:
- API endpoints and real-time updates
- Database schema and indexing
- Query optimization
- Caching and pagination
- Message queues for reliability
- Priority inbox maintenance

## Tech Stack

- **Frontend:** React 19, Material-UI, Vite
- **Backend:** Node.js (priority sorting logic)
- **Logging:** Custom fetch-based logger
