# Dawam (دوام) — Attendance & Payroll Hours App — Build Plan for Antigravity

> New standalone project in `D:\HR-Payroll` (not the old hr-payroll-app). Save this file as `D:\HR-Payroll\docs\PLAN.md`. Every prompt tells Antigravity to read it first.
> One phase per session, in order. Test in the browser (desktop + phone) after each phase, then commit.

---

## 1. Fixed decisions (Antigravity must NOT change these)

| Topic | Decision |
|---|---|
| Stack | Plain **HTML + CSS + JavaScript (ES modules)**. No React/Vue/Tailwind, no npm, no build step. Runs on GitHub Pages. |
| Mobile | **PWA** (installable on Android/iPhone home screen, works offline). Mobile-first design. |
| Data | **JSON**. Seed in `/data/db.json`; working copy in `localStorage`. ALL data access through `js/core/store.js` only. Export/Import JSON for backup + optional "Sync to GitHub". |
| Language | **Arabic (RTL) default + English (LTR)** toggle. All text in `/locales/ar.json`, `/locales/en.json`. No hard-coded UI text. CSS logical properties only. |
| Time | Local time only. NEVER use `toISOString()` for dates. All calculations in **minutes** (integers). |
| Style | Neon / cyber, dark default + light mode (section 5). |
| Libraries (CDN) | **SheetJS** for Excel export only. Nothing else. |

---

## 2. Screens

1. **Login** — username + password.
2. **Daily Attendance** (main screen) — search employee by **name or badge number**, choose date, clock-in, clock-out, Save. Two extra buttons: **Leave** and **Absent**. Shows the calculated result of that day immediately.
3. **Penalties** — choose employee, choose date, number of penalty days (0.5 steps allowed), optional reason. List of penalties with edit/delete.
4. **Employees** — add / edit / deactivate: name, badge number (unique), department (text), hourly rate (optional, for salary).
5. **Settings** — everything below is editable; lists can be added to / removed from / reordered.
6. **Monthly Report** — per employee per month: worked hours, OT, deductions, net hours (and salary if rate is set). Excel export.

Navigation: **bottom tab bar on phones** (Attendance, Penalties, Report, More), **sidebar on tablet/desktop**.

---

## 3. Settings (all editable)

| Setting | Example | Meaning |
|---|---|---|
| `shiftStart` | 08:00 | Official start |
| `shiftEnd` | 16:00 | Official end |
| `breakMinutes` | 30 | Deducted once per worked day |
| `graceMinutes` | 0 | Late below this = not late |
| `otCountedPer60` | 52 | Every 60 OT minutes count as 52 (i.e. 8 min cut). Applied proportionally: 30 min → 26 |
| `otMinMinutes` | 0 | OT less than this = 0 |
| `penaltyDayHours` | 4 | 1 penalty day deducts this many hours |
| `absentDayHours` | 8 | One absent day deducts this many hours |
| `leavePaid` | false | Leave day credited as 0 hours (no credit, no deduction) |
| `lateCounterReset` | "monthly" | Late counter restarts at late #1 at the start of every month; cycles inside month |
| `lateRules` | list | Ordered, cycling list (below) |
| `users` | list | Username, password (salted SHA-256), role `admin` / `entry` |

### Late rules — editable, ordered, cycling list
Each rule = `{ id, type, factor, hours, label }`. Admin can add, delete, edit, and drag/move up-down.

| `type` | Rule amount formula | Uses |
|---|---|---|
| `late_x` | lateMinutes × factor | factor |
| `remaining_x` | (shiftEnd − clockIn − breakMinutes) × factor | factor |
| `fixed_hours` | hours × 60 | hours |
| `full_day` | official day minutes (shiftEnd − shiftStart − break) | — |

**Total Loss Principle:** The rule amount is the **TOTAL loss**, including the late minutes already not worked.
`lateDeduction = max(0, ruleAmount − lateMinutes)`.
Example: shift 08:00, arrives 08:10, rule ×2 → total loss 20 min (10 min not worked + 10 min extra deduction), NOT 30.

