# SmartFlow Booking System — Design Spec
**Date:** 2026-05-26
**Project:** SmartFlow Automation Landing Page
**Feature:** Book a Free Call — Animated Popup + Full Booking System
**Workflow ID:** SMARTFLOW-BK1

---

## 1. Overview

Replace all "Book a Free Call" `mailto:` links on the SmartFlow static website with an animated modal popup that lets prospects book a confirmed 30-minute strategy call. n8n handles all backend logic — slot availability, conflict prevention, and both outbound emails. No external calendar service, no Google Sheets, no framework.

---

## 2. Requirements

| Requirement | Value |
|---|---|
| Call duration | 30 minutes |
| Available days | Monday to Friday only |
| Available hours | 9:00 AM to 4:30 PM AWST (UTC+8) |
| Slots per day | 16 (9:00, 9:30, 10:00 … 4:30) |
| Booking window | Up to 60 days from today |
| Minimum notice | 1 hour from current time (AWST) |
| Double-booking prevention | Yes — via n8n Data table, re-validated on submit |
| Owner notification email | ambrosevoon@gmail.com |
| Booking fields | Full Name, Email, Phone, Agency/Company, Message (optional) |

---

## 3. Architecture

```
[SmartFlow Static Site]
        │
        ├─ Popup opens
        │     └─ GET /webhook/smartflow-get-booked-slots
        │               └─ n8n reads "smartflow_bookings" Data table
        │                   returns { "booked": ["2026-06-02_09:00", ...] }
        │
        │  Frontend generates all Mon–Fri slots in 60-day window,
        │  removes booked ones and slots within 1hr, renders picker
        │
        └─ User submits slot + details
              └─ POST /webhook/smartflow-book-slot
                        ├─ Validate fields + slot format + business hours + notice period
                        ├─ Re-check slot in Data table
                        ├─ IF taken → 409 { "error": "slot_taken" }
                        └─ IF free →
                              ├─ Create record in "smartflow_bookings"
                              ├─ Gmail: confirmation email to customer
                              ├─ Gmail: notification email to ambrosevoon@gmail.com
                              └─ 200 { "success": true, "slot_id": "...", "date": "...", "time": "..." }
```

---

## 4. Slot ID Format

`YYYY-MM-DD_HH:MM` (24-hour, AWST) — e.g. `2026-06-02_09:00`

Used as the unique conflict-detection key. Both endpoints use this format.

---

## 5. n8n Workflow: SMARTFLOW-BK1

**Workflow name:** `SMARTFLOW-BK1 — SmartFlow Booking System`
**n8n instance:** `https://n8n.srv823907.hstgr.cloud`

### 5.1 Data Table: `smartflow_bookings`

| Field | Type | Description |
|---|---|---|
| `slot_id` | String | `YYYY-MM-DD_HH:MM` — unique booking key |
| `date` | String | Human-readable date e.g. `Tuesday, 2 June 2026` |
| `time` | String | Human-readable time e.g. `9:00 AM` |
| `name` | String | Customer full name |
| `email` | String | Customer email |
| `phone` | String | Customer phone |
| `agency` | String | Agency / company name |
| `message` | String | Optional message |
| `booked_at` | String | ISO timestamp of when booking was made |

### 5.2 Branch 1 — Get Booked Slots

**Trigger:** `GET /webhook/smartflow-get-booked-slots`

```
Webhook (GET, CORS: *)
  → n8n Data: List all records from "smartflow_bookings"
  → Code: extract slot_id values into flat array
  → Respond: 200 { "booked": ["slot_id", ...] }
```

Response headers must include `Access-Control-Allow-Origin: *` so the static site browser can call it.

### 5.3 Branch 2 — Book a Slot

**Trigger:** `POST /webhook/smartflow-book-slot`

**Request body:**
```json
{
  "slot_id": "2026-06-02_09:00",
  "date": "Tuesday, 2 June 2026",
  "time": "9:00 AM",
  "name": "Jane Smith",
  "email": "jane@premierrealty.com.au",
  "phone": "0412 345 678",
  "agency": "Premier Realty",
  "message": "Looking to automate our lead follow-up"
}
```

**Validation (Code node):**
- All fields except `message` are required
- `slot_id` matches format `YYYY-MM-DD_HH:MM`
- Day of week is Monday–Friday
- Time is between `09:00` and `16:30`
- Slot datetime is at least 1 hour from now (AWST, UTC+8)
- Email is valid format

**Flow:**
```
Webhook (POST)
  → Code: validate fields (return 400 on failure)
  → n8n Data: Find record WHERE slot_id = submitted slot_id
  → IF exists → Respond 409 { "error": "slot_taken" }
  → IF not exists →
      → n8n Data: Create record (all fields + booked_at = now ISO)
      → Gmail: Send customer confirmation email
      → Gmail: Send owner notification email
      → Respond 200 { "success": true, "slot_id": "...", "date": "...", "time": "..." }
```

### 5.4 Customer Confirmation Email

**To:** customer email
**Subject:** `Your SmartFlow Strategy Call is Confirmed`
**Body:**
- Greeting with their first name
- Confirmed date and time in AWST (bold)
- What to expect: 30-minute call, discuss their agency's automation needs
- "Add to calendar" note (manual — no .ics attachment at this stage)
- Contact email if they need to reschedule: `hello@smartflowautomation.com`
- SmartFlow branding footer

