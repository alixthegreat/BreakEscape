# UX Review — BreakEscape × Hacktivity Game Integration
**Reviewer:** Senior UX/Product
**Date:** 2026-03-28
**Plan revision reviewed:** Revision 3

---

## Overview and Framing

The core tension in this integration is that BreakEscape is a *narrative game* while Hacktivity was designed around *technical challenge labs*. The existing UI vocabulary — "challenges", "VM sets", "activate", "relinquish" — is accurate for CTF boxes but will feel foreign and anxiety-inducing to someone who just wants to play a game. Every recommendation below is driven by one principle: **the game is the interface; Hacktivity is the backstage**.

Players should not need to understand that VMs exist. They should experience something closer to: "I clicked Play, the game loaded, I played, I finished." The technical machinery happens behind that curtain.

---

## 1. Event Listing Page — Tile View

### Current Pattern

The `_tile.html.erb` partial applies a CSS class derived from `type_of_hacktivity` to drive background/badge styling, shows a hero image, title, date, org, and a sign-up button. There is no type label visible to the user — differentiation is entirely visual through the CSS class.

### Problem

Adding `game` as a type without any explicit label means users see tiles that look like course or experience tiles with a different background tint. Given that games have a fundamentally different interaction model (narrative, room exploration, no raw flag submission), users need a stronger signal.

### Recommendation

**Add a type badge to every tile.** Position it as an overlay on the hero image, top-left corner, using a pill/badge component. Use consistent iconography across the platform:

- Course: `fa-solid fa-book` + "Course"
- Experience (CTF): `fa-solid fa-terminal` + "Experience"
- Game: `fa-solid fa-gamepad` + "Game"

ASCII mockup of the tile with badge:

```
+------------------------------------------+
|  [Game]  (badge, top-left)               |
|                                          |
|        hero image                        |
|                                          |
|  Operation: First Contact                |
|  ----------------------------------------|
|  Mar 2026 – Jun 2026   Leeds Beckett     |
|  [Sign Up]                               |
+------------------------------------------+
```

The `game` CSS class should also use a distinct colour palette — recommend a deep purple/indigo rather than the orange/teal used for experiences, to signal "different kind of engagement" without looking like a downgrade.

**Why a badge instead of relying on colour alone:** Colour alone fails accessibility (colour-blind users, low-contrast displays) and fails users new to the platform who haven't learned the visual grammar yet. The badge makes the type legible in a glance.

**For the event index filter bar:** If the platform has or adds type filters (Course / Experience / Game), this naturally extends to that. If no filter bar exists today, that is out of scope but worth noting as a future addition when the game catalogue grows.

### Additional tile consideration: sign-up vs. enrol vs. play

For game-type events that are open-to-all or open-to-individual-subscriptions, the sign-up button text should be "Enrol" not "Sign Up" — games feel more like courses (you enrol in a campaign) than events (you sign up to attend). This is a copy change only; no functional difference.

---

## 2. Event Show Page — Mission/Game Slot List

### Current Pattern

`show.html.erb` renders `sec_gen_batches` as a flat list under a "Challenges" section header. Each batch is an accordion/panel with full scenario metadata, VM controls, and scoreboards. The section is gated behind sign-up.

For a game event, this section becomes the mission select screen. The "Challenges" label is wrong; the VM panel must be hidden; the scoreboards are irrelevant per-slot.

### Recommendation: Replace the Challenges section with a "Missions" section for game events

Branch the rendering logic in `show.html.erb`: if `@event.hacktivity_type_game?` (or whatever the predicate becomes), render a game-specific partial instead of `sec_gen_batches/list_display`.

**Section header:** Replace "Challenges" with "Missions".

**Layout:** Use a card grid rather than an accordion list. Cards work better for narrative content — they allow cover art, synopsis text, and status at a glance without expanding panels. Use a single-column layout on mobile, two columns on tablet, three columns on wide screens.

**Card anatomy:**

```
+---------------------------------------+
|  [cover image or mission icon]        |
|                                       |
|  Mission 01: First Contact            |
|  [Difficulty: Intermediate]           |
|  [~45 min]                            |
|                                       |
|  You've intercepted a suspicious      |
|  email. Someone on the inside is      |
|  leaking data. Find out who.          |
|                                       |
|  [STATUS BADGE]   [ACTION BUTTON]     |
+---------------------------------------+
```

