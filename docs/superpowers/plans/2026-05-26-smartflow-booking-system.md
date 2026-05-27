# SmartFlow Booking System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full 3-step animated booking popup on the SmartFlow static site backed by an n8n workflow (SMARTFLOW-BK1) that stores bookings in workflow static data, prevents double-bookings, and fires Gmail confirmation emails to both the prospect and the owner.

**Architecture:** Two n8n webhook endpoints share `$workflow.staticData.bookings` as a persistent slot registry. The frontend is a self-contained IIFE appended to `script.js` that fetches booked slots on modal open, renders a calendar + time picker, and POSTs to n8n on submit. No new files beyond the three existing static files and a workflow JSON backup.

**Tech Stack:** Vanilla JS/CSS/HTML, n8n REST API, n8n Code nodes + `$workflow.staticData`, n8n Gmail node, n8n Webhook + Respond to Webhook nodes.

---

## Prerequisites

- n8n instance running at `https://n8n.srv823907.hstgr.cloud`
- n8n API key available (`X-N8N-API-KEY` header)
- Gmail credential already configured in n8n (used by the Everise Email System)
- Local project at `/Users/ambrosevoon/Projects/smartflow-automation`

To find your Gmail credential ID, run:
```bash
curl -s https://n8n.srv823907.hstgr.cloud/api/v1/credentials \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" | python3 -m json.tool | grep -A3 '"gmail"'
```
Note the credential `id` — you will need it in Tasks 4 and 5.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `docs/n8n/smartflow-bk1-workflow.json` | Create | Exported workflow JSON for restore/reference |
| `index.html` | Modify | Append modal HTML block; change all Book CTA `href="#contact"` to `class="book-btn"` |
| `styles.css` | Modify | Append all modal + animation CSS (no existing rules touched) |
| `script.js` | Modify | Append booking module IIFE (no existing code touched) |

---

## Slot Reference

- All times are AWST (UTC+8)
- Valid slots: `09:00 09:30 10:00 10:30 11:00 11:30 12:00 12:30 13:00 13:30 14:00 14:30 15:00 15:30 16:00 16:30` (16 slots/day)
- Slot ID format: `YYYY-MM-DD_HH:MM` e.g. `2026-06-02_09:00`
- Mon–Fri only, 1-hour minimum notice, 60-day window

---

## Task 1: Create SMARTFLOW-BK1 n8n workflow (two webhook skeletons)

**Files:**
- Create: `docs/n8n/smartflow-bk1-workflow.json`

- [ ] **Step 1.1: Create the workflow via n8n REST API**

```bash
curl -s -X POST https://n8n.srv823907.hstgr.cloud/api/v1/workflows \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SMARTFLOW-BK1 — SmartFlow Booking System",
    "nodes": [
      {
        "id": "wh-get-1",
        "name": "GET — Get Booked Slots",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 200],
        "parameters": {
          "httpMethod": "GET",
          "path": "smartflow-get-booked-slots",
          "responseMode": "responseNode",
          "options": {}
        }
      },
      {
        "id": "wh-post-1",
        "name": "POST — Book Slot",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 450],
        "parameters": {
          "httpMethod": "POST",
          "path": "smartflow-book-slot",
          "responseMode": "responseNode",
          "options": {}
        }
      }
    ],
    "connections": {},
    "settings": { "executionOrder": "v1" }
  }' | python3 -m json.tool
```

Expected: JSON response with `"id": "..."`. **Save the workflow ID — you need it for every subsequent task.**

- [ ] **Step 1.2: Save the workflow ID to a shell variable**

```bash
WORKFLOW_ID="PASTE_ID_FROM_STEP_1_HERE"
```

- [ ] **Step 1.3: Activate the workflow**

```bash
curl -s -X POST "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}/activate" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY"
```

Expected: `{"active": true}`

- [ ] **Step 1.4: Verify both webhook URLs respond**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-get-booked-slots"

curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-book-slot" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: both return `200` or `404` (not `502`/`503`). Either is fine at this stage — we haven't wired responses yet.

- [ ] **Step 1.5: Save a reference copy of the workflow JSON**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  > /Users/ambrosevoon/Projects/smartflow-automation/docs/n8n/smartflow-bk1-workflow.json
```

- [ ] **Step 1.6: Commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add docs/n8n/smartflow-bk1-workflow.json
git commit -m "feat(n8n): create SMARTFLOW-BK1 workflow skeleton"
```

---

## Task 2: Build Branch 1 — Get Booked Slots

**Files:**
- Modify: `docs/n8n/smartflow-bk1-workflow.json` (updated after task)

- [ ] **Step 2.1: Fetch the current workflow JSON to get existing node list**

```bash
CURRENT=$(curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY")
echo $CURRENT | python3 -m json.tool | head -60
```

- [ ] **Step 2.2: Update workflow — add Code and Respond nodes for Branch 1**

```bash
curl -s -X PUT "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SMARTFLOW-BK1 — SmartFlow Booking System",
    "nodes": [
      {
        "id": "wh-get-1",
        "name": "GET — Get Booked Slots",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 200],
        "parameters": {
          "httpMethod": "GET",
          "path": "smartflow-get-booked-slots",
          "responseMode": "responseNode",
          "options": {}
        }
      },
      {
        "id": "code-get-1",
        "name": "Read Booked Slots",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [480, 200],
        "parameters": {
          "jsCode": "const bookings = $workflow.staticData.bookings || [];\nconst booked = bookings.map(b => b.slot_id);\nreturn [{ json: { booked } }];"
        }
      },
      {
        "id": "resp-get-1",
        "name": "Respond — Booked Slots",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [700, 200],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify($json) }}",
          "options": {
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      },
      {
        "id": "wh-post-1",
        "name": "POST — Book Slot",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 450],
        "parameters": {
          "httpMethod": "POST",
          "path": "smartflow-book-slot",
          "responseMode": "responseNode",
          "options": {}
        }
      }
    ],
    "connections": {
      "GET — Get Booked Slots": {
        "main": [[{ "node": "Read Booked Slots", "type": "main", "index": 0 }]]
      },
      "Read Booked Slots": {
        "main": [[{ "node": "Respond — Booked Slots", "type": "main", "index": 0 }]]
      }
    },
    "settings": { "executionOrder": "v1" }
  }' | python3 -m json.tool | grep '"id"' | head -3
```

- [ ] **Step 2.3: Test Branch 1 — verify it returns `{ "booked": [] }`**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-get-booked-slots"
```

Expected output: `{"booked":[]}`

- [ ] **Step 2.4: Update workflow JSON backup**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  > /Users/ambrosevoon/Projects/smartflow-automation/docs/n8n/smartflow-bk1-workflow.json
```