### 5.5 Owner Notification Email

**To:** `ambrosevoon@gmail.com`
**Subject:** `[SMARTFLOW-BK1] New Booking — {name} · {date} {time}`
**Body:** clean table of all submitted fields — name, email, phone, agency, message, slot_id, booked_at

---

## 6. Frontend: Files Changed

Only the three existing files are modified. No new files, no framework, no build step.

| File | Changes |
|---|---|
| `index.html` | Add modal HTML block before `</body>`. Update all "Book a Free Call" `href="#contact"` buttons to `class="book-btn"` (JS-triggered). |
| `styles.css` | Append all modal + animation CSS. No existing rules touched. |
| `script.js` | Append booking module (IIFE). No existing code touched. |

---

## 7. Frontend: Popup UX Flow

### Step 1 — Date Picker
- Month calendar grid (Mon–Sun columns)
- Available days: white card, blue hover, blue selected with `scale(1.06)` pop
- Greyed/disabled: past days, weekends, days > 60 days out, and fully-booked days. A day is "fully booked" when every eligible slot for that day (i.e. every slot that passes the 1-hour minimum notice check) appears in the booked array returned by the GET endpoint.
- Today: blue dot under date number
- Month navigation: prev/next arrows, slide transition between months
- Clicking an available day auto-advances to Step 2

### Step 2 — Time Slot Picker
- 4-column pill grid of available 30-min slots for selected day
- Slots cascade in with staggered `opacity + translateY` animation (`30ms` delay per pill)
- Booked and ineligible slots are hidden entirely
- If all slots taken: "No slots available for this day — please choose another"
- Selecting a slot auto-advances to Step 3
- "← Back" returns to Step 1

### Step 3 — Contact Details
- Summary chip at top: `📅 Tuesday 2 June · 9:00 AM AWST` + "Edit" link back to Step 1
- Fields: Full Name, Email, Phone, Agency/Company, Message (optional)
- Floating label inputs — label animates up on focus
- Submit button: "Confirm Booking" — shows spinner while POST is in flight
- On 409: inline error banner "That slot was just taken — please pick another time", jumps to Step 1
- On 400: inline field errors
- On network error: "Something went wrong — please try again"

### Success Screen
- Animated SVG circle draws in (`stroke-dashoffset`), checkmark draws inside
- "You're booked in!" bounces up
- Confirmation details (name, date, time) fade in line by line
- Confetti burst: 12 small coloured dots scatter from checkmark centre
- "Close" button

---

## 8. Animations Summary

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Backdrop in | `opacity 0→1` | 200ms | ease |
| Modal card in | `scale(0.92)+translateY(32px) → scale(1)+translateY(0)` | 320ms | `cubic-bezier(0.34,1.56,0.64,1)` spring |
| Header content | `opacity+translateY` stagger | 240ms | ease-out |
| Body content | `opacity` fade | 200ms | ease |
| Progress bar | `width` fill per step | 400ms | ease |
| Step advance | slide left out + right in | 180ms / 220ms | ease-out |
| Step back | slide right out + left in | 180ms / 220ms | ease-out |
| Calendar day hover | `translateY(-2px)` + border | 180ms | ease |
| Calendar day select | `scale(1.06)` pop | 200ms | spring |
| Month change | slide left/right | 220ms | ease-out |
| Time slots cascade | `opacity+translateY` stagger 30ms/pill | 200ms | ease-out |
| Time slot select | `scale(1.05)` bounce | 200ms | spring |
| Button shimmer | gloss sweep left→right | 600ms | ease-in-out |
| Success circle draw | `stroke-dashoffset` | 400ms | ease-out |
| Checkmark draw | `stroke-dashoffset` | 300ms | ease-out |
| "You're booked" bounce | `translateY(10px→0)+opacity` | 280ms | spring |
| Confetti burst | scatter + fade | 600ms | ease-out |
| Modal close | reverse entrance | 180ms | ease-in |
| Mobile slide-up | `translateY(100%→0)` | 320ms | spring |

---

## 9. Mobile Behaviour (below 520px)

- Full-screen bottom sheet — `border-radius: 20px 20px 0 0`, flush to screen bottom
- Entrance: slides up from `translateY(100%)`, spring easing
- Drag handle bar at top of sheet (decorative)
- Touch swipe-down gesture to dismiss
- Calendar columns compress, time slots go to 2-column grid

---

## 10. CORS & Security

- GET endpoint: `Access-Control-Allow-Origin: *` (public read of slot availability is not sensitive)
- POST endpoint: `Access-Control-Allow-Origin: https://smartflow-automation.vercel.app` (restrict to production domain)
- All validation re-run server-side in n8n — frontend validation is UX only, not a security gate
- No API keys in frontend code

---

## 11. Out of Scope (this iteration)

- `.ics` calendar file attachment in confirmation email
- Cancellation / rescheduling flow
- Admin dashboard to view all bookings
- Reminder emails (24hr before call)
- Timezone selection for the prospect (AWST assumed for all slots)