**Status states and their display:**

| State | Badge | Badge colour | Action button |
|---|---|---|---|
| Not started | "Not started" | neutral grey | "Play" (primary) |
| In progress | "In progress" | amber | "Continue" (primary) |
| Completed | "Completed" | green | "View" (secondary, links to game — read-only or review mode if supported) |
| Locked (future release_at) | "Available [date]" | muted blue | "Locked" (disabled) |
| No VMs available | "Unavailable" | red | "Notify me" (if supported) or disabled "Play" with tooltip |

**Locked state — important nuance:** Do show locked missions in the list. Hiding them entirely creates confusion ("I heard there were five missions but I only see two"). Show them as locked cards with the unlock date. This also creates anticipation, which is good for engagement in a narrative game.

**Information surfaced per card:**

- Mission title (from `GameSlot` / `BreakEscape::Mission`)
- Difficulty (from mission metadata — recommend Beginner / Intermediate / Advanced rather than numeric)
- Estimated time (from mission metadata)
- Short synopsis / logline (1–2 sentences, not a spoiler)
- Position/sequence number ("Mission 01") — important for narrative games where order matters

**What to omit from the card:**

- Scenario name (internal)
- VM set IDs (internal)
- Batch ID (internal)
- Any raw SecGen metadata

**Sequence indicator:** For narrative games with a fixed progression, show a visible sequence. A simple "01 / 02 / 03" numbering in the card header communicates that these are chapters, not a random collection. If sequential lock-gating is implemented later (mission 2 unlocks after mission 1 completion), this layout supports that naturally.

**Release schedule:** Retain the release calendar section but rename it "Mission Release Schedule" and only show it if some missions have future `release_at` dates. Don't show it if all missions are already available.

---

## 3. Starting a Game — The Ideal Flow

### Current Flow (CTF)

User clicks "Claim VM Set" → VM is assigned → User manually clicks "Activate and start challenge" → VMs boot → User reads the challenge brief → User opens VMs via the RDP/VNC links.

This is a 4-step manual process appropriate for technical users who want control. It is wrong for a game.

### Recommended Flow for Games

**Target experience:** One button. "Play." Everything else happens automatically and transparently.

```
User clicks [Play] on mission card
    |
    v
POST /hacktivities/:event_id/missions/:id/start
    |
    +-- VM-free mission?
    |       |
    |       v
    |   Game created immediately
    |   Redirect to /break_escape/games/:id
    |
    +-- VM-backed mission?
            |
            v
        Assign VM set (instant — VMs are pre-built)
        Create Game record
        Auto-activate VM set (fire activate_and_start inline or via fast job)
        Redirect to /break_escape/games/:id
```

**Loading state:** The redirect to the game should happen before VM activation completes, because the game itself can handle "VMs not yet active" gracefully (see Section 4). Don't make the user stare at a Hacktivity loading spinner while VMs boot — get them into the game UI as fast as possible and let the game communicate status.

However, if the controller action itself takes more than ~300ms (unlikely since assignment is instant), show an inline loading state on the "Play" button: disable the button, replace label with "Starting..." and a spinner. This prevents double-clicks and tells the user something is happening.

**Error states:**

- **No VMs available:** Do not redirect to the game. Show an inline error on the mission card:
  ```
  Sorry, this mission is currently at capacity.
  Try again in a few minutes, or contact support.
  ```
  Do not use a flash message that disappears — this needs to be visible long enough to act on.

- **Already has an active game (race condition / double-click caught by DB unique index):** Redirect to the existing game silently. The user just ends up in their game. No error needed.

- **Event sign-up lapsed / org revoked:** Show a clear explanation page, not a raw Rails error. "You're no longer enrolled in this event. Contact [support] to re-enrol."

**"Continue" for in-progress games:** When the user has an `in_progress` game, the card shows "Continue" not "Play". Clicking "Continue" hits the same `start` action, which detects the existing game via `active_game_for` and redirects to it. No new VM assignment. This is already handled correctly in the plan — the UX just needs the button label to match the intent.

---

## 4. VM Activation and Quota — The Core UX Problem

This is the highest-stakes UX problem in the integration. Getting it wrong will cause players to lose progress without warning, or to have their attacks fail mid-investigation with no explanation.