- [ ] **Step 2.5: Commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add docs/n8n/smartflow-bk1-workflow.json
git commit -m "feat(n8n): add SMARTFLOW-BK1 Branch 1 — get booked slots"
```

---

## Task 3: Build Branch 2 — Validate, Conflict-Check, and Book

**Files:**
- Modify: `docs/n8n/smartflow-bk1-workflow.json`

- [ ] **Step 3.1: Update workflow — add Validate+Book Code node, If node, and two Respond nodes**

```bash
curl -s -X PUT "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SMARTFLOW-BK1 — SmartFlow Booking System",
    "nodes": [
      {
        "id": "wh-get-1",
        "name": "GET — Get Booked Slots",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 200],
        "parameters": {
          "httpMethod": "GET",
          "path": "smartflow-get-booked-slots",
          "responseMode": "responseNode",
          "options": {}
        }
      },
      {
        "id": "code-get-1",
        "name": "Read Booked Slots",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [480, 200],
        "parameters": {
          "jsCode": "const bookings = $workflow.staticData.bookings || [];\nconst booked = bookings.map(b => b.slot_id);\nreturn [{ json: { booked } }];"
        }
      },
      {
        "id": "resp-get-1",
        "name": "Respond — Booked Slots",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [700, 200],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify($json) }}",
          "options": {
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      },
      {
        "id": "wh-post-1",
        "name": "POST — Book Slot",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 450],
        "parameters": {
          "httpMethod": "POST",
          "path": "smartflow-book-slot",
          "responseMode": "responseNode",
          "options": {}
        }
      },
      {
        "id": "code-book-1",
        "name": "Validate + Book",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [480, 450],
        "parameters": {
          "jsCode": "const raw = $input.first().json;\nconst body = raw.body || raw;\n\n// Required fields\nconst required = [\"slot_id\",\"date\",\"time\",\"name\",\"email\",\"phone\",\"agency\"];\nfor (const field of required) {\n  if (!body[field] || String(body[field]).trim() === \"\") {\n    return [{ json: { error: \"missing_field\", field, status: 400 } }];\n  }\n}\n\n// Slot ID format YYYY-MM-DD_HH:MM\nif (!/^\\d{4}-\\d{2}-\\d{2}_\\d{2}:\\d{2}$/.test(body.slot_id)) {\n  return [{ json: { error: \"invalid_slot_id\", status: 400 } }];\n}\n\nconst [datePart, timePart] = body.slot_id.split(\"_\");\nconst [yr, mo, dy] = datePart.split(\"-\").map(Number);\nconst [hr, mn] = timePart.split(\":\").map(Number);\n\n// Mon-Fri only\nconst dow = new Date(yr, mo - 1, dy).getDay();\nif (dow === 0 || dow === 6) {\n  return [{ json: { error: \"weekend_slot\", status: 400 } }];\n}\n\n// Time range 09:00-16:30\nconst slotMins = hr * 60 + mn;\nif (slotMins < 540 || slotMins > 990) {\n  return [{ json: { error: \"invalid_time\", status: 400 } }];\n}\n\n// 1-hour minimum notice (compare UTC; AWST = UTC+8 so subtract 8h)\nconst slotUTC = Date.UTC(yr, mo - 1, dy, hr - 8, mn);\nif (slotUTC - Date.now() < 60 * 60 * 1000) {\n  return [{ json: { error: \"insufficient_notice\", status: 400 } }];\n}\n\n// 60-day window\nconst nowAWST = Date.now() + 8 * 3600000;\nconst maxDate = new Date(nowAWST);\nmaxDate.setUTCDate(maxDate.getUTCDate() + 60);\nif (new Date(Date.UTC(yr, mo - 1, dy)) > maxDate) {\n  return [{ json: { error: \"outside_window\", status: 400 } }];\n}\n\n// Email format\nif (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(body.email)) {\n  return [{ json: { error: \"invalid_email\", status: 400 } }];\n}\n\n// Conflict check\nconst bookings = $workflow.staticData.bookings || [];\nif (bookings.some(b => b.slot_id === body.slot_id)) {\n  return [{ json: { error: \"slot_taken\", status: 409 } }];\n}\n\n// Book it\nconst booking = {\n  slot_id: body.slot_id,\n  date: body.date,\n  time: body.time,\n  name: body.name.trim(),\n  email: body.email.trim().toLowerCase(),\n  phone: body.phone.trim(),\n  agency: body.agency.trim(),\n  message: (body.message || \"\").trim(),\n  booked_at: new Date().toISOString()\n};\n$workflow.staticData.bookings = [...bookings, booking];\nreturn [{ json: { success: true, booking } }];"
        }
      },
      {
        "id": "if-error-1",
        "name": "Has Error?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [700, 450],
        "parameters": {
          "conditions": {
            "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" },
            "conditions": [
              {
                "id": "cond1",
                "leftValue": "={{ $json.error }}",
                "rightValue": "",
                "operator": { "type": "string", "operation": "notEmpty" }
              }
            ],
            "combinator": "and"
          }
        }
      },
      {
        "id": "resp-error-1",
        "name": "Respond — Error",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [900, 350],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify({ error: $json.error }) }}",
          "options": {
            "responseCode": "={{ $json.status || 400 }}",
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      },
      {
        "id": "resp-success-1",
        "name": "Respond — Success (placeholder)",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [900, 550],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify({ success: true, slot_id: $json.booking.slot_id, date: $json.booking.date, time: $json.booking.time }) }}",
          "options": {
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      }
    ],
    "connections": {
      "GET — Get Booked Slots": {
        "main": [[{ "node": "Read Booked Slots", "type": "main", "index": 0 }]]
      },
      "Read Booked Slots": {
        "main": [[{ "node": "Respond — Booked Slots", "type": "main", "index": 0 }]]
      },
      "POST — Book Slot": {
        "main": [[{ "node": "Validate + Book", "type": "main", "index": 0 }]]
      },
      "Validate + Book": {
        "main": [[{ "node": "Has Error?", "type": "main", "index": 0 }]]
      },
      "Has Error?": {
        "main": [
          [{ "node": "Respond — Error", "type": "main", "index": 0 }],
          [{ "node": "Respond — Success (placeholder)", "type": "main", "index": 0 }]
        ]
      }
    },
    "settings": { "executionOrder": "v1" }
  }' | python3 -m json.tool | grep -E '"name"|"id"' | head -20
```

- [ ] **Step 3.2: Test — booking a slot succeeds**

```bash
curl -s -X POST "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-book-slot" \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": "2026-06-10_10:00",
    "date": "Wednesday, 10 June 2026",
    "time": "10:00 AM",
    "name": "Test User",
    "email": "test@example.com",
    "phone": "0400000000",
    "agency": "Test Agency",
    "message": "Test booking"
  }'
```

Expected: `{"success":true,"slot_id":"2026-06-10_10:00","date":"Wednesday, 10 June 2026","time":"10:00 AM"}`

- [ ] **Step 3.3: Test — booking same slot returns 409**

Run the exact same curl from Step 3.2 again.

Expected response body: `{"error":"slot_taken"}` and HTTP 409.

- [ ] **Step 3.4: Test — GET endpoint now returns the booked slot**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-get-booked-slots"
```

Expected: `{"booked":["2026-06-10_10:00"]}`

- [ ] **Step 3.5: Test — validation rejects missing fields**

```bash
curl -s -X POST "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-book-slot" \
  -H "Content-Type: application/json" \
  -d '{"slot_id": "2026-06-10_10:00", "name": "Test"}'
```

Expected: `{"error":"missing_field"}` with HTTP 400.

- [ ] **Step 3.6: Update workflow JSON backup and commit**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  > /Users/ambrosevoon/Projects/smartflow-automation/docs/n8n/smartflow-bk1-workflow.json

