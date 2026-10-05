/* =========================================================
   EventFlow — frontend logic
   ========================================================= */

const API = {
  events: "/api/events",
  attendees: "/api/attendees",
  register: (id) => `/api/events/${id}/attendees`,
  deleteAttendee: (id) => `/api/attendees/${id}`,
  deleteEvent: (id) => `/api/events/${id}`,
}

/* ---------- STATE ---------- */
const state = {
  events: [],
  attendees: [],
  query: "",
}

/* ---------- DOM ---------- */
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

const els = {
  statEvents: $("#stat-events"),
  statAttendees: $("#stat-attendees"),
  statSeats: $("#stat-seats"),
  statOccupancy: $("#stat-occupancy"),
  eventGrid: $("#event-grid"),
  eventEmpty: $("#event-empty"),
  attendeeTbody: $("#attendee-tbody"),
  attendeeEmpty: $("#attendee-empty"),
  searchInput: $("#search-input"),
  clearSearch: $("#clear-search"),
  eventModal: $("#event-modal"),
  attendeeModal: $("#attendee-modal"),
  eventForm: $("#event-form"),
  attendeeForm: $("#attendee-form"),
  eventSelect: $("#attendee-event"),
  toastContainer: $("#toast-container"),
}

/* =========================================================
   TOASTS
   ========================================================= */
function toast(message, type = "info") {
  const icons = {
    success: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    info: "fa-solid fa-circle-info",
  }
  const el = document.createElement("div")
  el.className = `toast ${type}`
  el.innerHTML = `<i class="${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`
  els.toastContainer.appendChild(el)

  setTimeout(() => {
    el.classList.add("removing")
    setTimeout(() => el.remove(), 300)
  }, 3600)
}

/* =========================================================
   HELPERS
   ========================================================= */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[s]))
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?"
}

function formatDate(dateStr) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

/* Curated Unsplash image URLs (verified stable) */
const EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=70",
  "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=70",
]
function imageForEvent(event) {
  const seed = (event.id || 0) + (event.name?.length || 0)
  return EVENT_IMAGES[seed % EVENT_IMAGES.length]
}

/* =========================================================
   MODALS
   ========================================================= */
function openModal(modal) {
  modal.classList.add("open")
  modal.setAttribute("aria-hidden", "false")
  document.body.style.overflow = "hidden"
}
function closeModal(modal) {
  modal.classList.remove("open")
  modal.setAttribute("aria-hidden", "true")
  document.body.style.overflow = ""
}
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-close]")
  if (!target) return
  const modal = target.closest(".modal")
  if (modal) closeModal(modal)
})
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $$(".modal.open").forEach(closeModal)
  }
})

/* =========================================================
   RENDER — STATS
   ========================================================= */
function renderStats() {
  const totalEvents = state.events.length
  const totalAttendees = state.attendees.length
  const totalCapacity = state.events.reduce((s, e) => s + (e.capacity || 0), 0)
  const totalRegistered = state.events.reduce((s, e) => s + (e.registered || 0), 0)
  const seatsRemaining = Math.max(0, totalCapacity - totalRegistered)
  const occupancy = totalCapacity ? Math.round((totalRegistered / totalCapacity) * 100) : 0

  els.statEvents.textContent = totalEvents
  els.statAttendees.textContent = totalAttendees
  els.statSeats.textContent = seatsRemaining
  els.statOccupancy.textContent = `${occupancy}%`
}

/* =========================================================
   RENDER — EVENTS
   ========================================================= */
function renderEvents() {
  const list = state.events
  if (!list.length) {
    els.eventGrid.innerHTML = ""
    els.eventEmpty.classList.remove("hidden")
    return
  }
  els.eventEmpty.classList.add("hidden")

  els.eventGrid.innerHTML = list.map((ev) => {
    const registered = ev.registered || 0
    const capacity = ev.capacity || 0
    const remaining = Math.max(0, capacity - registered)
    const pct = capacity ? Math.min(100, Math.round((registered / capacity) * 100)) : 0
    const barClass = remaining === 0 ? "full" : pct >= 80 ? "warn" : ""
    const isFull = remaining === 0
    const img = imageForEvent(ev)

    return `
      <article class="event-card glass" data-id="${ev.id}">
        <div class="event-media" style="background-image:url('${img}')">
          <span class="event-tag ${isFull ? "full" : ""}">
            <i class="fa-solid ${isFull ? "fa-lock" : "fa-bolt"}"></i>
            ${isFull ? "Full" : `${remaining} seat${remaining === 1 ? "" : "s"} left`}
          </span>
        </div>
        <div class="event-body">
          <h3 class="event-title">${escapeHtml(ev.name)}</h3>
          <div class="event-meta">
            <span class="meta-row"><i class="fa-solid fa-calendar"></i> ${escapeHtml(formatDate(ev.date))}</span>
            <span class="meta-row"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(ev.venue)}</span>
          </div>

          <div class="progress">
            <div class="progress-bar ${barClass}" style="width:${pct}%"></div>
          </div>
          <div class="progress-meta">
            <span><strong>${registered}</strong> / ${capacity} registered</span>
            <span>${pct}% full</span>
          </div>

          <div class="event-actions">
            <button class="btn btn-primary" data-action="register" data-id="${ev.id}" ${isFull ? "disabled" : ""}>
              <i class="fa-solid fa-user-plus"></i> ${isFull ? "Full" : "Register"}
            </button>
            <button class="btn btn-danger-ghost" data-action="delete-event" data-id="${ev.id}" title="Delete event">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      </article>
    `
  }).join("")
}