### Recommendation: Auto-activate + In-game HUD overlay + Heartbeat extension

#### 4.1 Auto-activate on game start

When `GameSlotsController#start` creates the game for a VM-backed mission, it should immediately call `activate_and_start` on the assigned VM set — do not wait for the user to manually activate. From the player's perspective, "starting the mission" and "activating the VMs" are the same action. There is no reason to separate them.

Implement this as a synchronous call in the controller (not a job) so that `activated_until` is set before the redirect. The game's first heartbeat call (see below) then has a valid `activated_until` to report.

#### 4.2 In-game HUD overlay

The game runs full-screen at `/break_escape/games/:id`. The raw VM control panel in Hacktivity must not be shown. Instead, surface VM status inside the game via a minimal, non-intrusive HUD element.

**Design: a persistent status bar at the bottom of the game screen (or a collapsible corner widget)**

```
+------------------------------------------------------------+
|  BREAKESCAPE GAME CANVAS                                   |
|                                                            |
|                                                            |
|                                                            |
|                                                            |
+------------------------------------------------------------+
| [green dot] Systems online   |  42m remaining  [+1 hour]  |
+------------------------------------------------------------+
```

States of the status bar:

| VM state | Dot colour | Text | Action |
|---|---|---|---|
| Active, >30 min left | Green | "Systems online" | Show time, no action needed |
| Active, 10–30 min left | Amber | "Systems online — X min remaining" | "[+1 hour]" button prominent |
| Active, <10 min left | Red (pulsing) | "Systems shutting down in X min" | "[Extend now]" button urgent |
| Inactive / shutdown | Red (solid) | "Systems offline" | "[Restart systems]" button |
| VM-free mission | Hidden | (not shown) | n/a |

**The "[+1 hour]" / "[Extend now]" button** fires the existing `activate_and_start` endpoint (which serves as "extend activation time" when already activated). This is an AJAX/Turbo call that does not navigate away from the game. On success, the status bar updates to show the new `activated_until` time.

**Why not a modal?** Modals interrupt the game and are disorienting. The status bar is always visible but unobtrusive — it's glanceable. The only time it demands attention is when it turns red and pulses.

#### 4.3 Heartbeat extension

Recommend a client-side heartbeat: every 20 minutes (or when the player submits a flag, which is clear evidence of active engagement), the game's JavaScript silently calls the extend-activation endpoint.