cd /Users/ambrosevoon/Projects/smartflow-automation
git add docs/n8n/smartflow-bk1-workflow.json
git commit -m "feat(n8n): add SMARTFLOW-BK1 Branch 2 — validate + conflict check + book"
```

---

## Task 4: Add Gmail — Customer Confirmation Email

**Files:**
- Modify: `docs/n8n/smartflow-bk1-workflow.json`

**Prerequisite:** You need your Gmail credential ID. Run:
```bash
curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/credentials" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" | python3 -m json.tool | grep -B2 -A5 -i "gmail"
```
Note the `"id"` value. Replace `GMAIL_CRED_ID` below with it.

- [ ] **Step 4.1: Update workflow — insert Gmail customer node between If false branch and Respond Success**

```bash
curl -s -X PUT "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SMARTFLOW-BK1 — SmartFlow Booking System",
    "nodes": [
      {
        "id": "wh-get-1",
        "name": "GET — Get Booked Slots",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 200],
        "parameters": {
          "httpMethod": "GET",
          "path": "smartflow-get-booked-slots",
          "responseMode": "responseNode",
          "options": {}
        }
      },
      {
        "id": "code-get-1",
        "name": "Read Booked Slots",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [480, 200],
        "parameters": {
          "jsCode": "const bookings = $workflow.staticData.bookings || [];\nconst booked = bookings.map(b => b.slot_id);\nreturn [{ json: { booked } }];"
        }
      },
      {
        "id": "resp-get-1",
        "name": "Respond — Booked Slots",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [700, 200],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify($json) }}",
          "options": {
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      },
      {
        "id": "wh-post-1",
        "name": "POST — Book Slot",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [250, 450],
        "parameters": {
          "httpMethod": "POST",
          "path": "smartflow-book-slot",
          "responseMode": "responseNode",
          "options": {}
        }
      },
      {
        "id": "code-book-1",
        "name": "Validate + Book",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [480, 450],
        "parameters": {
          "jsCode": "const raw = $input.first().json;\nconst body = raw.body || raw;\n\nconst required = [\"slot_id\",\"date\",\"time\",\"name\",\"email\",\"phone\",\"agency\"];\nfor (const field of required) {\n  if (!body[field] || String(body[field]).trim() === \"\") {\n    return [{ json: { error: \"missing_field\", field, status: 400 } }];\n  }\n}\n\nif (!/^\\d{4}-\\d{2}-\\d{2}_\\d{2}:\\d{2}$/.test(body.slot_id)) {\n  return [{ json: { error: \"invalid_slot_id\", status: 400 } }];\n}\n\nconst [datePart, timePart] = body.slot_id.split(\"_\");\nconst [yr, mo, dy] = datePart.split(\"-\").map(Number);\nconst [hr, mn] = timePart.split(\":\").map(Number);\n\nconst dow = new Date(yr, mo - 1, dy).getDay();\nif (dow === 0 || dow === 6) {\n  return [{ json: { error: \"weekend_slot\", status: 400 } }];\n}\n\nconst slotMins = hr * 60 + mn;\nif (slotMins < 540 || slotMins > 990) {\n  return [{ json: { error: \"invalid_time\", status: 400 } }];\n}\n\nconst slotUTC = Date.UTC(yr, mo - 1, dy, hr - 8, mn);\nif (slotUTC - Date.now() < 60 * 60 * 1000) {\n  return [{ json: { error: \"insufficient_notice\", status: 400 } }];\n}\n\nconst nowAWST = Date.now() + 8 * 3600000;\nconst maxDate = new Date(nowAWST);\nmaxDate.setUTCDate(maxDate.getUTCDate() + 60);\nif (new Date(Date.UTC(yr, mo - 1, dy)) > maxDate) {\n  return [{ json: { error: \"outside_window\", status: 400 } }];\n}\n\nif (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(body.email)) {\n  return [{ json: { error: \"invalid_email\", status: 400 } }];\n}\n\nconst bookings = $workflow.staticData.bookings || [];\nif (bookings.some(b => b.slot_id === body.slot_id)) {\n  return [{ json: { error: \"slot_taken\", status: 409 } }];\n}\n\nconst booking = {\n  slot_id: body.slot_id,\n  date: body.date,\n  time: body.time,\n  name: body.name.trim(),\n  email: body.email.trim().toLowerCase(),\n  phone: body.phone.trim(),\n  agency: body.agency.trim(),\n  message: (body.message || \"\").trim(),\n  booked_at: new Date().toISOString()\n};\n$workflow.staticData.bookings = [...bookings, booking];\nreturn [{ json: { success: true, booking } }];"
        }
      },
      {
        "id": "if-error-1",
        "name": "Has Error?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [700, 450],
        "parameters": {
          "conditions": {
            "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict" },
            "conditions": [
              {
                "id": "cond1",
                "leftValue": "={{ $json.error }}",
                "rightValue": "",
                "operator": { "type": "string", "operation": "notEmpty" }
              }
            ],
            "combinator": "and"
          }
        }
      },
      {
        "id": "resp-error-1",
        "name": "Respond — Error",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [900, 350],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify({ error: $json.error }) }}",
          "options": {
            "responseCode": "={{ $json.status || 400 }}",
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      },
      {
        "id": "gmail-customer-1",
        "name": "Email — Customer Confirmation",
        "type": "n8n-nodes-base.gmail",
        "typeVersion": 2.1,
        "position": [900, 550],
        "credentials": {
          "gmailOAuth2": { "id": "GMAIL_CRED_ID", "name": "Gmail account" }
        },
        "parameters": {
          "sendTo": "={{ $json.booking.email }}",
          "subject": "Your SmartFlow Strategy Call is Confirmed",
          "message": "<!DOCTYPE html><html><body style=\"font-family:Arial,sans-serif;color:#1E293B;max-width:560px;margin:0 auto;padding:24px;\"><div style=\"background:linear-gradient(135deg,#1e3a8a,#2563EB);border-radius:12px;padding:32px;text-align:center;margin-bottom:28px;\"><div style=\"font-size:36px;margin-bottom:8px;\">📅</div><h1 style=\"color:white;margin:0;font-size:22px;font-weight:700;\">Your Call is Confirmed!</h1><p style=\"color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;\">SmartFlow Automation Strategy Call</p></div><p style=\"font-size:15px;\">Hi {{ $json.booking.name.split(' ')[0] }},</p><p style=\"font-size:15px;color:#475569;\">Your free 30-minute strategy call has been confirmed. Here are your booking details:</p><div style=\"background:#EFF6FF;border-left:4px solid #2563EB;border-radius:8px;padding:20px;margin:24px 0;\"><p style=\"margin:0;font-size:18px;font-weight:700;color:#1E293B;\">📅 {{ $json.booking.date }}</p><p style=\"margin:10px 0 0;font-size:16px;color:#2563EB;font-weight:600;\">🕐 {{ $json.booking.time }} AWST (Perth time)</p></div><p style=\"font-size:14px;color:#475569;\">On this 30-minute call we will:</p><ul style=\"font-size:14px;color:#475569;line-height:1.8;\"><li>Understand your agency's current workflow and challenges</li><li>Show you exactly where automation saves the most time</li><li>Walk through a custom automation roadmap for your business</li></ul><p style=\"font-size:14px;color:#475569;\">The call is completely free with no obligation.</p><p style=\"font-size:14px;color:#475569;\">If you need to reschedule, reply to this email or contact us at <a href=\"mailto:hello@smartflowautomation.com\" style=\"color:#2563EB;\">hello@smartflowautomation.com</a>.</p><hr style=\"border:none;border-top:1px solid #E2E8F0;margin:32px 0;\"><div style=\"text-align:center;color:#94A3B8;font-size:12px;\"><p style=\"margin:0 0 4px;\">SmartFlow Automation — Smarter Automation for Real Estate Agencies</p><p style=\"margin:0;\"><a href=\"https://smartflow-automation.vercel.app\" style=\"color:#2563EB;\">smartflow-automation.vercel.app</a></p></div></body></html>",
          "options": {
            "replyTo": "hello@smartflowautomation.com",
            "contentType": "html"
          }
        }
      },
      {
        "id": "resp-success-placeholder",
        "name": "Respond — Success (placeholder)",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1,
        "position": [1100, 550],
        "parameters": {
          "respondWith": "json",
          "responseBody": "={{ JSON.stringify({ success: true, slot_id: $node[\"Validate + Book\"].json.booking.slot_id, date: $node[\"Validate + Book\"].json.booking.date, time: $node[\"Validate + Book\"].json.booking.time }) }}",
          "options": {
            "responseHeaders": {
              "values": [
                { "name": "Access-Control-Allow-Origin", "value": "*" },
                { "name": "Content-Type", "value": "application/json" }
              ]
            }
          }
        }
      }
    ],
    "connections": {
      "GET — Get Booked Slots": {
        "main": [[{ "node": "Read Booked Slots", "type": "main", "index": 0 }]]
      },
      "Read Booked Slots": {
        "main": [[{ "node": "Respond — Booked Slots", "type": "main", "index": 0 }]]
      },
      "POST — Book Slot": {
        "main": [[{ "node": "Validate + Book", "type": "main", "index": 0 }]]
      },
      "Validate + Book": {
        "main": [[{ "node": "Has Error?", "type": "main", "index": 0 }]]
      },
      "Has Error?": {
        "main": [
          [{ "node": "Respond — Error", "type": "main", "index": 0 }],
          [{ "node": "Email — Customer Confirmation", "type": "main", "index": 0 }]
        ]
      },
      "Email — Customer Confirmation": {
        "main": [[{ "node": "Respond — Success (placeholder)", "type": "main", "index": 0 }]]
      }
    },
    "settings": { "executionOrder": "v1" }
  }' | python3 -m json.tool | grep '"name"' | head -12
```

- [ ] **Step 4.2: Update the workflow JSON backup**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  > /Users/ambrosevoon/Projects/smartflow-automation/docs/n8n/smartflow-bk1-workflow.json
```

