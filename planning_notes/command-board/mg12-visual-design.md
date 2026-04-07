# MG12 — Major Incident Command Board: Visual Design

**Aesthetic:** Pixel-art incident command system. Clinical gravity — this is not a game toy, it is a wartime operations board. Dark background, tight typography, colour used only to signal severity.

---

## Overall Layout

Landscape panel (matches the 16:9 wall-mounted screen in the Major Incident Room). Full-panel overlay with no inner scroll outside the timeline pane.

```
┌─────────────────────────────────────────────────────────────────┐
│ [×]  NORTHGATE GENERAL HOSPITAL — MAJOR INCIDENT RESPONSE  ●●●● │  ← header bar
├────────────────────────────────────┬────────────────────────────┤
│                                    │                            │
│   INCIDENT TIMELINE                │   SYSTEM STATUS            │
│   ─────────────────                │   ─────────────            │
│   [entry tile]                     │   [status row]             │
│   [entry tile]                     │   [status row]             │
│   [entry tile]                     │   [status row]             │
│   [entry tile]                     │   [status row]             │
│   [entry tile]                     │   [status row]             │
│   ...  (scrollable)                │                            │
│                                    │                            │
├────────────────────────────────────┴────────────────────────────┤
│  [LOG DECISION OR ACTION ______________________________] [POST]  │  ← entry bar
└─────────────────────────────────────────────────────────────────┘
```

**Column widths:** Timeline ~62% / Status ~38%  
**Minimum height:** 540px  
**Font:** `'Press Start 2P'` for headers and labels; `'VT323'` for timestamps and status values

---

## Colour Palette

| Token                 | Hex       | Usage                                     |
| --------------------- | --------- | ----------------------------------------- |
| `--cb-bg`             | `#0e1322` | Panel background                          |
| `--cb-panel-border`   | `#2a3550` | Panel outer border                        |
| `--cb-header-bg`      | `#0a0f1e` | Header strip background                   |
| `--cb-header-text`    | `#c8d8ff` | Header title text                         |
| `--cb-divider`        | `#1e2d48` | Column divider, section borders           |
| `--cb-section-title`  | `#7090c0` | Section header text ("INCIDENT TIMELINE") |
| `--cb-timestamp`      | `#d4a84b` | Entry timestamp (amber)                   |
| `--cb-entry-bg`       | `#121b2e` | Default entry tile background             |
| `--cb-entry-border-l` | `#2a3a5a` | Default left border on entry tile         |
| `--cb-manual-badge`   | `#2a4a6a` | MANUAL badge background                   |
| `--cb-auto-badge`     | `#1a2e1a` | AUTO badge background                     |
| `--cb-entry-bar-bg`   | `#0a0f1e` | Manual entry bar background               |
| `--cb-input-border`   | `#2a3a5a` | Entry field border                        |
| `--cb-post-btn`       | `#1a3a1a` | POST button background                    |
| `--cb-post-btn-text`  | `#39c164` | POST button text                          |
| Status: green         | `#39c164` | OPERATIONAL                               |
| Status: amber         | `#d4a84b` | DEGRADED / ISOLATED / RESTORING           |
| Status: red           | `#e04060` | OFFLINE / ACTIVE / COMPROMISED / CRITICAL |
| Status: grey          | `#4a5a70` | UNKNOWN / not yet triggered               |

---

## Header Bar

Full-width strip, 48px tall. Background `--cb-header-bg`.

**Left side:** Pixel-art "X" close button (standard minigame close, top-left per framework convention — already handled by `base-minigame.js`).

**Centre:** `NORTHGATE GENERAL HOSPITAL — MAJOR INCIDENT RESPONSE` in `'Press Start 2P'` 9px, colour `--cb-header-text`. All caps.

**Right side:** Three-dot status indicator. Rendered as three small circles (8px diameter, 4px gap). Initial state: first dot red (flashing at 0.5 Hz), others amber. Once `ico_notified = true`: all three green (steady). This is purely decorative — it gives the sense of a live connected system.

Below the header: a 2px border in `#e04060` (critical red) that pulses in opacity when a `critical`-type entry is appended. The pulse is a CSS animation: `opacity 0.5s ease-in-out 3 alternate` — three flashes, then steady.

---

## Incident Timeline Column

### Section header

`INCIDENT TIMELINE` in `'Press Start 2P'` 8px, `--cb-section-title`. Under it: `auto-updating — global state driven` in `'VT323'` 14px, `#4a5a70`.