/* =========================================================
   RENDER — ATTENDEES
   ========================================================= */
function renderAttendees() {
  const list = state.attendees
  if (!list.length) {
    els.attendeeTbody.innerHTML = ""
    els.attendeeEmpty.classList.remove("hidden")
    return
  }
  els.attendeeEmpty.classList.add("hidden")

  els.attendeeTbody.innerHTML = list.map((a) => `
    <tr>
      <td>
        <div class="att-cell">
          <span class="avatar">${escapeHtml(initials(a.name))}</span>
          <div>
            <div class="att-name">${escapeHtml(a.name)}</div>
            <div class="att-id">#${a.id}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(a.email)}</td>
      <td><span class="ticket ${escapeHtml(a.ticket_type)}">${escapeHtml(a.ticket_type)}</span></td>
      <td>${escapeHtml(a.event_name || "—")}</td>
      <td>${escapeHtml(formatDate(a.event_date))}</td>
      <td class="text-right">
        <button class="btn btn-danger-ghost" data-action="delete-attendee" data-id="${a.id}" title="Remove attendee">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("")
}

/* =========================================================
   RENDER — EVENT SELECT (for attendee modal)
   ========================================================= */
function renderEventSelect() {
  const select = els.eventSelect
  const previous = select.value

  if (!state.events.length) {
    select.innerHTML = `<option value="">No events available</option>`
    return
  }

  select.innerHTML = state.events.map((ev) => {
    const remaining = Math.max(0, (ev.capacity || 0) - (ev.registered || 0))
    const disabled = remaining === 0 ? "disabled" : ""
    const label = `${ev.name} — ${formatDate(ev.date)} ${remaining === 0 ? "(FULL)" : `(${remaining} left)`}`
    return `<option value="${ev.id}" ${disabled}>${escapeHtml(label)}</option>`
  }).join("")

  // try to restore selection if valid & enabled
  if (previous) {
    const opt = select.querySelector(`option[value="${previous}"]`)
    if (opt && !opt.disabled) select.value = previous
  }
}

/* =========================================================
   DATA LOADING
   ========================================================= */
async function loadEvents() {
  try {
    state.events = await apiFetch(API.events)
    renderEvents()
    renderEventSelect()
    renderStats()
  } catch (err) {
    toast(err.message, "error")
  }
}

async function loadAttendees() {
  try {
    const url = state.query
      ? `${API.attendees}?q=${encodeURIComponent(state.query)}`
      : API.attendees
    state.attendees = await apiFetch(url)
    renderAttendees()
    renderStats()
  } catch (err) {
    toast(err.message, "error")
  }
}

async function refreshAll() {
  await Promise.all([loadEvents(), loadAttendees()])
}

/* =========================================================
   EVENT FORM — SUBMIT
   ========================================================= */
els.eventForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  const name = $("#event-name").value.trim()
  const date = $("#event-date").value
  const venue = $("#event-venue").value.trim()
  const capacity = Number($("#event-capacity").value)

  // client-side validation
  let ok = true
  const setInvalid = (el, cond) => { el.classList.toggle("invalid", cond); if (cond) ok = false }
  setInvalid($("#event-name"), !name)
  setInvalid($("#event-date"), !date)
  setInvalid($("#event-venue"), !venue)
  setInvalid($("#event-capacity"), !Number.isFinite(capacity) || capacity < 1)

  if (!ok) return toast("Please fill in all fields with valid values.", "error")

  const submitBtn = els.eventForm.querySelector('button[type="submit"]')
  submitBtn.disabled = true
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating...`

  try {
    await apiFetch(API.events, {
      method: "POST",
      body: JSON.stringify({ name, date, venue, capacity }),
    })
    toast("Event created successfully.", "success")
    els.eventForm.reset()
    $("#event-capacity").value = 100
    closeModal(els.eventModal)
    await refreshAll()
  } catch (err) {
    toast(err.message, "error")
  } finally {
    submitBtn.disabled = false
    submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Create Event`
  }
})

/* =========================================================
   ATTENDEE FORM — SUBMIT
   ========================================================= */
els.attendeeForm.addEventListener("submit", async (e) => {
  e.preventDefault()
  const event_id = Number(els.eventSelect.value)
  const name = $("#attendee-name").value.trim()
  const email = $("#attendee-email").value.trim()
  const ticket_type = $("#attendee-ticket").value

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  let ok = true
  const setInvalid = (el, cond) => { el.classList.toggle("invalid", cond); if (cond) ok = false }
  setInvalid(els.eventSelect, !event_id)
  setInvalid($("#attendee-name"), !name)
  setInvalid($("#attendee-email"), !EMAIL_RE.test(email))

  if (!ok) return toast("Please complete the form with a valid email address.", "error")

  const submitBtn = els.attendeeForm.querySelector('button[type="submit"]')
  submitBtn.disabled = true
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Registering...`

  try {
    await apiFetch(API.register(event_id), {
      method: "POST",
      body: JSON.stringify({ name, email, ticket_type }),
    })
    toast("Attendee registered successfully.", "success")
    els.attendeeForm.reset()
    closeModal(els.attendeeModal)
    await refreshAll()
  } catch (err) {
    toast(err.message, "error")
  } finally {
    submitBtn.disabled = false
    submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Register`
  }
})

/* =========================================================
   ACTION BUTTONS (event delegation)
   ========================================================= */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]")
  if (!btn) return

  const action = btn.dataset.action
  const id = Number(btn.dataset.id)

  // OPEN REGISTER MODAL PREFILLED
  if (action === "register") {
    await loadEvents()          // ensure fresh list
    renderEventSelect()
    els.eventSelect.value = String(id)
    openModal(els.attendeeModal)
    return
  }

  // DELETE EVENT
  if (action === "delete-event") {
    const ev = state.events.find((x) => x.id === id)
    if (!ev) return
    if (!confirm(`Delete "${ev.name}"?\nAll ${ev.registered || 0} attendee(s) will be removed too.`)) return
    try {
      await apiFetch(API.deleteEvent(id), { method: "DELETE" })
      toast("Event deleted.", "success")
      await refreshAll()
    } catch (err) {
      toast(err.message, "error")
    }
    return
  }

  // DELETE ATTENDEE
  if (action === "delete-attendee") {
    const a = state.attendees.find((x) => x.id === id)
    if (!a) return
    if (!confirm(`Remove attendee "${a.name}" from "${a.event_name}"?`)) return
    try {
      await apiFetch(API.deleteAttendee(id), { method: "DELETE" })
      toast("Attendee removed.", "success")
      await refreshAll()
    } catch (err) {
      toast(err.message, "error")
    }
  }
})

/* =========================================================
   SEARCH — debounced
   ========================================================= */
let searchTimer = null
els.searchInput.addEventListener("input", (e) => {
  state.query = e.target.value.trim()
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadAttendees, 220)
})
els.clearSearch.addEventListener("click", () => {
  els.searchInput.value = ""
  state.query = ""
  loadAttendees()
})

/* =========================================================
   OPEN MODAL BUTTONS
   ========================================================= */
const openEventModal = () => {
  els.eventForm.reset()
  $("#event-capacity").value = 100
  els.eventForm.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"))
  openModal(els.eventModal)
}
const openAttendeeModal = async () => {
  await loadEvents()
  if (!state.events.length) {
    toast("Create an event first.", "info")
    return openEventModal()
  }
  els.attendeeForm.reset()
  els.attendeeForm.querySelectorAll(".invalid").forEach(el => el.classList.remove("invalid"))
  renderEventSelect()
  openModal(els.attendeeModal)
}

$("#open-event-modal").addEventListener("click", openEventModal)
$("#hero-new-event").addEventListener("click", openEventModal)
$("#section-new-event").addEventListener("click", openEventModal)
$("#hero-new-attendee").addEventListener("click", openAttendeeModal)
$("#section-new-attendee").addEventListener("click", openAttendeeModal)

/* Clear invalid state on input */
["#event-name", "#event-date", "#event-venue", "#event-capacity"].forEach((sel) => {
  const el = $(sel)
  el.addEventListener("input", () => el.classList.remove("invalid"))
})
["#attendee-name", "#attendee-email", "#attendee-ticket"].forEach((sel) => {
  const el = $(sel)
  el.addEventListener("input", () => el.classList.remove("invalid"))
  el.addEventListener("change", () => el.classList.remove("invalid"))
})

/* =========================================================
   BOOT
   ========================================================= */
;(async function init() {
  await refreshAll()

  // Seed with a sample event if DB empty — helps demo
  if (!state.events.length) {
    try {
      await apiFetch(API.events, {
        method: "POST",
        body: JSON.stringify({
          name: "Tech Summit 2025",
          date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
          venue: "Convention Center, Mumbai",
          capacity: 150,
        }),
      })
      await refreshAll()
    } catch (_) { /* ignore */ }
  }
})()
/* =========================================================
   WebGL2 animated gradient background
   ========================================================= */
/* =========================================================
   Visible animated WebGL2 background
   ========================================================= */
(function () {
  const canvas = document.getElementById("gradient-canvas");

  if (!canvas) return;

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    powerPreference: "high-performance"
  });

  if (!gl) {
    document.body.classList.add("no-webgl");
    return;
  }

  const vertexSource = `#version 300 es
    in vec2 position;
    out vec2 uv;

    void main() {
      uv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `#version 300 es
    precision highp float;

    uniform float time;
    uniform vec2 resolution;

    in vec2 uv;
    out vec4 outputColor;

    void main() {
      vec2 p = uv - 0.5;
      p.x *= resolution.x / resolution.y;

      float t = time * 0.35;

      float wave1 = sin(p.x * 4.0 + t + sin(p.y * 3.0 - t)) * 0.5 + 0.5;
      float wave2 = sin(p.y * 5.0 - t * 1.2 + cos(p.x * 4.0 + t)) * 0.5 + 0.5;

      float swirl = sin(
        length(p) * 10.0
        - t * 2.0
        + atan(p.y, p.x) * 3.0
      ) * 0.5 + 0.5;

      vec3 black = vec3(0.008, 0.012, 0.03);
      vec3 blue = vec3(0.02, 0.18, 0.95);
      vec3 cyan = vec3(0.0, 0.85, 1.0);
      vec3 purple = vec3(0.42, 0.08, 0.92);
      vec3 pink = vec3(1.0, 0.03, 0.58);

      vec3 color = black;
      color += blue * wave1 * 0.80;
      color += cyan * wave2 * 0.42;
      color += purple * swirl * 0.52;
      color += pink * (wave1 * wave2) * 0.20;

      float vignette = smoothstep(1.2, 0.2, length(p));
      color *= vignette;

      outputColor = vec4(color, 1.0);
    }
  `;

  function makeShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("WebGL shader error:", gl.getShaderInfoLog(shader));
      return null;
    }

    return shader;
  }

  const vertexShader = makeShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = makeShader(gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) {
    document.body.classList.add("no-webgl");
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("WebGL program error:", gl.getProgramInfoLog(program));
    document.body.classList.add("no-webgl");
    return;
  }

  gl.useProgram(program);

  const vertices = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const timeUniform = gl.getUniformLocation(program, "time");
  const resolutionUniform = gl.getUniformLocation(program, "resolution");

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolutionUniform, width, height);
    }
  }

  function animate(now) {
    resize();
    gl.uniform1f(timeUniform, now * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize, { passive: true });
  requestAnimationFrame(animate);
})();
/* =========================================================
   Footer helpers
   ========================================================= */