- [ ] **Step 4.3: Commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add docs/n8n/smartflow-bk1-workflow.json
git commit -m "feat(n8n): add SMARTFLOW-BK1 customer confirmation email node"
```

---

## Task 5: Add Gmail — Owner Notification Email + Final Success Response

**Files:**
- Modify: `docs/n8n/smartflow-bk1-workflow.json`

- [ ] **Step 5.1: Update workflow — add owner Gmail node and wire final Respond Success to it**

Add one new node `gmail-owner-1` between the customer Gmail and the placeholder Respond Success. Keep all other nodes identical to Task 4. The only changes are:
1. New node `gmail-owner-1` (owner notification)
2. Update `"Respond — Success (placeholder)"` name to `"Respond — Success"` and connect it after the owner Gmail
3. Update connections chain: `Email — Customer Confirmation` → `Email — Owner Notification` → `Respond — Success`

Add this node to the nodes array (same PUT call as Task 4 but with additions):

```json
{
  "id": "gmail-owner-1",
  "name": "Email — Owner Notification",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [1100, 550],
  "credentials": {
    "gmailOAuth2": { "id": "GMAIL_CRED_ID", "name": "Gmail account" }
  },
  "parameters": {
    "sendTo": "ambrosevoon@gmail.com",
    "subject": "=[SMARTFLOW-BK1] New Booking — {{ $node[\"Validate + Book\"].json.booking.name }} · {{ $node[\"Validate + Book\"].json.booking.date }} {{ $node[\"Validate + Book\"].json.booking.time }}",
    "message": "<h2>[SMARTFLOW-BK1] New Strategy Call Booking</h2><table style=\"border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;\"><tr style=\"background:#EFF6FF;\"><td style=\"padding:10px 14px;font-weight:700;width:140px;\">Name</td><td style=\"padding:10px 14px;\">{{ $node[\"Validate + Book\"].json.booking.name }}</td></tr><tr><td style=\"padding:10px 14px;font-weight:700;\">Email</td><td style=\"padding:10px 14px;\"><a href=\"mailto:{{ $node[\"Validate + Book\"].json.booking.email }}\">{{ $node[\"Validate + Book\"].json.booking.email }}</a></td></tr><tr style=\"background:#EFF6FF;\"><td style=\"padding:10px 14px;font-weight:700;\">Phone</td><td style=\"padding:10px 14px;\">{{ $node[\"Validate + Book\"].json.booking.phone }}</td></tr><tr><td style=\"padding:10px 14px;font-weight:700;\">Agency</td><td style=\"padding:10px 14px;\">{{ $node[\"Validate + Book\"].json.booking.agency }}</td></tr><tr style=\"background:#EFF6FF;\"><td style=\"padding:10px 14px;font-weight:700;\">Date</td><td style=\"padding:10px 14px;\"><strong>{{ $node[\"Validate + Book\"].json.booking.date }}</strong></td></tr><tr><td style=\"padding:10px 14px;font-weight:700;\">Time</td><td style=\"padding:10px 14px;\"><strong>{{ $node[\"Validate + Book\"].json.booking.time }} AWST</strong></td></tr><tr style=\"background:#EFF6FF;\"><td style=\"padding:10px 14px;font-weight:700;\">Message</td><td style=\"padding:10px 14px;\">{{ $node[\"Validate + Book\"].json.booking.message || \"(none)\" }}</td></tr><tr><td style=\"padding:10px 14px;font-weight:700;\">Slot ID</td><td style=\"padding:10px 14px;font-family:monospace;\">{{ $node[\"Validate + Book\"].json.booking.slot_id }}</td></tr><tr style=\"background:#EFF6FF;\"><td style=\"padding:10px 14px;font-weight:700;\">Booked At</td><td style=\"padding:10px 14px;\">{{ $node[\"Validate + Book\"].json.booking.booked_at }}</td></tr></table>",
    "options": { "contentType": "html" }
  }
}
```

Update connections to chain:
```json
"Email — Customer Confirmation": {
  "main": [[{ "node": "Email — Owner Notification", "type": "main", "index": 0 }]]
},
"Email — Owner Notification": {
  "main": [[{ "node": "Respond — Success", "type": "main", "index": 0 }]]
}
```

Run the full PUT (all nodes from Task 4 + the new owner Gmail node, with updated connections and the final Respond renamed to `"Respond — Success"`).

- [ ] **Step 5.2: Test the full booking flow end-to-end with curl**

First clear the test booking from Task 3 by using a new slot:

```bash
curl -s -X POST "https://n8n.srv823907.hstgr.cloud/webhook/smartflow-book-slot" \
  -H "Content-Type: application/json" \
  -d '{
    "slot_id": "2026-06-11_14:00",
    "date": "Thursday, 11 June 2026",
    "time": "2:00 PM",
    "name": "Ambrose Test",
    "email": "ambrosevoon@gmail.com",
    "phone": "0400000000",
    "agency": "Test Agency",
    "message": "End-to-end test"
  }'
```

Expected:
- Response: `{"success":true,"slot_id":"2026-06-11_14:00",...}`
- `ambrosevoon@gmail.com` receives both a customer confirmation email AND an owner notification email

- [ ] **Step 5.3: Update workflow JSON backup and commit**

```bash
curl -s "https://n8n.srv823907.hstgr.cloud/api/v1/workflows/${WORKFLOW_ID}" \
  -H "X-N8N-API-KEY: YOUR_N8N_API_KEY" \
  > /Users/ambrosevoon/Projects/smartflow-automation/docs/n8n/smartflow-bk1-workflow.json

cd /Users/ambrosevoon/Projects/smartflow-automation
git add docs/n8n/smartflow-bk1-workflow.json
git commit -m "feat(n8n): complete SMARTFLOW-BK1 — owner notification + end-to-end tested"
```

---

## Task 6: Add Modal HTML to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 6.1: Update all "Book a Free Call" / "Book a Free Strategy Call" anchor tags**

In `index.html`, change every `<a href="#contact"` that contains "Book" button text to remove `href="#contact"` and add class `book-btn`. There are 3 occurrences:

1. Nav CTA (line ~39): `<a href="#contact" class="btn btn-primary nav-cta">` → `<button class="btn btn-primary nav-cta book-btn">`  and close with `</button>`
2. Hero CTA (line ~53): `<a href="#contact" class="btn btn-primary">` → `<button class="btn btn-primary book-btn">`  and close with `</button>`
3. CTA section (line ~330): `<a href="mailto:hello@smartflowautomation.com" class="btn btn-primary btn-lg">` → `<button class="btn btn-primary btn-lg book-btn">`  and close with `</button>`

Also update the mobile nav drawer in `script.js` line 29: change `<a href="#contact" class="btn btn-primary">` to `<button class="btn btn-primary book-btn">` and `</a>` to `</button>`.

- [ ] **Step 6.2: Append the modal HTML block before `</body>` in index.html**

```html
  <!-- ── BOOKING MODAL ─────────────────────────────────────── -->
  <div id="booking-overlay" class="bk-overlay bk-hidden" role="dialog" aria-modal="true" aria-label="Book a Free Strategy Call">
    <div class="bk-backdrop"></div>
    <div class="bk-card">

      <div class="bk-header">
        <div class="bk-header-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" stroke-width="2"/>
            <path d="M16 2v4M8 2v4M3 10h18" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <h2 class="bk-title">Book a Free Strategy Call</h2>
          <p class="bk-subtitle">30 min &middot; No obligation &middot; Perth time (AWST)</p>
        </div>
        <button class="bk-close" id="bk-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="bk-progress"><div class="bk-progress-bar" id="bk-progress-bar"></div></div>

      <div class="bk-body" id="bk-body">

        <!-- Step 1: Date -->
        <div class="bk-step bk-step--active" id="bk-step-1">
          <p class="bk-step-label">Step 1 of 3 &mdash; Choose a date</p>
          <div class="bk-cal">
            <div class="bk-cal-nav">
              <button class="bk-cal-nav-btn" id="bk-cal-prev" aria-label="Previous month">&larr;</button>
              <span class="bk-cal-month" id="bk-cal-month-label"></span>
              <button class="bk-cal-nav-btn" id="bk-cal-next" aria-label="Next month">&rarr;</button>
            </div>
            <div class="bk-cal-grid" id="bk-cal-grid"></div>
          </div>
        </div>

        <!-- Step 2: Time -->
        <div class="bk-step bk-step--hidden" id="bk-step-2">
          <p class="bk-step-label">Step 2 of 3 &mdash; Choose a time</p>
          <div class="bk-slots-header">
            <button class="bk-back-btn" id="bk-step2-back">&larr; Back</button>
            <span class="bk-selected-date-label" id="bk-selected-date-label"></span>
          </div>
          <div class="bk-slots-grid" id="bk-slots-grid"></div>
          <p class="bk-no-slots bk-hidden" id="bk-no-slots">No available slots for this day &mdash; please choose another date.</p>
        </div>

        <!-- Step 3: Form -->
        <div class="bk-step bk-step--hidden" id="bk-step-3">
          <p class="bk-step-label">Step 3 of 3 &mdash; Your details</p>
          <div class="bk-slot-summary" id="bk-slot-summary"></div>
          <form class="bk-form" id="bk-form" novalidate>
            <div class="bk-field">
              <input type="text" id="bk-name" name="name" required placeholder=" " autocomplete="name">
              <label for="bk-name">Full Name</label>
            </div>
            <div class="bk-field">
              <input type="email" id="bk-email" name="email" required placeholder=" " autocomplete="email">
              <label for="bk-email">Email Address</label>
            </div>
            <div class="bk-field">
              <input type="tel" id="bk-phone" name="phone" required placeholder=" " autocomplete="tel">
              <label for="bk-phone">Phone Number</label>
            </div>
            <div class="bk-field">
              <input type="text" id="bk-agency" name="agency" required placeholder=" " autocomplete="organization">
              <label for="bk-agency">Agency / Company Name</label>
            </div>
            <div class="bk-field">
              <textarea id="bk-message" name="message" placeholder=" " rows="3"></textarea>
              <label for="bk-message">What would you like to discuss? (optional)</label>
            </div>
            <div class="bk-form-error bk-hidden" id="bk-form-error"></div>
            <div class="bk-form-actions">
              <button type="button" class="bk-back-btn" id="bk-step3-back">&larr; Back</button>
              <button type="submit" class="btn btn-primary bk-submit-btn" id="bk-submit">
                <span class="bk-submit-text">Confirm Booking</span>
                <span class="bk-spinner bk-hidden" id="bk-spinner"></span>
              </button>
            </div>
          </form>
        </div>

        <!-- Success -->
        <div class="bk-step bk-step--hidden" id="bk-step-success">
          <div class="bk-success">
            <div class="bk-success-graphic">
              <svg class="bk-success-svg" viewBox="0 0 80 80">
                <circle class="bk-success-circle" cx="40" cy="40" r="36" fill="none" stroke="#2563EB" stroke-width="4"/>
                <polyline class="bk-success-check" points="24,40 35,52 56,28" fill="none" stroke="#2563EB" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <div class="bk-confetti-container" id="bk-confetti-container"></div>
            </div>
            <h3 class="bk-success-title">You&rsquo;re booked in!</h3>
            <div class="bk-success-details" id="bk-success-details"></div>
            <p class="bk-success-note">A confirmation email has been sent to you. We look forward to speaking with you!</p>
            <button class="btn btn-outline bk-close-success" id="bk-close-success">Close</button>
          </div>
        </div>

      </div>

      <div class="bk-loading bk-hidden" id="bk-loading">
        <div class="bk-loading-spinner"></div>
      </div>

    </div>
  </div>
