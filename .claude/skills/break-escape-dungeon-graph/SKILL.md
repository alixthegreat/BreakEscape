---
name: break-escape-dungeon-graph
description: Produces a Boss Keys-style dungeon dependency graph from a Break Escape scenario file (.json or .json.erb). Use this skill whenever the user pastes or uploads a Break Escape scenario file and asks for a diagram, graph, map, dependency chart, or visual overview of the level structure. Also trigger when the user asks to "visualise the mission", "show the lock and key structure", "draw the dungeon graph", or "update the diagram" after editing a scenario. The skill analyses rooms, objects, locks, keys, NPCs, items, objectives, and VM challenges, then renders an interactive scrollable SVG using the GMTK Boss Keys notation adapted for Break Escape.
---

# Break Escape dungeon graph skill

Produces a scrollable, interactive Boss Keys-style dependency graph from a Break Escape scenario file. Every lock shows what it requires; every key/item shows what it unlocks; VM challenges appear as obstacles with flag keys.

## Step 0 — parse the scenario

The user will paste or upload a scenario file. It may be JSON or JSON with ERB template tags (`<%= ... %>`). Strip ERB tags before parsing — replace `<%= ... %>` expressions with a readable placeholder (e.g. `"[ERB: base64_encode(...)]"`). Then extract:

**Rooms** (`scenario.rooms`) — each room has:
- `id`, `locked`, `lockType`, `requires`, `door_sign`, `connections`
- `objects` array — safes, PCs, filing cabinets, terminals, notes, items
- `npcs` array — characters who hold items or act as locks/keys

**Objects to classify:**
- `type: "safe"` or `type: "pc"` with `locked: true` → **lock nodes**
- `type: "key"` → **key node**
- `type: "lockpick"` / `type: "keycard"` → **key nodes**
- `type: "notes"` / `type: "text_file"` with meaningful content → **item nodes** (amber)
- `type: "workstation"` (CyberChef etc.) → **tool node** (amber diamond)
- `type: "vm-launcher"` → **VM obstacle node** (blue rect)
- `type: "flag-station"` → used to identify flag keys (purple diamonds)

**NPCs to classify:**
- NPCs with `itemsHeld` → each held item is a key node reachable by talking to or KO-ing the NPC
- NPCs with `storyPath` → conversation gate (treat as a soft lock if tied to an objective task)

**Objectives** (`scenario.objectives`) — extract:
- `unlockCondition: { aimCompleted }` → hard **objective gate** bars (amber)
- `tasks` with `type: "enter_room"` → room entry depends on prior aim
- `tasks` with `type: "submit_flags"` → VM flag submissions
- `tasks` with `status: "locked"` and `unlockCondition` → sequenced VM challenges

**VM flag dependencies** (`scenario.objectives → capture_technical_evidence → tasks`):
- Each `submit_flags` task maps to a VM challenge obstacle + flag key pair
- If a task has `unlockCondition: { flagSubmitted }`, it is sequentially gated on a prior flag

## Step 1 — build the dependency graph (mental model)

Before drawing, construct a logical dependency list:

```
For each room R:
  If R.locked:
    create LOCK node for R's door
    requires: R.requires (key_id or PIN or rfid)
    find the object/NPC that provides that key → create KEY node pointing to LOCK

For each object O in each room:
  If O.locked:
    create LOCK node for O
    requires: O.requires
    find source of that requirement → feed arrow from KEY to LOCK
  If O is a key/lockpick/keycard/workstation/notes (takeable):
    create ITEM/KEY node
    draw arrow from ROOM (or NPC) to ITEM

For each NPC N with itemsHeld:
  create KEY diamond for N
  label with NPC name + items held
  connect to: room that NPC is in (player must reach room first)

For objective gates:
  place GATE bar above the node it gates
  label with the aim name that must complete
```

## Step 2 — assign visual roles

Use GMTK Boss Keys notation adapted for Break Escape:

| Element | Shape | Colour class |
|---|---|---|
| Room / location | Ellipse | `c-teal` |
| Key / item / NPC unlock | Diamond (`<polygon>`) | `c-coral` |
| Physical lock (door, safe, PC) | Rectangle | `c-coral` |
| Physical item (notes, wordlist, tool) | Diamond | `c-amber` |
| CyberChef / decode tool | Diamond | `c-amber` |
| VM challenge (obstacle) | Rectangle | dark blue (`fill:#0c2040 stroke:#4a90d9`) |
| VM flag (key from VM) | Diamond | `c-purple` |
| Objective gate bar | Thin rect | dark amber (`fill:#2a1800 stroke:#e89030`) |
| Optional node | Any shape with `stroke-dasharray="4 2"` | same ramp, dashed |

**Subtitle rule:** every lock rect must show `requires: [what unlocks it]` as a 12px subtitle. Every key diamond must show the item name + brief note. Keep subtitles ≤ 5 words.

## Step 3 — layout rules

This diagram is always wide. Use a **scrollable HTML wrapper** around a wide SVG:

```html
<style>.sw{overflow-x:auto;width:100%}</style>
<div class="sw">
<svg width="[W]" viewBox="0 0 [W] [H]" style="min-width:[W]px">
...
</svg>
</div>
```