**Conditions for auto-extend:**
- VMs are currently active
- `activated_until` is less than 30 minutes away
- The tab/window is visible (use Page Visibility API — don't extend for tabs left open unattended)

This eliminates the most common failure mode: a player who is deeply focused on the game and simply doesn't notice the timer running down. Auto-extend means they never lose their session due to inattention.

**Quota ceiling concern:** The existing quota system presumably has an upper limit on total activation time (the event end date, or a per-user cap). The heartbeat respects this — if the server rejects the extension because quota is exhausted, the status bar shows the remaining time without the extend button. The player knows their time is truly limited and can plan accordingly.

#### 4.4 What happens when VMs shut down mid-game (graceful degradation)

If VMs shut down (quota expired, manual shutdown, failure), challenges that require VM connectivity will return errors or connection timeouts. The game should not silently hang.

**Recommendation:** The game's challenge submission/connection layer should catch connection failures and show an in-game notification:

```
[!] Target system is offline.
    Your mission progress is saved.
    [Restart Systems] [Save and Exit]
```

This uses game-world language ("target system") rather than technical language ("VM"). It keeps the player in the fiction while communicating the real situation.

The "Restart Systems" button calls the activate endpoint. "Save and Exit" returns to the event show page.

**Explicitly out of scope for the initial release:** Full offline-mode for VM-free puzzles when a VM-backed mission loses connectivity. That requires per-challenge graceful degradation in the game engine itself.

---

## 5. Restart Flow

### Current Plan

`GameSlotsController#restart` reverts VMs asynchronously and calls `game.reset_player_state!` (which resets progress but keeps `in_progress` status), then redirects to the game immediately.

### The Problem

The user is redirected into the game while VMs are still reverting. If they immediately try to connect to a challenge target, they will hit the pre-revert snapshot or a temporarily unreachable VM. This is confusing and could be mistaken for a game bug.

### Recommendation: Interstitial lock screen within the game

Do not redirect to the game canvas immediately after restart. Instead:

1. Redirect to the game path, but the game detects a `reverting` flag in the player state (set by `reset_player_state!`) and renders a lock screen overlay instead of the playable canvas.

2. The lock screen shows:

```
+------------------------------------------+
|                                          |
|        [animated loading icon]           |
|                                          |
|   Resetting mission systems...           |
|                                          |
|   This usually takes 2-3 minutes.        |
|   Your progress has been cleared.        |
|                                          |
|   [This message will clear when ready]   |
|                                          |
+------------------------------------------+
```

3. The game polls a lightweight status endpoint (e.g., `GET /break_escape/games/:id/status`) every 10 seconds. The endpoint returns whether the VM set's VMs have returned to a `powered_off` or `up` state (post-revert). When all VMs are ready, the game clears the `reverting` flag from player state, hides the lock screen, and the player can begin.

**Fallback:** If the poll hasn't resolved after 5 minutes, show a message: "Systems are taking longer than expected. [Refresh] or [Contact support]."

**Why not a separate Hacktivity page for the wait?** Keeping the wait experience inside the game's full-screen UI maintains immersion and doesn't expose the underlying infrastructure. The player sees "mission systems resetting" not "VM revert in progress."

**Alternative approach if in-game polling is too complex for initial release:** Redirect to the event show page after restart with a flash: "Mission reset. VMs are reverting — please wait 2–3 minutes before resuming." The mission card shows "Resetting..." status during the revert window (requires a `reverting` status on GameSlot or the game record). This is less polished but ships faster. I recommend this as the v1 approach and the in-game polling as a v2 improvement.

---

## 6. Relinquish — "I'm Done With This Mission"

### Current Pattern

"Relinquish" is a technical term from server resource management. The existing confirmation dialog explains it accurately: "VMs will no longer be available, and this cannot be reversed. Thank you. This helps us manage server resources." This transparency is honest but it's the wrong register for a game player.

### Recommendation: Rename and reframe as "Finish Mission"

Do not expose the word "relinquish" to game players at all.

**Where to surface it:** Inside the game, as an in-game menu option: "Finish Mission / I'm done." Not in the VM control panel (which is hidden). Optionally, also on the mission card on the event show page once the game is completed.

**Confirmation dialog (game-world framing):**

```
Mission Debrief

You've completed your investigation.
Ready to stand down?

Your progress and any flags you've captured
are permanently saved to your record.

The mission systems will be shut down and
reassigned. You won't be able to return to
this investigation.

[Stand Down]   [Keep Investigating]
```

The technical reality (VMs freed, irreversible) is communicated, but in language that fits the fiction and avoids the word "relinquish."

**When to offer it:**
- After mission completion (game status = `completed`): always offer it.
- During an in-progress game: offer it, but with a stronger warning ("You haven't completed the mission yet. Your progress will be lost.").

**What happens after "Stand Down":**
- `relinquish` action fires on the VM set
- Game status is set to `completed` if not already (or a new `abandoned` status, if that distinction matters for scoring)
- Redirect to the event show page with mission card showing "Completed" (or "Abandoned")

**Automatic relinquish:** For completed games where the player has not manually stood down, consider an automatic relinquish after 7 days of inactivity. This is the existing Hacktivity auto-relinquish behaviour and should carry over. The player does not need to know this happens; VMs are already freed by the quota system long before 7 days.

---

## 7. Admin UX

### 7.1 Game Slot Admin Form

The `GameSlot` has: `event`, `break_escape_mission`, `sec_gen_batch` (optional), `position`, `release_at`.

**Form layout recommendation:**

```
Mission Listing

  Mission *
  [dropdown: select BreakEscape mission]   [Preview mission]

  VM Batch (optional)
  [dropdown: select SecGenBatch]
  [hint: Leave blank for VM-free missions]

  Display order *
  [number input]   [hint: Lower numbers appear first]

  Release date (optional)
  [datetime picker]
  [hint: Leave blank to release immediately when the event starts.
   Set a future date to lock this mission until that date.]

  [Save]   [Cancel]
```

**Key form UX points:**

- The `sec_gen_batch` field should show only batches belonging to the same event, with a label indicating VM availability ("Mission 01 — 28 sets available" or "No VMs available — build more first"). This prevents admins from selecting a batch with zero built VMs.

- `position` should be a simple integer field with a hint. Do not introduce a drag-and-drop reorder widget for v1 — it adds JS complexity for a low-frequency admin action. A simple number is fine.

- `release_at` datetime picker should default to blank (immediate availability) not to the event start time. Defaulting to a non-blank value would accidentally lock missions unless admins notice and clear the field.

- Show a warning if `sec_gen_batch` is selected but has zero available (unallocated) VM sets: "This batch has no available VMs. Players will not be able to start this mission until more VMs are built."

### 7.2 hidden_from_players on SecGenBatch

The plan adds `hidden_from_players` to `SecGenBatch` (default true for game events). Admin needs to understand what this does — the existing batch edit form should add a clear label:

```
[x] Hide from players (game mode)
    When checked, this batch does not appear in the Challenges list.
    It is still included in scoring. Use this for VM pools that
    back game missions.
```

This label prevents admins from accidentally unchecking it and exposing raw VM controls to players.

### 7.3 Event Copy Workflow

The existing "Copy" action (`copy_event_path`) duplicates an event. For game events, this raises questions about what should be copied vs. regenerated:

| Item | Copy behaviour | Recommendation |
|---|---|---|
| Event metadata (title, dates, image) | Copy and adjust dates | Copy, prompt admin to update dates |
| SecGenBatch records | Copy with zero VMs | Copy; admin must trigger VM builds for the new event |
| GameSlot records | Copy with same `break_escape_mission` references | Copy; missions are shared across events, no duplication needed |
| `release_at` on GameSlots | Copy as offsets from event start | Copy relative offsets, not absolute dates, so the release schedule stays coherent in the copied event |
| VM sets (the built VMs) | Do not copy | VMs are per-event; admin builds new ones after copying |
| Result records | Do not copy | Results are per-user-per-event |

**Recommendation for `release_at` copy logic:** If the original event had `release_at = event.start_time + 7.days` for mission 2, the copy should set `release_at = new_event.start_time + 7.days`. This requires the copy action to calculate offsets rather than copying absolute timestamps. If the current copy action copies absolute datetimes, flag this as a bug to fix alongside the game integration — it would affect experiences too, not just games.

**Admin post-copy checklist (show as a flash or inline notice after copy):**

```
Event copied. Before publishing:
  [x] Update start and end dates
  [ ] Build VM sets for each batch (0 VMs currently available)
  [ ] Review mission release dates
  [ ] Update any Discord/FAQ/VLE links
```

This reduces admin error on a high-stakes, low-frequency workflow.

### 7.4 Admin visibility into game progress

The existing admin panel shows VM set status per batch. For game events, admins also need to see:

- How many games are `in_progress` vs `completed` per mission (operational awareness during a live event)
- Whether any players are stuck on the restart flow (VMs in reverting state for >5 min)

This is a v2 concern but worth flagging now so the GameSlot model is designed to support it (it already is, via the `BreakEscape::Game` status field).

---

## Summary of Recommendations by Priority

**Must-have for launch:**

1. Auto-activate VMs on game start — without this, players will be stuck at "start challenge" before the game even loads.
2. Hide VM control panel from game players entirely — the `hidden_from_players` flag covers the batch list, but ensure no VM set partial renders on the game event show page.
3. In-game status HUD (green/amber/red dot + time remaining + extend button) — without this, players have no way to know their VMs are about to shut down.
4. Rename "Challenges" to "Missions" on the event show page for game-type events.
5. Mission card status states (not started / in progress / completed / locked) — players need to know where they are in the narrative.
6. Relinquish reframed as "Finish Mission" / "Stand Down" — do not expose "relinquish" to players.

**Should-have (second sprint):**

7. Type badge on event tiles (Course / Experience / Game).
8. Heartbeat auto-extend for active players.
9. In-game lock screen during VM revert (v1 acceptable: redirect to event page with flash + "Resetting..." card status).
10. Error state on mission card when no VMs available (rather than generic flash message).

**Nice-to-have (post-launch):**

11. In-game polling for revert completion.
12. Admin post-copy checklist.
13. Automatic `release_at` offset calculation on event copy.
14. Admin dashboard for live game progress per mission.