```

- [ ] **Step 6.3: Verify HTML is valid — open the file and check no unclosed tags**

```bash
grep -n "bk-overlay\|bk-card\|bk-step\|bk-form\|bk-success" \
  /Users/ambrosevoon/Projects/smartflow-automation/index.html | tail -20
```

Expected: all modal elements appear in the grep output without errors.

- [ ] **Step 6.4: Commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add index.html
git commit -m "feat(frontend): add booking modal HTML and update Book CTA buttons"
```

---

## Task 7: Add Modal CSS to styles.css

**Files:**
- Modify: `styles.css`

- [ ] **Step 7.1: Append the full booking modal CSS to the end of styles.css**

```css
/* ═══════════════════════════════════════════════════════
   BOOKING MODAL — appended by SMARTFLOW-BK1
   ═══════════════════════════════════════════════════════ */

/* ── Utility ─────────────────────────────────────── */
.bk-hidden { display: none !important; }

/* ── Overlay ─────────────────────────────────────── */
.bk-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.bk-overlay.bk-visible .bk-backdrop  { animation: bk-backdrop-in 200ms ease forwards; }
.bk-overlay.bk-visible .bk-card      { animation: bk-modal-in 320ms cubic-bezier(0.34,1.56,0.64,1) 60ms both; }

/* ── Backdrop ────────────────────────────────────── */
.bk-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15,31,61,.72);
  backdrop-filter: blur(4px) saturate(.8);
  -webkit-backdrop-filter: blur(4px) saturate(.8);
  opacity: 0;
}

/* ── Card ────────────────────────────────────────── */
.bk-card {
  position: relative;
  background: var(--white);
  border-radius: 20px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 0 0 1px rgba(37,99,235,.08), 0 32px 80px rgba(0,0,0,.22);
  transform-origin: center bottom;
  opacity: 0;
  z-index: 1;
  scrollbar-width: thin;
}

/* ── Header ──────────────────────────────────────── */
.bk-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 22px 18px;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563EB 100%);
  border-radius: 20px 20px 0 0;
  position: relative;
  flex-shrink: 0;
}
.bk-header-icon {
  width: 42px; height: 42px;
  background: rgba(255,255,255,.15);
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  animation: bk-pulse 2.4s ease-in-out infinite;
}
.bk-title   { font-size: 1.02rem; font-weight: 700; color: white; margin: 0 0 3px; }
.bk-subtitle { font-size: .76rem; color: rgba(255,255,255,.72); margin: 0; }
.bk-close {
  position: absolute; top: 14px; right: 14px;
  width: 30px; height: 30px;
  border: none; background: rgba(255,255,255,.15); border-radius: 8px;
  color: white; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.bk-close:hover { background: rgba(255,255,255,.28); }

/* ── Progress ────────────────────────────────────── */
.bk-progress { height: 3px; background: var(--border); flex-shrink: 0; }
.bk-progress-bar { height: 100%; background: var(--blue); width: 33.33%; transition: width 400ms ease; }

/* ── Body ────────────────────────────────────────── */
.bk-body { padding: 24px; position: relative; min-height: 340px; overflow: hidden; }
.bk-step-label {
  font-size: .7rem; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;
}

/* ── Step transitions ────────────────────────────── */
.bk-step--hidden { display: none; }
.bk-step--active { display: block; }

.bk-slide-in-right  { animation: bk-slide-in-r  220ms ease-out forwards; }
.bk-slide-in-left   { animation: bk-slide-in-l  220ms ease-out forwards; }
.bk-slide-out-left  { animation: bk-slide-out-l 180ms ease    forwards; position: absolute; width: calc(100% - 48px); }
.bk-slide-out-right { animation: bk-slide-out-r 180ms ease    forwards; position: absolute; width: calc(100% - 48px); }

@keyframes bk-slide-in-r  { from { opacity: 0; transform: translateX(40px); }  to { opacity: 1; transform: none; } }
@keyframes bk-slide-in-l  { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: none; } }
@keyframes bk-slide-out-l { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(-40px); } }
@keyframes bk-slide-out-r { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateX(40px); } }

/* ── Calendar ────────────────────────────────────── */
.bk-cal-nav {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
.bk-cal-nav-btn {
  width: 32px; height: 32px;
  border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--white); color: var(--text);
  cursor: pointer; font-size: 1rem;
  display: flex; align-items: center; justify-content: center;
  transition: border-color .15s, color .15s, transform .15s;
}
.bk-cal-nav-btn:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); transform: scale(1.1); }
.bk-cal-nav-btn:disabled { opacity: .3; cursor: not-allowed; }
.bk-cal-month { font-size: .9rem; font-weight: 700; color: var(--text); }

.bk-cal-weekdays { display: grid; grid-template-columns: repeat(7,1fr); gap: 2px; margin-bottom: 4px; }
.bk-cal-weekday  { text-align: center; font-size: .66rem; font-weight: 600; color: var(--muted); padding: 4px 0; text-transform: uppercase; letter-spacing: .5px; }
.bk-cal-days     { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }

.bk-cal-day {
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: .84rem; font-weight: 500;
  cursor: pointer;
  border: 1.5px solid transparent;
  background: transparent;
  color: var(--text);
  transition: all .15s;
  position: relative;
}
.bk-cal-day:not(.bk-cal-day--disabled):not(.bk-cal-day--selected):hover {
  border-color: var(--blue); color: var(--blue); background: var(--blue-light); transform: translateY(-2px);
}
.bk-cal-day--disabled { color: var(--muted); opacity: .3; cursor: not-allowed; pointer-events: none; }
.bk-cal-day--empty    { visibility: hidden; border: none; background: none; cursor: default; }
.bk-cal-day--today::after {
  content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
  width: 4px; height: 4px; background: var(--blue); border-radius: 50%;
}
.bk-cal-day--selected {
  background: var(--blue); color: white; border-color: var(--blue);
  animation: bk-day-pop 200ms cubic-bezier(0.34,1.56,0.64,1) forwards;
}
@keyframes bk-day-pop { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1.06); } }
@keyframes bk-month-out-l  { to { opacity: 0; transform: translateX(-18px); } }
@keyframes bk-month-out-r  { to { opacity: 0; transform: translateX(18px); } }
@keyframes bk-month-in-r   { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
@keyframes bk-month-in-l   { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: none; } }

/* ── Time slots ──────────────────────────────────── */
.bk-slots-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.bk-selected-date-label { font-size: .85rem; font-weight: 600; color: var(--text); }
.bk-back-btn { background: none; border: none; color: var(--blue); font-size: .85rem; font-weight: 600; cursor: pointer; padding: 4px 0; transition: opacity .15s; }
.bk-back-btn:hover { opacity: .7; }

.bk-slots-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }

.bk-slot-pill {
  padding: 10px 6px;
  border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--white); font-size: .82rem; font-weight: 600;
  color: var(--text); cursor: pointer; text-align: center;
  opacity: 0; transform: translateY(8px);
  animation: bk-slot-in 200ms ease-out forwards;
  transition: border-color .15s, background .15s, color .15s, transform .12s;
}
.bk-slot-pill:hover         { border-color: var(--blue); color: var(--blue); background: var(--blue-light); }
.bk-slot-pill--selected     { background: var(--blue); color: white; border-color: var(--blue); }
@keyframes bk-slot-in { to { opacity: 1; transform: translateY(0); } }

.bk-no-slots { text-align: center; color: var(--muted); font-size: .875rem; padding: 32px 0; }

/* ── Form ────────────────────────────────────────── */
.bk-slot-summary { margin-bottom: 16px; }
.bk-summary-chip {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--blue-light); border: 1px solid rgba(37,99,235,.2);
  border-radius: 8px; padding: 8px 12px;
  font-size: .82rem; font-weight: 600; color: var(--blue);
}
.bk-summary-edit { background: none; border: none; color: var(--blue); font-size: .78rem; cursor: pointer; padding: 0; text-decoration: underline; font-weight: 500; opacity: .7; }
.bk-summary-edit:hover { opacity: 1; }

.bk-form { display: flex; flex-direction: column; gap: 14px; }

.bk-field { position: relative; }
.bk-field input,
.bk-field textarea {
  width: 100%; padding: 16px 14px 6px;
  border: 1.5px solid var(--border); border-radius: 8px;
  font-size: .9rem; font-family: inherit; color: var(--text);
  background: var(--white); outline: none; transition: border-color .15s;
  resize: vertical;
}
.bk-field input:focus,
.bk-field textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.08); }

.bk-field::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
  width: 3px; background: var(--blue); border-radius: 0 2px 2px 0;
  transform: scaleY(0); transition: transform .15s ease;
}
.bk-field:focus-within::before { transform: scaleY(1); }

.bk-field label {
  position: absolute; top: 11px; left: 14px;
  font-size: .9rem; color: var(--muted);
  pointer-events: none; transition: all .15s ease;
  transform-origin: left top;
}
.bk-field input:focus       + label,
.bk-field input:not(:placeholder-shown)   + label,
.bk-field textarea:focus    + label,
.bk-field textarea:not(:placeholder-shown) + label {
  transform: translateY(-7px) scale(.76); color: var(--blue);
}

.bk-form-error {
  background: #FEF2F2; border: 1px solid #FECACA;
  border-radius: 8px; padding: 10px 14px;
  font-size: .85rem; color: #991B1B;
}

.bk-form-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; }
.bk-submit-btn { flex: 1; justify-content: center; position: relative; overflow: hidden; gap: 10px; }
.bk-submit-btn::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent);
  transform: skewX(-20deg);
}
.bk-submit-btn:hover::after { left: 140%; transition: left 600ms ease-in-out; }

.bk-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: bk-spin .6s linear infinite; }

/* ── Success screen ──────────────────────────────── */
.bk-success { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 8px 0 16px; }
.bk-success-graphic { position: relative; width: 80px; height: 80px; margin-bottom: 20px; }
.bk-success-svg { width: 80px; height: 80px; }

.bk-success-circle {
  stroke-dasharray: 226; stroke-dashoffset: 226;
  transform: rotate(-90deg); transform-origin: 40px 40px; opacity: 0;
}
.bk-success-check { stroke-dasharray: 50; stroke-dashoffset: 50; opacity: 0; }

@keyframes bk-draw-circle {
  0%  { stroke-dashoffset: 226; opacity: 0; }
  8%  { opacity: 1; }
  100%{ stroke-dashoffset: 0; opacity: 1; }
}
@keyframes bk-draw-check {
  0%  { stroke-dashoffset: 50; opacity: 0; }
  8%  { opacity: 1; }
  100%{ stroke-dashoffset: 0; opacity: 1; }
}
@keyframes bk-success-bounce {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.bk-success-title  { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0 0 12px; opacity: 0; }
.bk-success-name   { font-size: .95rem; color: var(--muted); margin: 0 0 10px; }
.bk-success-slot   {
  display: flex; flex-direction: column; gap: 4px;
  background: var(--blue-light); border: 1px solid rgba(37,99,235,.2);
  border-radius: 10px; padding: 12px 20px;
  font-size: .9rem; font-weight: 600; color: var(--blue); margin-bottom: 16px;
}
.bk-success-note { font-size: .85rem; color: var(--muted); max-width: 380px; line-height: 1.6; margin: 0 0 20px; }
.bk-close-success { }

.bk-confetti-container { position: absolute; inset: 0; pointer-events: none; }
.bk-confetti-dot {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  top: 50%; left: 50%; transform: translate(-50%,-50%); opacity: 0;
}
@keyframes bk-confetti-fly {
  0%  { opacity: 1; transform: translate(-50%,-50%); }
  70% { opacity: 1; }
  100%{ opacity: 0; transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))); }
}

/* ── Loading overlay ─────────────────────────────── */
.bk-loading {
  position: absolute; inset: 0;
  background: rgba(255,255,255,.88); border-radius: 20px;
  display: flex; align-items: center; justify-content: center; z-index: 2;
}
.bk-loading-spinner { width: 36px; height: 36px; border: 3px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: bk-spin .7s linear infinite; }

/* ── Keyframes ───────────────────────────────────── */
@keyframes bk-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bk-modal-in    { from { opacity: 0; transform: scale(.92) translateY(32px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes bk-modal-out   { from { opacity: 1; transform: scale(1) translateY(0); }      to { opacity: 0; transform: scale(.94) translateY(24px); } }
@keyframes bk-pulse       { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: .85; } }
@keyframes bk-spin        { to { transform: rotate(360deg); } }

/* ── Mobile — bottom sheet ───────────────────────── */
@media (max-width: 520px) {
  .bk-overlay { align-items: flex-end; padding: 0; }
  .bk-card    { border-radius: 20px 20px 0 0; max-height: 92vh; max-width: 100%; }
  .bk-card::before {
    content: ''; display: block; width: 36px; height: 4px;
    background: rgba(0,0,0,.14); border-radius: 2px; margin: 10px auto -4px;
  }
  .bk-overlay.bk-visible .bk-card { animation: bk-sheet-in 320ms cubic-bezier(0.34,1.56,0.64,1) 60ms both; }
  .bk-slots-grid { grid-template-columns: repeat(2,1fr); }
  .bk-form-actions { flex-direction: column-reverse; gap: 8px; }
  .bk-submit-btn { width: 100%; }
}
@keyframes bk-sheet-in { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 7.2: Verify CSS appended correctly**

```bash
tail -10 /Users/ambrosevoon/Projects/smartflow-automation/styles.css
```

Expected: shows the last few lines of the booking CSS.

- [ ] **Step 7.3: Commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add styles.css
git commit -m "feat(frontend): add booking modal CSS with full animation suite"
```

