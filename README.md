# 🌊 EventFlow — Event & Attendee Management System

EventFlow is a full-stack web application for creating events, registering attendees, tracking capacity in real time, and managing event records from one responsive dashboard.

Built with plain HTML, CSS, Vanilla JavaScript, Node.js, Express, and SQLite—no frameworks or build tools required.

> Add screenshots or a demo GIF here for a stronger GitHub portfolio presentation.

## Features

- Create, edit, and delete events
- Register attendees with name, email, and ticket type
- Track live registration count, remaining seats, and capacity progress
- Event status badges: Upcoming, Today, Past, and Sold Out
- Search attendees by name, email, or event name
- Filter attendees by ticket type
- Pagination options: 10, 25, 50, or all records
- Single and bulk attendee deletion
- CSV attendee export
- Printable attendee passes
- Cascade-delete attendees when an event is deleted
- Dark/light theme toggle with saved preference
- Responsive layout down to 320px
- Animated WebGL2 hero gradient with CSS fallback

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | SQLite with better-sqlite3 |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Graphics | WebGL2, GLSL ES 3.00 |
| HTTP | REST API, Fetch API, JSON |
| Icons | Font Awesome 6 |
| Fonts | Google Fonts — Inter |
| Avatars | DiceBear API |
| Cover images | Unsplash |
| Development | Nodemon |
| Version control | Git and GitHub |

## Project Structure

```text
eventflow-manager/
├── public/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── images/
├── server/
│   └── index.js
├── data/
│   └── eventflow.db
├── package.json
├── README.md
└── .gitignore
```

## Prerequisites

- Node.js v18 or later
- npm
- A modern browser with WebGL2 support

Check your installation:

```bash
node -v
npm -v
```

Browsers without WebGL2 still work because EventFlow automatically uses a CSS animated-gradient fallback.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/eventflow-manager.git
cd eventflow-manager
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the application

For development mode:

```bash
npm run dev
```

For production-style mode:

```bash
npm start
```

Open the application at:

```text
http://localhost:3000
```

The SQLite database is created automatically on first launch. A sample event is seeded when the database is empty.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the server with Nodemon |
| `npm start` | Starts the server with Node.js |

## Main Workflow

1. Create an event with a name, date, venue, and capacity.
2. Register attendees for the event.
3. Monitor registrations and remaining seats from the dashboard.
4. Search, filter, paginate, export, or print attendee records.
5. Select multiple attendees to delete them in bulk.
6. Delete an event when required; associated attendees are removed automatically.

## REST API

Base URL:

```text
http://localhost:3000
```

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/events` | Get all events with registration details |
| `GET` | `/api/events/:id` | Get one event and its attendees |
| `POST` | `/api/events` | Create an event |
| `PUT` | `/api/events/:id` | Update an event |
| `DELETE` | `/api/events/:id` | Delete an event and its attendees |
| `GET` | `/api/attendees?q=&ticket=` | Get attendees with search/filter options |
| `POST` | `/api/events/:id/attendees` | Register an attendee |
| `DELETE` | `/api/attendees/:id` | Delete one attendee |
| `POST` | `/api/attendees/bulk-delete` | Delete selected attendees |

### Example: Create an Event

```json
POST /api/events

{
  "name": "EventFlow Demo Day",
  "date": "2026-12-15",
  "venue": "Main Auditorium",
  "capacity": 150
}
```

### Example: Register an Attendee

```json
POST /api/events/1/attendees

{
  "name": "Alex Johnson",
  "email": "alex@example.com",
  "ticket_type": "VIP"
}
```

## Validation Rules

EventFlow validates data on both the client and server.

- All required fields must be completed.
- Email addresses must be valid.
- An email can be registered only once for the same event.
- Registrations cannot exceed event capacity.
- Event capacity cannot be reduced below the existing registration count.
- Deleting an event automatically deletes all of its attendees.

A `409 Conflict` response is returned for duplicate registrations, full events, and invalid capacity reductions.

## Database Schema

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  date        TEXT NOT NULL,
  venue       TEXT NOT NULL,
  capacity    INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  ticket_type TEXT NOT NULL CHECK (ticket_type IN ('General','VIP','Student')),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE (event_id, email)
);
```

## Animated Hero Background

The dashboard hero section uses a real-time WebGL2 animated gradient with dark navy, blue, cyan, purple, and magenta tones.

The effect includes:

- Five-octave value-noise fBm
- Domain warping for fluid movement
- DPR-aware canvas resizing
- `requestAnimationFrame` rendering
- Automatic pause when the browser tab is hidden
- CSS fallback when WebGL2 is unavailable

## Manual Testing Checklist

| Test | Expected Result |
|---|---|
| Create an event with valid details | Event is created and shown in the dashboard |
| Create an event with missing values | Validation error appears |
| Register with a valid email | Attendee appears in the list |
| Register duplicate email for one event | Duplicate-registration error appears |
| Register for a full event | Fully-booked error appears |
| Search by name, email, or event | Matching records appear instantly |
| Filter by ticket type | Only matching attendees appear |
| Bulk delete attendees | Selected records are removed |
| Export CSV | Current filtered records download as CSV |
| Print attendee pass | Printable pass opens |
| Delete event | Event and its attendees are removed |
| Toggle theme | Preference remains after reload |

## Troubleshooting

| Problem | Solution |
|---|---|
| Port 3000 is already in use | Stop the other process or use `PORT=4000 npm run dev` |
| `better-sqlite3` installation fails | Confirm Node.js v18+ is installed |
| Hero gradient does not animate | Check browser WebGL2 support; the CSS fallback should still work |
| Database needs a fresh start | Stop the server, delete database files, and restart |
| Changes do not appear | Use a hard refresh: `Ctrl + Shift + R` or `Cmd + Shift + R` |

## Reset Database

Stop the server, then remove the SQLite database files:

```bash
rm data/eventflow.db data/eventflow.db-wal data/eventflow.db-shm
```

Start the server again:

```bash
npm run dev
```

## Future Improvements

- User authentication and role-based access
- Email confirmations and ticket delivery
- Event analytics dashboard
- QR-code attendee check-in
- Cloud database deployment
- Public event-registration page

## License

This project is licensed under the MIT License.

## Acknowledgements

- Font Awesome for icons
- Unsplash for event imagery
- DiceBear for avatars
- Google Fonts for the Inter font family

Made with 🌊 by EventFlow.