**Width guidelines:**
- Simple linear mission (1 main path): 800px
- Hub-and-spoke with 3 branches: 1100px
- Full mission with VM section + optional branches: 1300px

**Column placement:**
- Main flow runs down the centre column (cx ≈ W/2)
- Left branch (e.g. IT room): cx ≈ 150–200
- Right branch (e.g. manager's offices): cx ≈ W − 200 to W − 150
- Far-right optionals: cx ≈ W − 120
- VM section: spans full width, enclosed in a dashed blue container rect

**Row spacing:** 80px between row centres. Each node is either:
- Ellipse: ry=20, so top=cy−20, bottom=cy+20
- Rect (two-line): height=36, so top=y, bottom=y+36
- Diamond: polygon with half-height 22, so top=cy−22, bottom=cy+22

**Arrow routing rules:**
- Direct vertical connection: `<line>`
- Cross-column feed (dashed, no gate): `<path d="M x1 y1 L x1 ymid L x2 ymid L x2 y2" fill="none">`
- Shortcut (e.g. keycard bypasses main flow): blue dashed `stroke="#4a90d9" stroke-dasharray="5 3"`
- Never route an arrow through a node's interior — use L-bends to route around

**Dashed lines mean:** item feeds a lock elsewhere without gating the main flow. Solid lines mean required dependency.

## Step 4 — VM section layout

Place the VM section below the server room ellipse. Draw a dashed blue container rect around all VM nodes:

```svg
<rect x="[left]" y="[top]" width="[w]" height="[h]" rx="8"
  fill="none" stroke="#4a90d9" stroke-width="0.8" stroke-dasharray="6 3"/>
<text class="ts" x="[left+16]" y="[top+14]" dominant-baseline="central" fill="#4a90d9">
  SecGen VM environment
</text>
```

For each VM challenge, place:
1. A dark-blue **VM obstacle rect** (`fill:#0c2040 stroke:#4a90d9`) labelled with the challenge name and `requires:` subtitle
2. A vertical arrow down to a **purple flag diamond** labelled with flag number + what it reveals
3. If flag N gates challenge N+1, draw a dashed purple cross-arrow from flag N diamond to challenge N+1 rect

All VM flags converge at the bottom with arrows into the objective gate bar, then into the ENTROPY archive lock.

## Step 5 — legend

Always include a legend bar at the top (y=10–40):

```svg
<g class="c-gray"><rect x="16" y="10" width="[W-32]" height="30" rx="4" stroke-width="0.5"/></g>
```

Legend items (left to right): location oval, key diamond, lock rect, item diamond, VM obstacle rect, VM flag diamond, obj. gate rect, dashed line label, shortcut line label.

## Step 6 — interactivity

Wrap every node group in `<g class="node" onclick="sendPrompt('Tell me about [node name] in this scenario')">`. This lets the user click any node to ask follow-up questions.

## Step 7 — render

Use the `show_widget` visualiser tool with:
- `loading_messages`: 3 messages describing parsing → layout → rendering
- `title`: `[mission_id]_dungeon_graph`
- `widget_code`: the full HTML+SVG string

## Common patterns to recognise

**Kevin Park pattern** — NPC holds lockpick + keycard. The keycard enables a shortcut to the server room (blue dashed line). The lockpick enables picking a lock elsewhere (grey dashed line). Both are separate paths from the same diamond.

**Patricia's briefcase pattern** — locked container inside a room. The container itself is a lock (requires lockpick). Contents are multiple keys (office key + tool). Both content items need separate diamond nodes with arrows going to their respective locks.

**CyberChef pattern** — workstation item that is required to decode encoded notes. Draw an amber diamond for CyberChef. Draw dashed arrows from the encoded item to the CyberChef diamond, and from CyberChef to the decoded result (another item or a PIN).

**Encoded credential pattern** — a note/file whose content is encoded (Base64/ROT13). The raw note is an amber diamond. CyberChef is required to decode it. The decoded output is another amber diamond (e.g. "SSH username (decoded)") which feeds the VM challenge.

**Dual-PIN pattern** — if two locks share the same PIN source, note this in the subtitle of both lock rects. If they have distinct PINs, make sure each lock's subtitle cites its own source.

**Objective gate placement** — place the gate bar immediately above the node it blocks, not above the whole section. Label it: `obj. gate: [aim name] must complete`.

## Output checklist

Before rendering, verify:
- [ ] Every room is an ellipse
- [ ] Every lock rect has a `requires:` subtitle
- [ ] Every key diamond has a name + brief source note
- [ ] No two nodes overlap (check rightmost x + width < next node's x in same row)
- [ ] All arrows route around nodes, not through them
- [ ] VM section has a dashed container rect
- [ ] Flag diamonds show what they reveal/unlock
- [ ] Optional nodes have `stroke-dasharray="4 2"`
- [ ] Objective gate bars appear above the correct node
- [ ] Legend is present and complete
- [ ] Canvas is wide enough — if more than 4 nodes in any row, increase width
- [ ] `fill="none"` on all connector paths