---

## Task 8: Add Booking JavaScript Module to script.js

**Files:**
- Modify: `script.js`

- [ ] **Step 8.1: Append the full booking module IIFE to the end of script.js**

```javascript
/* ── BOOKING MODULE — SMARTFLOW-BK1 ─────────────────────── */
(function () {
  'use strict';

  var N8N_GET  = 'https://n8n.srv823907.hstgr.cloud/webhook/smartflow-get-booked-slots';
  var N8N_POST = 'https://n8n.srv823907.hstgr.cloud/webhook/smartflow-book-slot';
  var WINDOW_DAYS   = 60;
  var MIN_NOTICE_MS = 60 * 60 * 1000;   // 1 hour
  var AWST_OFFSET   = 8 * 3600 * 1000;  // UTC+8

  // All valid slot times: 09:00 → 16:30 in 30-min steps
  var ALL_TIMES = [];
  for (var _m = 540; _m <= 990; _m += 30) {
    ALL_TIMES.push(pad(_m / 60 | 0) + ':' + pad(_m % 60));
  }
  function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

  // ── State ────────────────────────────────────────────────
  var bookedSlots = new Set();
  var viewYear, viewMonth;
  var selDate = null;   // { year, month, day, label }
  var selSlot = null;   // { slot_id, time, timeLabel }
  var prevStep = 0;

  // ── DOM refs ─────────────────────────────────────────────
  var overlay, card, progressBar;
  var step1El, step2El, step3El, successEl;
  var calMonthLabel, calGrid, calPrevBtn, calNextBtn;
  var slotsGrid, noSlotsMsg, selDateLabel;
  var slotSummaryEl, bkForm, formError, submitBtn, submitText, spinner, loadingEl;
  var successDetails, confettiContainer;

  // ── Helpers ──────────────────────────────────────────────
  function nowAWST() { return new Date(Date.now() + AWST_OFFSET); }

  function slotId(y, m, d, t) {
    return y + '-' + pad(m) + '-' + pad(d) + '_' + t;
  }

  function fmtDate(y, m, d) {
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function fmtTime(t24) {
    var parts = t24.split(':');
    var h = +parts[0], mn = +parts[1];
    return (h % 12 || 12) + ':' + pad(mn) + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  function eligibleSlots(y, m, d) {
    return ALL_TIMES.filter(function (t) {
      if (bookedSlots.has(slotId(y, m, d, t))) return false;
      var parts = t.split(':');
      var slotUTC = Date.UTC(y, m - 1, d, +parts[0] - 8, +parts[1]);
      return slotUTC - Date.now() >= MIN_NOTICE_MS;
    });
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    overlay        = document.getElementById('booking-overlay');
    card           = overlay.querySelector('.bk-card');
    progressBar    = document.getElementById('bk-progress-bar');
    step1El        = document.getElementById('bk-step-1');
    step2El        = document.getElementById('bk-step-2');
    step3El        = document.getElementById('bk-step-3');
    successEl      = document.getElementById('bk-step-success');
    calMonthLabel  = document.getElementById('bk-cal-month-label');
    calGrid        = document.getElementById('bk-cal-grid');
    calPrevBtn     = document.getElementById('bk-cal-prev');
    calNextBtn     = document.getElementById('bk-cal-next');
    slotsGrid      = document.getElementById('bk-slots-grid');
    noSlotsMsg     = document.getElementById('bk-no-slots');
    selDateLabel   = document.getElementById('bk-selected-date-label');
    slotSummaryEl  = document.getElementById('bk-slot-summary');
    bkForm         = document.getElementById('bk-form');
    formError      = document.getElementById('bk-form-error');
    submitBtn      = document.getElementById('bk-submit');
    submitText     = submitBtn.querySelector('.bk-submit-text');
    spinner        = document.getElementById('bk-spinner');
    loadingEl      = document.getElementById('bk-loading');
    successDetails = document.getElementById('bk-success-details');
    confettiContainer = document.getElementById('bk-confetti-container');

    // Wire all book buttons
    document.querySelectorAll('.book-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    });

    document.getElementById('bk-close').addEventListener('click', closeModal);
    overlay.querySelector('.bk-backdrop').addEventListener('click', closeModal);
    calPrevBtn.addEventListener('click', function () { navigateMonth(-1); });
    calNextBtn.addEventListener('click', function () { navigateMonth(1); });
    document.getElementById('bk-step2-back').addEventListener('click', function () { goToStep(1); });
    document.getElementById('bk-step3-back').addEventListener('click', function () { goToStep(2); });
    document.getElementById('bk-close-success').addEventListener('click', closeModal);
    bkForm.addEventListener('submit', handleSubmit);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.classList.contains('bk-hidden')) closeModal();
    });

    initSwipe();
  }

  // ── Modal open / close ───────────────────────────────────
  function openModal() {
    selDate = null; selSlot = null; prevStep = 0;
    var now = nowAWST();
    viewYear  = now.getUTCFullYear();
    viewMonth = now.getUTCMonth() + 1;

    overlay.classList.remove('bk-hidden');
    requestAnimationFrame(function () { overlay.classList.add('bk-visible'); });
    loadingEl.classList.remove('bk-hidden');
    showStep(1, false);

    fetch(N8N_GET)
      .then(function (r) { return r.json(); })
      .then(function (data) { bookedSlots = new Set(data.booked || []); })
      .catch(function () { bookedSlots = new Set(); })
      .finally(function () {
        loadingEl.classList.add('bk-hidden');
        renderCalendar();
      });
  }

  function closeModal() {
    card.style.animation = 'bk-modal-out 180ms ease-in forwards';
    overlay.querySelector('.bk-backdrop').style.animation = 'bk-backdrop-in 180ms ease reverse forwards';
    setTimeout(function () {
      overlay.classList.add('bk-hidden');
      overlay.classList.remove('bk-visible');
      card.style.animation = '';
      overlay.querySelector('.bk-backdrop').style.animation = '';
      bkForm.reset();
      formError.classList.add('bk-hidden');
    }, 200);
  }

  // ── Step navigation ──────────────────────────────────────
  function showStep(stepNum, animate) {
    var steps = [step1El, step2El, step3El, successEl];
    var idx = stepNum === 'success' ? 3 : stepNum - 1;
    var forward = prevStep === 0 || (typeof stepNum === 'number' && stepNum > prevStep);
    var prevIdx = prevStep === 'success' ? 3 : (prevStep > 0 ? prevStep - 1 : -1);

    if (animate && prevIdx >= 0) {
      steps[prevIdx].classList.add(forward ? 'bk-slide-out-left' : 'bk-slide-out-right');
      setTimeout(function () {
        steps[prevIdx].classList.add('bk-step--hidden');
        steps[prevIdx].classList.remove('bk-slide-out-left', 'bk-slide-out-right', 'bk-step--active');
      }, 190);
    } else if (prevIdx >= 0) {
      steps[prevIdx].classList.add('bk-step--hidden');
      steps[prevIdx].classList.remove('bk-step--active');
    }

    var target = steps[idx];
    target.classList.remove('bk-step--hidden');
    target.classList.add('bk-step--active');
    if (animate) {
      target.classList.add(forward ? 'bk-slide-in-right' : 'bk-slide-in-left');
      setTimeout(function () { target.classList.remove('bk-slide-in-right', 'bk-slide-in-left'); }, 240);
    }

    var pct = stepNum === 'success' ? 100 : (stepNum / 3) * 100;
    progressBar.style.width = pct + '%';
    prevStep = stepNum;
  }

  function goToStep(n) {
    showStep(n, true);
    if (n === 1) renderCalendar();
    if (n === 2 && selDate) renderSlots();
    if (n === 3 && selSlot) renderSummary();
  }

  // ── Step 1: Calendar ─────────────────────────────────────
  function renderCalendar() {
    var now = nowAWST();
    var todayY = now.getUTCFullYear(), todayM = now.getUTCMonth() + 1, todayD = now.getUTCDate();

    calMonthLabel.textContent = new Date(viewYear, viewMonth - 1, 1)
      .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

    var atCurrentMonth = (viewYear === todayY && viewMonth === todayM);
    calPrevBtn.disabled = atCurrentMonth;
    calPrevBtn.style.opacity = atCurrentMonth ? '0.3' : '';

    var firstDOW  = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // Mon=0
    var daysCount = new Date(viewYear, viewMonth, 0).getDate();
    var maxDate   = new Date(Date.UTC(todayY, todayM - 1, todayD + WINDOW_DAYS));

    var html = '<div class="bk-cal-weekdays">';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function (d) {
      html += '<span class="bk-cal-weekday">' + d + '</span>';
    });
    html += '</div><div class="bk-cal-days">';

    for (var i = 0; i < firstDOW; i++) html += '<div class="bk-cal-day bk-cal-day--empty"></div>';

    for (var d = 1; d <= daysCount; d++) {
      var thisDate = new Date(viewYear, viewMonth - 1, d);
      var dow      = thisDate.getDay();
      var isWE     = dow === 0 || dow === 6;
      var isPast   = thisDate < new Date(todayY, todayM - 1, todayD);
      var isFuture = new Date(Date.UTC(viewYear, viewMonth - 1, d)) > maxDate;
      var isToday  = (!isPast && !isFuture && viewYear === todayY && viewMonth === todayM && d === todayD);
      var isSel    = selDate && selDate.year === viewYear && selDate.month === viewMonth && selDate.day === d;
      var isFull   = !isWE && !isPast && !isFuture && eligibleSlots(viewYear, viewMonth, d).length === 0;
      var disabled = isWE || isPast || isFuture || isFull;

      var cls = 'bk-cal-day';
      if (disabled) cls += ' bk-cal-day--disabled';
      if (isToday)  cls += ' bk-cal-day--today';
      if (isSel)    cls += ' bk-cal-day--selected';

      if (!disabled) {
        html += '<button class="' + cls + '" data-y="' + viewYear + '" data-m="' + viewMonth + '" data-d="' + d + '">' + d + '</button>';
      } else {
        html += '<div class="' + cls + '">' + d + '</div>';
      }
    }
    html += '</div>';
    calGrid.innerHTML = html;

    calGrid.querySelectorAll('.bk-cal-day:not(.bk-cal-day--disabled)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var y = +btn.dataset.y, m = +btn.dataset.m, dd = +btn.dataset.d;
        selDate = { year: y, month: m, day: dd, label: fmtDate(y, m, dd) };
        renderCalendar(); // re-render to show selection
        setTimeout(function () { goToStep(2); }, 120);
      });
    });
  }

  function navigateMonth(dir) {
    viewMonth += dir;
    if (viewMonth > 12) { viewMonth = 1; viewYear++; }
    if (viewMonth < 1)  { viewMonth = 12; viewYear--; }
    var outAnim = dir > 0 ? 'bk-month-out-l 150ms ease forwards' : 'bk-month-out-r 150ms ease forwards';
    var inAnim  = dir > 0 ? 'bk-month-in-r 200ms ease forwards'  : 'bk-month-in-l 200ms ease forwards';
    calGrid.style.animation = outAnim;
    setTimeout(function () {
      renderCalendar();
      calGrid.style.animation = inAnim;
      setTimeout(function () { calGrid.style.animation = ''; }, 220);
    }, 155);
  }

  // ── Step 2: Time slots ───────────────────────────────────
  function renderSlots() {
    selDateLabel.textContent = selDate.label;
    var slots = eligibleSlots(selDate.year, selDate.month, selDate.day);
    if (slots.length === 0) {
      slotsGrid.innerHTML = '';
      noSlotsMsg.classList.remove('bk-hidden');
      return;
    }
    noSlotsMsg.classList.add('bk-hidden');
    slotsGrid.innerHTML = slots.map(function (t, i) {
      return '<button class="bk-slot-pill" data-t="' + t + '" style="animation-delay:' + (i * 30) + 'ms">' + fmtTime(t) + '</button>';
    }).join('');
    slotsGrid.querySelectorAll('.bk-slot-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        selSlot = { slot_id: slotId(selDate.year, selDate.month, selDate.day, pill.dataset.t), time: pill.dataset.t, timeLabel: fmtTime(pill.dataset.t) };
        pill.classList.add('bk-slot-pill--selected');
        pill.style.transform = 'scale(1.06)';
        setTimeout(function () { pill.style.transform = ''; }, 200);
        setTimeout(function () { goToStep(3); }, 160);
      });
    });
  }

  // ── Step 3: Form ─────────────────────────────────────────
  function renderSummary() {
    slotSummaryEl.innerHTML =
      '<div class="bk-summary-chip">' +
        '<svg viewBox="0 0 24 24" fill="none" width="14" height="14">' +
          '<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>' +
          '<path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '</svg>' +
        '<span>' + selDate.label + ' &middot; ' + selSlot.timeLabel + ' AWST</span>' +
        '<button class="bk-summary-edit" id="bk-edit-slot">Edit</button>' +
      '</div>';
    document.getElementById('bk-edit-slot').addEventListener('click', function () { goToStep(1); });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    formError.classList.add('bk-hidden');
    var name   = bkForm.name.value.trim();
    var email  = bkForm.email.value.trim();
    var phone  = bkForm.phone.value.trim();
    var agency = bkForm.agency.value.trim();
    var msg    = bkForm.message.value.trim();

    if (!name || !email || !phone || !agency) {
      return showError('Please fill in all required fields.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError('Please enter a valid email address.');
    }

    setLoading(true);
    try {
      var res  = await fetch(N8N_POST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selSlot.slot_id, date: selDate.label, time: selSlot.timeLabel,
          name: name, email: email, phone: phone, agency: agency, message: msg
        })
      });
      var data = await res.json();
      if (res.status === 409 || data.error === 'slot_taken') {
        showError('That time slot was just taken. Please choose another time.');
        setTimeout(function () { formError.classList.add('bk-hidden'); goToStep(1); }, 2600);
        return;
      }
      if (!res.ok) { showError('Something went wrong. Please try again.'); return; }
      showSuccess(name, selDate.label, selSlot.timeLabel);
    } catch (_) {
      showError('Network error — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitText.textContent = on ? 'Confirming…' : 'Confirm Booking';
    spinner.classList.toggle('bk-hidden', !on);
  }
  function showError(msg) { formError.textContent = msg; formError.classList.remove('bk-hidden'); }

  // ── Success ──────────────────────────────────────────────
  function showSuccess(name, date, time) {
    successDetails.innerHTML =
      '<p class="bk-success-name">Hi ' + name.split(' ')[0] + ',</p>' +
      '<div class="bk-success-slot"><span>📅 ' + date + '</span><span>🕐 ' + time + ' AWST</span></div>';
    goToStep('success');

    var circle = overlay.querySelector('.bk-success-circle');
    var check  = overlay.querySelector('.bk-success-check');
    var title  = overlay.querySelector('.bk-success-title');

    circle.style.animation = ''; check.style.animation = ''; title.style.animation = '';
    void circle.offsetWidth;
    circle.style.animation = 'bk-draw-circle 400ms ease-out 100ms forwards';
    check.style.animation  = 'bk-draw-check  300ms ease-out 500ms forwards';
    title.style.opacity    = '0';
    setTimeout(function () {
      title.style.animation = 'bk-success-bounce 280ms cubic-bezier(0.34,1.56,0.64,1) forwards';
    }, 620);
    setTimeout(launchConfetti, 720);
  }

  function launchConfetti() {
    confettiContainer.innerHTML = '';
    var colors = ['#2563EB','#16A34A','#EA580C','#7C3AED','#0D9488','#DB2777','#FCD34D','#F87171'];
    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * 2 * Math.PI;
      var dist  = 44 + Math.random() * 28;
      var dot   = document.createElement('div');
      dot.className = 'bk-confetti-dot';
      dot.style.cssText =
        '--tx:' + (Math.cos(angle) * dist).toFixed(1) + 'px;' +
        '--ty:' + (Math.sin(angle) * dist).toFixed(1) + 'px;' +
        'background:' + colors[i % colors.length] + ';' +
        'animation:bk-confetti-fly 600ms ease-out ' + (i * 22) + 'ms forwards;';
      confettiContainer.appendChild(dot);
    }
  }

  // ── Mobile swipe-to-dismiss ──────────────────────────────
  function initSwipe() {
    var startY = 0, dragging = false;
    card.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY; dragging = true;
    }, { passive: true });
    card.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 0 && card.scrollTop === 0) {
        card.style.transition = 'none';
        card.style.transform = 'translateY(' + Math.min(dy * 0.65, 180) + 'px)';
      }
    }, { passive: true });
    card.addEventListener('touchend', function (e) {
      dragging = false;
      card.style.transition = '';
      if (e.changedTouches[0].clientY - startY > 80) {
        closeModal();
      } else {
        card.style.transform = '';
      }
    }, { passive: true });
  }

  // ── Boot ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
```