(function initFooter() {
  // 1) Auto-updating copyright year
  const yearEl = document.getElementById("footer-year")
  if (yearEl) yearEl.textContent = new Date().getFullYear()

  // 2) Footer "Create Event" / "Register Attendee" shortcuts
  //    Reuse the existing modal opener buttons so no new logic is added.
  document.querySelectorAll("[data-footer-open]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault()
      const which = link.getAttribute("data-footer-open")
      const triggerId = which === "event" ? "open-event-modal" : "section-new-attendee"
      const trigger = document.getElementById(triggerId)
      if (trigger) {
        trigger.click()
      } else {
        // Fallback: scroll to the relevant section
        const target = which === "event" ? "#events" : "#attendees"
        document.querySelector(target)?.scrollIntoView({ behavior: "smooth" })
      }
    })
  })

  // 3) Documentation / Support — no-op with a friendly toast
  //    Reuses your existing `toast()` function if available.
  const docs = document.getElementById("footer-docs")
  if (docs) {
    docs.addEventListener("click", (e) => {
      e.preventDefault()
      if (typeof toast === "function") toast("Documentation coming soon.", "info")
    })
  }
  const support = document.getElementById("footer-support")
  if (support) {
    support.addEventListener("click", (e) => {
      e.preventDefault()
      if (typeof toast === "function") toast("Support: hello@eventflow.dev", "info")
    })
  }
})()