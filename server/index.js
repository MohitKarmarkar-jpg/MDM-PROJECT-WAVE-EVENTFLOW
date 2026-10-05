const path = require("path")
const fs = require("fs")
const express = require("express")
const cors = require("cors")
const Database = require("better-sqlite3")

/* ---------- DATABASE ---------- */
const DATA_DIR = path.join(__dirname, "..", "data")
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, "eventflow.db"))
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    venue TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 100 CHECK (capacity > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    ticket_type TEXT NOT NULL CHECK (ticket_type IN ('General','VIP','Student')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE(event_id, email)
  );

  CREATE INDEX IF NOT EXISTS idx_attendees_event ON attendees(event_id);
  CREATE INDEX IF NOT EXISTS idx_attendees_email ON attendees(email);
`)

/* ---------- APP ---------- */
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "..", "public")))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ---------- HELPERS ---------- */
function eventWithStats(row) {
  if (!row) return row
  return {
    ...row,
    registered: row.registered ?? 0,
    seats_remaining: Math.max(0, row.capacity - (row.registered ?? 0)),
  }
}

/* ---------- EVENTS ---------- */

// GET /api/events — list all events with stats
app.get("/api/events", (req, res) => {
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id) AS registered
    FROM events e
    ORDER BY e.date ASC, e.id ASC
  `).all()
  res.json(rows.map(eventWithStats))
})

// POST /api/events — create a new event
app.post("/api/events", (req, res) => {
  const { name, date, venue, capacity } = req.body || {}

  if (!name || !String(name).trim())
    return res.status(400).json({ error: "Event name is required." })
  if (!date)
    return res.status(400).json({ error: "Event date is required." })
  if (!venue || !String(venue).trim())
    return res.status(400).json({ error: "Event venue is required." })

  const cap = Number(capacity)
  if (!Number.isFinite(cap) || cap < 1)
    return res.status(400).json({ error: "Capacity must be a positive number." })

  try {
    const info = db.prepare(
      "INSERT INTO events (name, date, venue, capacity) VALUES (?, ?, ?, ?)"
    ).run(String(name).trim(), date, String(venue).trim(), Math.floor(cap))

    const row = db.prepare(`
      SELECT e.*,
        (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id) AS registered
      FROM events e WHERE e.id = ?
    `).get(info.lastInsertRowid)

    res.status(201).json(eventWithStats(row))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to create event." })
  }
})

// DELETE /api/events/:id — delete event + cascades attendees
app.delete("/api/events/:id", (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "Invalid event id." })

  const exists = db.prepare("SELECT id FROM events WHERE id = ?").get(id)
  if (!exists) return res.status(404).json({ error: "Event not found." })

  db.prepare("DELETE FROM events WHERE id = ?").run(id)
  res.status(204).end()
})

/* ---------- ATTENDEES ---------- */

// GET /api/attendees?q= — list attendees, optional search
app.get("/api/attendees", (req, res) => {
  const q = (req.query.q || "").toString().trim()
  const params = []
  let sql = `
    SELECT a.*, e.name AS event_name, e.date AS event_date, e.venue AS event_venue
    FROM attendees a
    JOIN events e ON e.id = a.event_id
  `
  if (q) {
    sql += " WHERE a.name LIKE ? OR a.email LIKE ? OR e.name LIKE ?"
    const t = `%${q}%`
    params.push(t, t, t)
  }
  sql += " ORDER BY a.created_at DESC, a.id DESC"

  res.json(db.prepare(sql).all(...params))
})

// POST /api/events/:id/attendees — register attendee for event
app.post("/api/events/:id/attendees", (req, res) => {
  const eventId = Number(req.params.id)
  if (!Number.isInteger(eventId))
    return res.status(400).json({ error: "Invalid event id." })

  const { name, email, ticket_type } = req.body || {}

  if (!name || !String(name).trim())
    return res.status(400).json({ error: "Full name is required." })
  if (!email || !EMAIL_RE.test(String(email).trim()))
    return res.status(400).json({ error: "A valid email address is required." })
  if (!["General", "VIP", "Student"].includes(ticket_type))
    return res.status(400).json({ error: "Ticket type must be General, VIP, or Student." })

  const event = db.prepare("SELECT * FROM events WHERE id = ?").get(eventId)
  if (!event) return res.status(404).json({ error: "Event not found." })

  const count = db.prepare(
    "SELECT COUNT(*) AS c FROM attendees WHERE event_id = ?"
  ).get(eventId).c
  if (count >= event.capacity)
    return res.status(409).json({ error: "This event is fully booked." })

  const normalizedEmail = String(email).trim().toLowerCase()
  const dup = db.prepare(
    "SELECT id FROM attendees WHERE event_id = ? AND email = ?"
  ).get(eventId, normalizedEmail)
  if (dup)
    return res.status(409).json({
      error: "This email is already registered for this event.",
    })

  try {
    const info = db.prepare(
      "INSERT INTO attendees (event_id, name, email, ticket_type) VALUES (?, ?, ?, ?)"
    ).run(eventId, String(name).trim(), normalizedEmail, ticket_type)

    const row = db.prepare(`
      SELECT a.*, e.name AS event_name, e.date AS event_date, e.venue AS event_venue
      FROM attendees a JOIN events e ON e.id = a.event_id
      WHERE a.id = ?
    `).get(info.lastInsertRowid)

    res.status(201).json(row)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to register attendee." })
  }
})

// DELETE /api/attendees/:id
app.delete("/api/attendees/:id", (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id))
    return res.status(400).json({ error: "Invalid attendee id." })

  const exists = db.prepare("SELECT id FROM attendees WHERE id = ?").get(id)
  if (!exists) return res.status(404).json({ error: "Attendee not found." })

  db.prepare("DELETE FROM attendees WHERE id = ?").run(id)
  res.status(204).end()
})

/* ---------- FALLBACK ---------- */
/* ---------- FALLBACK ---------- */
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"))
})

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`🌊  EventFlow running at http://localhost:${PORT}`)
})