- [ ] **Step 8.2: Verify the file ends correctly**

```bash
tail -8 /Users/ambrosevoon/Projects/smartflow-automation/script.js
```

Expected: shows the final lines `}());` with no syntax errors visible.

- [ ] **Step 8.3: Open the site locally in a browser and confirm the modal opens**

```bash
open /Users/ambrosevoon/Projects/smartflow-automation/index.html
```

Click any "Book a Free Call" button. The modal should:
- Animate in with spring effect
- Show a loading spinner briefly
- Render a calendar for the current month

Check browser console for any JS errors (should be none).

- [ ] **Step 8.4: Commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add script.js
git commit -m "feat(frontend): add full booking JS module — calendar, slots, form, success"
```

---

## Task 9: Deploy and End-to-End Test

**Files:** None (push triggers Vercel auto-deploy)

- [ ] **Step 9.1: Push to GitHub (triggers Vercel production deploy)**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git push origin main
```

- [ ] **Step 9.2: Wait for Vercel deployment to complete**

```bash
# Check Vercel deployment status (requires Vercel CLI)
vercel ls --scope ambrosevoon-4152s-projects 2>/dev/null | head -5
```

Or open https://vercel.com/ambrosevoon-4152s-projects/smartflow-automation and wait for green "Ready".