Default list (the user's rules):
1. `late_x`, factor 2 → total loss = late time × 2 (extra deduction = late time)
2. `late_x`, factor 3 → total loss = late time × 3 (extra deduction = late time × 2)
3. `remaining_x`, factor 0.5 → total loss = (remaining official time − break) ÷ 2

**Cycling:** the Nth late of the month uses rule `((N − 1) mod rules.length)`. With 3 rules: late 4 → rule 1, late 5 → rule 2, late 6 → rule 3 …
When `lateCounterReset = "monthly"`, the counter restarts at late #1 at the start of every month.

---

## 4. Calculation engine (exact — `js/engine/calc.js`, pure functions, no DOM)

All values in minutes. `official = shiftEnd − shiftStart − breakMinutes`.

**Timeline Normalization (Night Shifts & Midnight Crossing):**
- If `shiftEnd <= shiftStart` (night shift): `shiftEnd += 1440`.
- For present day inputs:
  - If `out <= in`: `out += 1440` (crossed midnight).
  - For night shift matching: if `in < shiftStart - 720`: `in += 1440`, `out += 1440`.

**Present day** (in, out):
1. `worked = max(0, out − in − breakMinutes)`
2. `lateRaw = max(0, in − shiftStart)`; `isLate = lateRaw > graceMinutes`; `late = isLate ? lateRaw : 0`
3. If late (`late > 0`):
   - `lateNo` must be `>= 1` (if `< 1`, default to `1`).
   - `rule` = `lateRules[(lateNo − 1) % len]`
   - Compute `ruleAmount` based on rule type:
     - `late_x`: `round(late × factor)`
     - `remaining_x`: `round(max(0, shiftEnd − in − breakMinutes) × factor)`
     - `fixed_hours`: `hours × 60`
     - `full_day`: `official`
   - **Total loss principle:** `lateDeduction = max(0, round(ruleAmount − late))` (rule amount is the TOTAL loss, including late minutes already not worked).
   - If not late: `lateNo = 0`, `ruleUsed = null`, `ruleAmount = 0`, `lateDeduction = 0`.
4. `otRaw = max(0, out − shiftEnd)`; if `otRaw < otMinMinutes` → 0; `ot = round(otRaw × otCountedPer60 / 60)`
5. **Regular time (BUG 1 FIX):**
   `regular = max(0, min(out, shiftEnd) − max(in, shiftStart) − breakMinutes)`
   Only time strictly inside the official window counts as regular. Overtime after `shiftEnd` must NOT compensate for late minutes.
6. `net = regular + ot − lateDeduction`

**Attendance storage rule:**
NEVER store `lateNo` in attendance records. Always compute `lateNo` on the fly from the employee's records sorted by date (only counting days with status `"present"` and `late > grace`), so editing or inserting an earlier day correctly updates all subsequent days.

**Absent day:** `net = −absentDayHours × 60` (shown as deduction).
**Leave day:** `net = leavePaid ? official : 0` (default `leavePaid = false` → 0, no credit, no deduction).
**Penalties:** for the month, `penaltyDeduction = Σ days × penaltyDayHours × 60`.

**Month total per employee:**
`netMonth = Σ day.net − penaltyDeduction`
`salary = rate ? netMonth / 60 × rate : null`

Every day result returns a breakdown object `{worked, late, lateNo, ruleUsed, ruleAmount, lateDeduction, otRaw, ot, regular, net}` so the UI can show *why*.

### Required test cases (`/tests/calc.test.html`, shows ✅/❌)
Defaults: 08:00–16:00, break 30, grace 0, OT 52/60, rules [late×2, late×3, (remaining−break)×0.5], absentDayHours 8:
1. `08:00–16:00` → worked 450, net 450
2. `08:10–16:00, late #1` → worked 440, regular 440, ruleAmount 20, lateDeduction 10, net 430
3. `08:10–16:00, late #2` → worked 440, regular 440, ruleAmount 30, lateDeduction 20, net 420
4. `08:10–16:00, late #3` → ruleAmount (470−30)/2 = 220, lateDeduction 210, net 230
5. `08:10–16:00, late #4 in same month` → back to rule 1 → net 430
6. `2 lates in Nov + 1 late on 1 Dec` → Dec late is #1 → net 430
7. `08:00–17:00` → OT 52; `08:00–16:30` → OT 26
8. `absent` → −480; `leave` → 0
9. `night shift 22:00–06:00` handled (shift 22:00–06:00, break 30): worked 450, regular 450, net 450
10. `deleting rule 3` → late #3 uses rule 1
11. `lateNo < 1 safety test`: arrival 08:10 with `lateNo = 0` or missing defaults `lateNo = 1` safely
12. `late arriving employee with overtime`: 08:10–17:00, late #1 → regular 440, OT 52, lateDeduction 10, net 482 (not 492)
Plus additional edge cases (grace period, OT minimum threshold, penalty days with hourly rate, fixed_hours rule).

---

## 5. Design & UX rules

- **Mobile-first**: design for 360px first, then 768px, then 1280px+. No horizontal page scroll ever (only inside tables).
- Touch targets ≥ 44px; inputs font-size ≥ 16px (stops iPhone zoom); native `<input type="time">` / `type="date"`.
- Neon: background `#05070d` + subtle grid; accents cyan `#00f0ff`, magenta `#ff2bd6`, green `#39ff88`, amber `#ffb020`, red `#ff3b5c`. Glow on borders, headings, big numbers only — body text plain, contrast ≥ 4.5:1. Light theme with reduced glow. Respect `prefers-reduced-motion`.
- Fonts: Arabic **Tajawal**, numbers/headings **Orbitron**, body **Inter**.
- Every save → toast; every delete → confirm dialog; every form shows inline validation errors.
- Loading must feel instant: no heavy animations, no large images, fonts with `display=swap`.

---

## 6. Folder structure

```
/index.html
/manifest.webmanifest
/sw.js                       ← service worker (cache-first for app files)
/icons/icon-192.png, icon-512.png, maskable-512.png
/css/tokens.css base.css components.css layout.css
/js/app.js
/js/core/store.js i18n.js auth.js router.js ui.js dates.js
/js/engine/calc.js
/js/pages/login.js attendance.js penalties.js employees.js settings.js report.js
/locales/ar.json en.json
/data/db.json
/tests/calc.test.html
/README.md
```

## 7. JSON model (`/data/db.json`)

```json
{
  "meta": { "version": 2, "updatedAt": "" },
  "settings": {
    "shiftStart": "08:00", "shiftEnd": "16:00", "breakMinutes": 30, "graceMinutes": 0,
    "otCountedPer60": 52, "otMinMinutes": 0,
    "penaltyDayHours": 4, "absentDayHours": 8, "leavePaid": false,
    "lateCounterReset": "monthly",
    "lateRules": [
      { "id": "r1", "type": "late_x", "factor": 2 },
      { "id": "r2", "type": "late_x", "factor": 3 },
      { "id": "r3", "type": "remaining_x", "factor": 0.5 }
    ]
  },
  "users": [ { "id": "u1", "username": "admin", "salt": "", "hash": "", "role": "admin", "mustChange": true } ],
  "employees": [ { "id": "e1", "badge": "1001", "name": "", "department": "", "rate": null, "active": true } ],
  "attendance": [ { "id": "", "employeeId": "e1", "date": "2026-11-26", "in": "08:00", "out": "16:00", "status": "present", "note": "" } ],
  "penalties": [ { "id": "", "employeeId": "e1", "date": "2026-11-26", "days": 1, "reason": "" } ]
}
```
Rule: **one attendance record per employee per date** — saving again updates it.

> Security note (put in README): static JSON = no real server security. Keep the repo **private** if it contains real employee data. Passwords are salted SHA-256, never plain text.

---

## 8. Phases & prompts (copy into Antigravity, Planning mode)

### Phase 0 — Foundation + PWA shell
```
Read docs/PLAN.md fully. It is the source of truth; do not change section 1 decisions.

Phase 0 only:
1. The project folder is EMPTY (new project, D:\HR-Payroll). Create the folder structure in section 6 from scratch, plus .gitignore and git init.
2. Create docs/ and keep this PLAN.md inside it.
3. CSS: tokens.css (dark + light via [data-theme]), base.css, components.css (button, input, select, card, table, badge, toast, modal, confirm, tabs, segmented control, search-with-suggestions), layout.css (bottom tab bar < 768px, sidebar ≥ 768px). Follow section 5 strictly. Logical properties for RTL.
4. js/core: i18n.js (t, setLang, sets html lang/dir, remembers choice), store.js (load from localStorage else fetch /data/db.json; list/get/insert/update/remove; exportJSON; importJSON with validation; syncToGitHub via Contents API with token stored in localStorage only), router.js (hash routes), ui.js (toast, modal, confirm), dates.js (toLocalDate without toISOString, hhmmToMin, minToHHMM, minToHoursLabel, monthRange).
5. data/db.json with section 7 schema + 8 sample employees with Arabic names and badge numbers.
6. PWA: manifest.webmanifest (name "Dawam", Arabic short name, dark theme color, standalone), sw.js cache-first for all app files with versioned cache name, register in app.js, generate the 3 icons (neon clock style).
7. index.html shell with header (title, language toggle, theme toggle) and empty routes for every page in section 2.

Acceptance: no console errors; installable (Lighthouse PWA check); works offline after first load; AR/EN and dark/light toggles work; screenshots at 360px, 768px, 1280px.
```

### Phase 1 — Login + Employees
```
Read docs/PLAN.md. Reuse the Phase 0 core modules; don't rewrite them.

Phase 1:
1. auth.js + pages/login.js: salted SHA-256 (Web Crypto), session in sessionStorage, logout, route guard. Seed admin/admin123 with mustChange=true → force password change screen on first login. Roles: admin = everything; entry = Attendance + Penalties + Report only (hide other tabs).
2. pages/employees.js: list as cards on mobile, table on desktop; search by name or badge; add/edit in a modal (name, badge unique, department, hourly rate optional); deactivate instead of delete (with confirm). Validation messages inline.
3. User management inside Settings > Users (admin only): add user, role, reset password, delete (cannot delete yourself or the last admin).

Acceptance: wrong password shows a clear error; entry role can't open Employees/Settings even by typing the URL.
```

### Phase 2 — Settings + calculation engine
```
Read docs/PLAN.md sections 3 and 4 carefully.

Phase 2:
1. js/engine/calc.js: pure functions calcDay(record, settings, lateNo), buildMonth(employeeId, yyyy_mm, db) and the late counter logic with cycling and monthly reset, exactly as section 4. No DOM, no store access inside calcDay.
2. tests/calc.test.html: implement ALL cases listed in section 4 plus 5 more edge cases. All must pass.
3. pages/settings.js (admin), grouped cards:
   - Official hours: start, end, break minutes, grace minutes (show computed "official day = X h Y m").
   - Overtime: "every 60 minutes count as [52]" + minimum OT minutes, with a live example line ("2h OT → 1h 44m").
   - Penalties: penalty day hours, absent day hours, leave paid on/off.
   - Late rules: ordered list; each row = number badge, type select (late × factor / (remaining − break) × factor / fixed hours / full day), value input, move up/down, delete. "Add rule" button. A live preview: "If an employee arrives at [08:10] for the Nth time this month → deduction = …" for N = 1..(rules+1) to show the cycling.
   - Late counter reset: monthly / never.
   - Data: Export JSON, Import JSON (confirm), Sync to GitHub (owner, repo, path, token).
   - Save button disabled until something changes; "unsaved changes" warning when leaving.

Acceptance: test page all green; changing a rule updates the preview instantly.
```

### Phase 3 — Daily Attendance screen (most important)
```
Read docs/PLAN.md. Phase 3: pages/attendance.js — the main screen, must be very fast to use on a phone.

Layout (top to bottom on mobile; two columns on desktop: form left, day list right):
1. Search box: type name OR badge number → instant suggestions (name + badge + department). Selecting shows a compact employee card. Keyboard: Enter picks the first suggestion.
2. Date picker with ◀ ▶ buttons for previous/next day, default today.
3. Clock-in and clock-out time inputs (large). Pre-fill with shiftStart/shiftEnd when empty.
4. Live result panel under the inputs (from calc.js): worked, late (and "late #N → rule"), OT counted, deduction, net — color-coded.
5. Buttons: primary "Save"; secondary "Leave" and "Absent" (each asks for confirm and saves the day with that status, clearing times).
6. If a record already exists for that employee+date → load it into the form and show "Editing existing record" + a Delete button.
7. Below: list of everyone recorded on the selected date (name, badge, in, out, status badge, net); tap a row to load it into the form. Filter: all / present / late / absent / leave.
8. After saving, keep the date, clear the employee, focus the search box (fast entry for the next person).

Acceptance: entering a full day for one employee takes ≤ 4 taps after search; works at 360px width without horizontal scroll.
```

### Phase 4 — Penalties screen
```
Read docs/PLAN.md. Phase 4: pages/penalties.js.
1. Form: employee search (same component as attendance — reuse it, don't duplicate), date picker, penalty days (number, step 0.5, > 0), reason (optional). Show "= X hours deducted" live from settings.penaltyDayHours.
2. List of penalties for the selected month with filters (employee, month); edit and delete with confirm.
3. Entry role can add; only admin can delete.
```

### Phase 5 — Monthly report + polish
```
Read docs/PLAN.md. Phase 5:
1. pages/report.js: pick month (+ optional employee). Summary table per employee: days present, lates count, absences, leaves, worked hours, OT counted, late deductions, penalty deductions, net hours, salary (if rate). Totals row. Tap employee → day-by-day breakdown with the "why" (rule used) for each day.
2. Export to Excel (SheetJS) with Arabic headers, one sheet summary + one sheet details.
3. Polish: check every screen at 360/768/1280px, AR+EN, dark+light; no console errors; Lighthouse PWA + accessibility ≥ 90; bump service-worker cache version; write README (how to run, install on phone, backup, security note).
```

---

## 9. Rules for every Antigravity session
- Read `docs/PLAN.md` first. Don't change stack, structure, data model, or formulas without asking.
- One phase per session; don't start the next.
- No direct localStorage outside `store.js`; no hard-coded text; engine stays pure.
- Reuse components (employee search, time inputs) — no copy-paste duplicates.
- Finish by listing changed files and exact steps to test.