### Entry tile

Each timeline entry is a `div.cb-entry-tile`:

```
┌──┬────────────────────────────────────────────────┬────────┐
│  │ [Mon 22:38]  MAJOR INCIDENT DECLARED — ...      │ [AUTO] │
└──┴────────────────────────────────────────────────┴────────┘
```

- **Left border strip** (4px wide): colour varies by entry type (see Type Colours below)
- **Timestamp** (left, `'VT323'` 18px, `--cb-timestamp`): e.g. `Mon 22:38`
- **Event text** (`'Press Start 2P'` 7px, `#b0c0e0`): the entry text content
- **Source badge** (right, small pill): `[AUTO]` in `--cb-auto-badge` / `[MANUAL]` in `--cb-manual-badge` / no badge for preseed

**Tile background:** `--cb-entry-bg`. On append (slide-in animation): tile slides in from the left over 200ms, ease-out.

**Ordering:** Newest entries at the top. Pre-seeded entries at the bottom.

**Scroll:** Timeline list is `overflow-y: scroll` within its column. Custom scrollbar: 4px wide, `--cb-divider` track, `--cb-section-title` thumb.

### Entry type → left border colour

| Type       | Colour                                  | Description                     |
| ---------- | --------------------------------------- | ------------------------------- |
| `security` | `#e04060` (red)                         | Attacker action, security event |
| `clinical` | `#c8a000` (gold/amber)                  | Clinical impact event           |
| `response` | `#39c164` (green)                       | Responder action taken          |
| `decision` | `#5090e0` (blue)                        | Governance/regulatory decision  |
| `critical` | `#ff2040` (bright red, flashing border) | Patient safety/death events     |
| `preseed`  | `#2a3a5a` (dark grey/blue)              | Pre-incident entries            |

`critical`-type entries additionally have a flashing left border animation (1Hz, red ↔ dark red).

---

## System Status Column

### Section header

`SYSTEM STATUS` in `'Press Start 2P'` 8px, `--cb-section-title`.

### Status row

Each row:

```
┌─────────────────────────────────────────────────┐
│  EHR SYSTEM                     [OFFLINE]        │
└─────────────────────────────────────────────────┘
```

- **Row label** (`'Press Start 2P'` 7px, `#7090c0`): system name
- **Status badge** (`'Press Start 2P'` 7px, padded pill): text and colour vary by state (see Status Colours)
- **Separator line** between rows: 1px, `--cb-divider`

**Badge states:**

| State       | Badge text    | Badge background | Text colour          |
| ----------- | ------------- | ---------------- | -------------------- |
| OPERATIONAL | `OPERATIONAL` | `#0d2e1a`        | `#39c164`            |
| DEGRADED    | `DEGRADED`    | `#2e1e00`        | `#d4a84b`            |
| OFFLINE     | `OFFLINE`     | `#2e0a10`        | `#e04060`            |
| ISOLATED    | `ISOLATED`    | `#2e1e00`        | `#d4a84b`            |
| RESTORING   | `RESTORING`   | `#1a1e2e`        | `#6090d0`            |
| COMPROMISED | `COMPROMISED` | `#2e0a10`        | `#e04060`            |
| REINFECTED  | `REINFECTED`  | `#3e0a10`        | `#ff2040`            |
| ACTIVE      | `ACTIVE ⚠`    | `#2e0a10`        | `#ff2040` (flashing) |
| CLEAN       | `CLEAN`       | `#0d2e1a`        | `#39c164`            |
| CONNECTED   | `CONNECTED`   | `#0d2e1a`        | `#39c164`            |
| UNKNOWN     | `UNKNOWN`     | `#1a1e28`        | `#4a5a70`            |

Status badge updates should animate: the badge background briefly flashes white (50ms) then fades to the new colour. This signals a state change without audio.

### Status rows (order)

1. **EHR SYSTEM** — driven by `ehr_status` string + `backup_recovery_source` + `backup_reinfected`
2. **WARD 7 MONITORING** — driven by `ward_monitor_status` (`ONLINE`/`STALE`/`OFFLINE`; starts `OFFLINE` on scenario load)
3. **FLEET CONSOLE** — driven by `fleet_console_status` + `drug_library_compromised`
4. **NETWORK** — driven by `network_isolated` boolean
5. **RANSOMWARE** — driven by `ransomware_deployed` boolean (starts ACTIVE on scenario load, since ransomware is pre-deployed)