- [ ] **Step 9.3: Run the full user journey on the live site**

Open https://smartflow-automation.vercel.app

1. Click "Book a Free Call" in the nav — modal animates in
2. Calendar renders showing current month. Weekends are greyed. Navigate to next month.
3. Click an available weekday — slides to time slot picker
4. Time pills cascade in with stagger animation. Click a slot.
5. Contact form appears with summary chip showing chosen date/time.
6. Fill in: name, email, phone, agency, optional message.
7. Click "Confirm Booking" — spinner shows, then success screen appears.
8. Animated circle draws, checkmark draws, "You're booked in!" bounces up, confetti bursts.
9. Check `ambrosevoon@gmail.com` — two emails should have arrived (customer confirmation + `[SMARTFLOW-BK1]` owner notification).

- [ ] **Step 9.4: Test double-booking prevention**

Reopen the modal and try to book the same slot just booked. The slot should not appear in the time picker (since the GET endpoint now returns it as booked).

- [ ] **Step 9.5: Test mobile bottom sheet on iPhone or DevTools mobile viewport**

At 375px width: modal should slide up from bottom, show drag handle, and respond to swipe-down gesture to dismiss.

- [ ] **Step 9.6: Update the SmartFlow project-map.md with final status**

In `/Users/ambrosevoon/Library/Mobile Documents/iCloud~md~obsidian/Documents/Ambrose-AI-OS/Efforts (active projects)/SmartFlow-Website/project-map.md`:

- Update "Next actions" to mark the booking system complete
- Add a new "Booking System" section documenting the n8n workflow ID, webhook URLs, and n8n data store

- [ ] **Step 9.7: Final commit**

```bash
cd /Users/ambrosevoon/Projects/smartflow-automation
git add -A
git commit -m "feat: complete SMARTFLOW-BK1 booking system — live on Vercel"
git push origin main
```

---

## Self-Review Checklist (completed inline)

- [x] **Spec coverage:** All spec sections covered — architecture (Tasks 1-5), UX flow (Tasks 6-8), visual design (Task 7 CSS), mobile (Task 7 mobile CSS + Task 8 swipe), n8n workflow (Tasks 1-5), CORS (Respond nodes headers), Gmail emails (Tasks 4-5)
- [x] **Placeholder scan:** No TBD/TODO. All code blocks complete. `GMAIL_CRED_ID` and `YOUR_N8N_API_KEY` are intentional runtime substitutions with instructions to resolve them.
- [x] **Type consistency:** `slotId()`, `fmtDate()`, `fmtTime()`, `eligibleSlots()` defined in Task 8 and used consistently throughout Task 8 only. n8n Code node uses `$workflow.staticData.bookings` consistently across Tasks 2, 3, 4 (same field name, same array structure).
- [x] **CSS class consistency:** All classes referenced in Task 6 HTML (`bk-overlay`, `bk-card`, `bk-step`, `bk-slot-pill`, etc.) are defined in Task 7 CSS. All JS DOM queries in Task 8 match IDs in Task 6 HTML.