Compatibility note for implementation: if older scenario/state payloads are present, allow fallback reads from `central_station_ward7_status` and derived restore status from `backup_restore_initiated`.

Compatibility note for legacy value sets: normalize `backup_recovery_source` values from `cloud_vendor|nas_encrypted|tape_wiped` to canonical `CLOUD|NAS|TAPE` before applying status badges and timeline text.

---

## Manual Entry Bar

Full-width strip at the bottom, 44px tall. Background `--cb-entry-bar-bg`. 1px top border `--cb-divider`.

**Input field:** `width: calc(100% - 100px)`. Placeholder text `LOG DECISION OR ACTION`. Background `#0a0f1e`. Border `1px solid --cb-input-border`. Text colour `#b0c0e0`. Font `'VT323'` 18px. No rounded corners. Pixel-art feel: thin border, flat appearance.

**POST button:** 80px wide. Label `POST`. Background `--cb-post-btn`. Text `--cb-post-btn-text`. `'Press Start 2P'` 7px. On hover: background `#2a5a2a`. On click: brief green flash (100ms opacity pulse).

Pressing Enter in the input field triggers the same action as clicking POST.

Empty or whitespace-only input: POST is disabled (grey, non-interactive).

---

## Animations

| Animation               | Trigger                           | Spec                                                    |
| ----------------------- | --------------------------------- | ------------------------------------------------------- |
| Entry slide-in          | New entry appended                | `translateX(-20px) → translateX(0)`, 200ms, ease-out    |
| Critical header pulse   | Entry of type `critical` appended | Header bottom border: red → dark, 3 pulses × 500ms      |
| Status badge flash      | Any status row updates            | Badge bg: white → target colour, 50ms → 200ms           |
| Ransomware ACTIVE badge | `ransomware_deployed = true`      | CSS animation: `opacity 1 ↔ 0.5`, 1s interval, infinite |
| Critical entry border   | `type === 'critical'`             | Left border: bright red ↔ dark red, 1Hz, infinite       |
| Manual POST flash       | POST clicked                      | Button bg: green flash, 100ms                           |

All animations use CSS classes toggled by JS — no inline style manipulation except for dynamic status badge colours.

---

## Responsive / Physical Room Notes

The board is designed for a 40–55" wall-mounted monitor at typical reading distance (1.5–2m). Font sizes are set accordingly:

- `'Press Start 2P'` at 7–9px renders as large, clearly legible pixel text at monitor scale
- `'VT323'` at 18px renders as crisp monospace terminal text

For digital-only play (browser window, smaller screen), the panel should scale proportionally via `transform: scale(0.85)` on the outer container if the viewport is below 1200px wide. No media queries inside the minigame CSS — scaling is handled at the container level by the framework.

---

## CSS File Structure

`public/break_escape/css/command-board-minigame.css`:

```css
/* Container */
.command-board-container { ... }
.command-board-game-container { ... }

/* Panel */
.cb-panel { ... }
.cb-header { ... }
.cb-header-title { ... }
.cb-status-dots { ... }
.cb-status-dot { ... }
.cb-critical-pulse { ... }   /* animation class added/removed on critical entry */

/* Body layout */
.cb-body { ... }
.cb-timeline-col { ... }
.cb-status-col { ... }
.cb-col-divider { ... }

/* Timeline */
.cb-section-title { ... }
.cb-timeline-list { ... }
.cb-entry-tile { ... }
.cb-entry-tile.slide-in { ... }   /* animation */
.cb-entry-left-bar { ... }
.cb-entry-timestamp { ... }
.cb-entry-text { ... }
.cb-entry-badge { ... }
.cb-entry-badge.auto { ... }
.cb-entry-badge.manual { ... }

/* Entry type colours (applied as classes on .cb-entry-left-bar) */
.type-security { ... }
.type-clinical { ... }
.type-response { ... }
.type-decision { ... }
.type-critical { ... }
.type-preseed { ... }

/* Status panel */
.cb-status-list { ... }
.cb-status-row { ... }
.cb-status-label { ... }
.cb-status-badge { ... }
.cb-status-badge.flash { ... }   /* brief animation class */

/* Manual entry bar */
.cb-entry-bar { ... }
.cb-entry-input { ... }
.cb-post-btn { ... }
.cb-post-btn:disabled { ... }
```
