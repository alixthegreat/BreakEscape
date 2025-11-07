# BreakEscape Rails Engine Migration - Planning Summary

## Overview

This directory contains comprehensive planning documents for migrating BreakEscape from a standalone browser application to a Rails Engine that can be mounted in Hacktivity Cyber Security Labs.

---

## Executive Summary

### Current State
- **Architecture:** Pure client-side JavaScript application
- **Data Storage:** Static JSON files loaded at game start
- **Game Logic:** All validation happens client-side
- **Deployment:** Standalone HTML/JS/CSS files

### Target State
- **Architecture:** Rails Engine with client-server model
- **Data Storage:** PostgreSQL database with Rails models
- **Game Logic:** Server validates critical actions, client handles UI
- **Deployment:** Mountable Rails engine, integrates with Hacktivity

### Key Benefits
1. **Security:** Server-side validation prevents cheating
2. **Scalability:** Database-driven content, per-user scenarios
3. **Integration:** Mounts in Hacktivity with Devise authentication
4. **Flexibility:** Can run standalone or mounted
5. **Analytics:** Track player progress, difficulty, completion

---

## Planning Documents

### 1. NPC Migration Options
**File:** `NPC_MIGRATION_OPTIONS.md`

**Purpose:** Analyzes three approaches for migrating NPCs and Ink dialogue scripts to server-client model.

**Key Sections:**
- Current NPC architecture (ink scripts, event mappings, timed messages)
- Security concerns and state synchronization challenges
- **Option 1:** Full server-side NPCs (maximum security, higher latency)
- **Option 2:** Hybrid - scripts client-side, validation server-side (recommended)
- **Option 3:** Progressive loading (balanced approach)
- Comparison matrix and recommendations
- Database schema for NPCs

**Recommendation:** **Hybrid approach** for most NPCs
- Load ink scripts at startup (instant dialogue)
- Validate actions server-side (secure item giving, door unlocking)
- Sync conversation history asynchronously
- Best balance of UX and security

**Read this if you need to:**
- Understand NPC system architecture
- Choose an approach for dialogue management
- Plan NPC database schema
- Implement NPC API endpoints

---

### 2. Client-Server Separation Plan
**File:** `CLIENT_SERVER_SEPARATION_PLAN.md`

**Purpose:** Detailed plan for separating client-side and server-side responsibilities across all game systems.

**Key Sections:**
- Current vs future data flow
- System-by-system analysis:
  - Room loading (easiest - already has hooks)
  - Unlock system (move validation server-side)
  - Inventory management (optimistic UI, server authority)
  - Container system (fetch contents on unlock)
  - NPC system (see separate doc)
  - Minigames (keep mechanics client-side, validate results)
- Data access abstraction layer (`GameDataAccess` class)
- Migration strategy (gradual, system by system)
- Testing strategy (dual-mode support)
- Risk mitigation (latency, offline play, state consistency)

**Critical Insight:**
> The current architecture already supports this migration with minimal changes. The `loadRoom()` hook, Tiled/scenario separation, and TiledItemPool matching are perfect for server-client.

**Read this if you need to:**
- Understand what changes are needed
- Plan the refactoring approach
- See code examples for each system
- Create the data access abstraction layer

---

### 3. Rails Engine Migration Plan
**File:** `RAILS_ENGINE_MIGRATION_PLAN.md`

**Purpose:** Complete implementation guide with Rails commands, file structure, code examples, and timeline.

**Key Sections:**
- Rails Engine fundamentals
- Complete project structure (where every file goes)
- Phase-by-phase implementation:
  - Phase 1: Create engine skeleton
  - Phase 2: Move assets (bash script provided)
  - Phase 3: Database schema (all migrations)
  - Phase 4: Models and business logic
  - Phase 5: Controllers and API
  - Phase 6: Policies (Pundit)
  - Phase 7: Routes
  - Phase 8: Mounting in Hacktivity
  - Phase 9: Data import (rake tasks)
  - Phase 10: Views
  - Phase 11: Testing
  - Phase 12: Deployment
- 18-20 week timeline
- Complete code examples for all components

**Ready-to-Run Commands:**
```bash
# Generate engine
rails plugin new break_escape --mountable --database=postgresql

# Generate models
rails g model Scenario name:string description:text ...
rails g model GameInstance user:references scenario:references ...
# ... (all models documented)

# Import scenarios
rails break_escape:import_scenario['scenarios/ceo_exfil.json']

# Mount in Hacktivity
mount BreakEscape::Engine, at: '/break_escape'
```

**Read this if you need to:**
- Start the actual migration
- Understand Rails Engine structure
- Get complete database schema
- See full code examples
- Plan deployment

---

## Migration Compatibility Assessment

### Already Compatible ✅

From `ARCHITECTURE_COMPARISON.md` and `SERVER_CLIENT_MODEL_ASSESSMENT.md`:

1. **Room Loading System**
   - ✅ Clean separation of Tiled (visual) and Scenario (logic)
   - ✅ Lazy loading with `loadRoom()` hook
   - ✅ TiledItemPool matching is deterministic
   - ✅ Only need to change data source (`window.gameScenario` → server API)

2. **Sprite Creation**
   - ✅ `createSpriteFromMatch()` works identically
   - ✅ `applyScenarioProperties()` agnostic to data source
   - ✅ Visual and logic properties cleanly separated

3. **Interaction Systems**
   - ✅ All systems read sprite properties (don't care about source)
   - ✅ Inventory, locks, containers, minigames all compatible

### Needs Changes 🔄

1. **Unlock Validation**
   - Client determines success → Server validates attempt
   - Client knows correct PIN → Server stores and checks PIN
   - ~1-2 weeks to refactor

2. **Container Contents**
   - Pre-loaded in scenario → Fetched when unlocked
   - Client shows all contents → Server reveals incrementally
   - ~1 week to refactor

3. **Inventory State**
   - Pure client-side → Synced to server
   - Local state → Server as source of truth
   - ~1-2 weeks to refactor

4. **NPC System**
   - See `NPC_MIGRATION_OPTIONS.md`
   - Recommended: Hybrid approach
   - ~2-3 weeks to implement

---

## Quick Start Guide

### For Understanding the Migration

**Read in this order:**

1. **Start here:** `ARCHITECTURE_COMPARISON.md` (in parent directory)
   - Understand current architecture
   - See why it's compatible with server-client

2. **Then:** `SERVER_CLIENT_MODEL_ASSESSMENT.md` (in parent directory)
   - See detailed compatibility analysis
   - Understand minimal changes needed

3. **Next:** `CLIENT_SERVER_SEPARATION_PLAN.md` (this directory)
   - System-by-system refactoring plan
   - Code examples for each change

4. **Specific topics:**
   - NPCs: Read `NPC_MIGRATION_OPTIONS.md`
   - Implementation: Read `RAILS_ENGINE_MIGRATION_PLAN.md`

### For Starting Implementation

**Follow these steps:**

1. **Create Rails Engine** (Week 1)
   ```bash
   rails plugin new break_escape --mountable --database=postgresql
   ```

2. **Setup Database** (Week 2)
   - Copy migration commands from `RAILS_ENGINE_MIGRATION_PLAN.md`
   - Run all model generators
   - Customize migrations

3. **Move Assets** (Week 3-4)
   - Use bash script from `RAILS_ENGINE_MIGRATION_PLAN.md`
   - Test asset loading

4. **Refactor Room Loading** (Week 5)
   - Implement `GameDataAccess` from `CLIENT_SERVER_SEPARATION_PLAN.md`
   - Change `loadRoom()` to fetch from server
   - Test dual-mode operation

5. **Continue with Other Systems** (Week 6+)
   - Follow order in `CLIENT_SERVER_SEPARATION_PLAN.md`
   - Test each system before moving to next

---

## Key Architectural Decisions

### Decision 1: Hybrid NPC Approach

**Context:** Need to balance dialogue responsiveness with security

**Decision:** Load ink scripts client-side, validate actions server-side

**Rationale:**
- Instant dialogue (critical for UX)
- Secure actions (prevents cheating)
- Simple implementation (no ink engine on server)

**Trade-off:** Dialogue spoilers acceptable (low-impact)

---

### Decision 2: Data Access Abstraction

**Context:** Need gradual migration without breaking existing code

**Decision:** Create `GameDataAccess` class to abstract data source

**Benefits:**
- Toggle between local/server mode
- Refactor incrementally
- Test both modes
- Easy rollback

**Implementation:** See `CLIENT_SERVER_SEPARATION_PLAN.md` Phase 2

---

### Decision 3: Optimistic UI Updates

**Context:** Network latency could make game feel sluggish

**Decision:** Update UI immediately, validate with server, rollback if needed

**Benefits:**
- Game feels responsive
- Server remains authority
- Handles network errors gracefully

**Implementation:** See inventory and unlock systems in separation plan

---

### Decision 4: Rails Engine (not Rails App)

**Context:** Need to integrate with Hacktivity but also run standalone

**Decision:** Build as mountable Rails Engine

**Benefits:**
- Self-contained (own routes, controllers, models)
- Mountable in host apps
- Can run standalone for development
- Namespace isolation (no conflicts)

**Trade-offs:** More complex setup than plain Rails app

---

## Database Schema Overview

### Core Tables

```
scenarios
├─ rooms
│  └─ room_objects
├─ npcs
└─ game_instances (per user)
   ├─ player_state (position, unlocked rooms/objects)
   ├─ inventory_items
   └─ conversations (with NPCs)
```

### Key Relationships

- **User** (from Hacktivity) → has many **GameInstances**
- **Scenario** → has many **Rooms**, **NPCs**
- **Room** → has many **RoomObjects**
- **GameInstance** → has one **PlayerState**, many **InventoryItems**, many **Conversations**

**Full schema:** See Phase 3 in `RAILS_ENGINE_MIGRATION_PLAN.md`

---

## API Endpoints

### Game Management
- `GET /break_escape/games` - List scenarios
- `POST /break_escape/games` - Start new game
- `GET /break_escape/games/:id` - Play game
- `GET /break_escape/games/:id/bootstrap` - Get initial game data

### Game Play (API)
- `GET /break_escape/games/:id/api/rooms/:room_id` - Get room data
- `POST /break_escape/games/:id/api/unlock/:type/:id` - Unlock door/object
- `GET /break_escape/games/:id/api/containers/:id` - Get container contents
- `POST /break_escape/games/:id/api/containers/:id/take` - Take item from container
- `POST /break_escape/games/:id/api/inventory` - Add item to inventory
- `POST /break_escape/games/:id/api/inventory/use` - Use item

### NPCs
- `GET /break_escape/games/:id/api/npcs` - List accessible NPCs
- `GET /break_escape/games/:id/api/npcs/:npc_id/story` - Get NPC ink script
- `POST /break_escape/games/:id/api/npcs/:npc_id/message` - Send message to NPC
- `POST /break_escape/games/:id/api/npcs/:npc_id/validate_action` - Validate NPC action

**Full routes:** See Phase 7 in `RAILS_ENGINE_MIGRATION_PLAN.md`

---

## Testing Strategy

### Unit Tests
- Models (business logic, validations, relationships)
- Serializers (correct JSON output)
- Services (unlock validation, state management)

### Controller Tests
- API endpoints (authentication, authorization, responses)
- Game controllers (scenario selection, game creation)

### Integration Tests
- Complete game flow (start → play → unlock → complete)
- Multi-room navigation
- Inventory management across sessions
- NPC interactions

### Policy Tests (Pundit)
- User can only access own games
- Cannot access unearned content
- Proper authorization for all actions

**Test examples:** See Phase 11 in `RAILS_ENGINE_MIGRATION_PLAN.md`

---

## Risk Assessment & Mitigation

### High Risk: Network Latency

**Risk:** Game feels sluggish with server round-trips

**Mitigation:**
- ✅ Optimistic UI updates
- ✅ Aggressive caching
- ✅ Prefetch adjacent rooms
- ✅ Keep minigames client-side

**Acceptable latency:**
- Room loading: < 500ms
- Unlock validation: < 300ms
- Inventory sync: < 200ms

---

### Medium Risk: State Inconsistency

**Risk:** Client and server state diverge

**Mitigation:**
- ✅ Server is always source of truth
- ✅ Periodic reconciliation
- ✅ Rollback on server rejection
- ✅ Audit log of state changes

---

### Medium Risk: Offline Play

**Risk:** Game requires network connection

**Mitigation:**
- ✅ Queue operations when offline
- ✅ Sync when reconnected
- ✅ Cache unlocked content
- ✅ Graceful error messages

---

### Low Risk: Cheating

**Risk:** Players manipulate client-side state

**Mitigation:**
- ✅ Server validates all critical actions
- ✅ Encrypted lock requirements
- ✅ Metrics-based anti-cheat
- ✅ Rate limiting

---

## Timeline Summary

### Phase 1: Preparation (Week 1-4)
- Setup Rails engine
- Create database schema
- Move assets
- Setup testing

### Phase 2: Core Systems (Week 5-10)
- Room loading
- Unlock system
- Inventory management
- Container system

### Phase 3: NPCs & Polish (Week 11-16)
- NPC system
- Views and UI
- Integration with Hacktivity
- Data migration

### Phase 4: Testing & Deployment (Week 17-20)
- Comprehensive testing
- Performance optimization
- Security audit
- Production deployment

**Total: 18-20 weeks (4-5 months)**

---

## Success Metrics

### Technical
- [ ] All tests passing
- [ ] p95 API latency < 500ms
- [ ] Database query time < 50ms
- [ ] Cache hit rate > 80%
- [ ] 99.9% uptime

### Security
- [ ] No solutions visible in client
- [ ] All critical actions validated server-side
- [ ] No bypass exploits found in audit
- [ ] Proper authorization on all endpoints

### UX
- [ ] Game feels responsive (no noticeable lag)
- [ ] Offline mode handles errors gracefully
- [ ] Loading indicators show progress
- [ ] State syncs transparently

### Integration
- [ ] Mounts successfully in Hacktivity
- [ ] Uses Hacktivity's Devise authentication
- [ ] Per-user scenarios work correctly
- [ ] Can also run standalone

---

## Next Steps

### Immediate Actions

1. **Review Planning Documents**
   - Read all three docs in this directory
   - Review architecture comparison docs in parent directory
   - Discuss any concerns or questions

2. **Approve Approach**
   - Confirm hybrid NPC approach
   - Confirm Rails Engine architecture
   - Confirm timeline is acceptable

3. **Setup Development Environment**
   - Create Rails engine
   - Setup PostgreSQL database
   - Configure asset pipeline

4. **Start Phase 1**
   - Follow `RAILS_ENGINE_MIGRATION_PLAN.md`
   - Begin with engine skeleton
   - Setup CI/CD pipeline

---

## Resources

### Documentation
- [Rails Engines Guide](https://guides.rubyonrails.org/engines.html)
- [Pundit Authorization](https://github.com/varvet/pundit)
- [Phaser Game Framework](https://phaser.io/docs)
- [Ink Narrative Language](https://github.com/inkle/ink)

### BreakEscape Docs (in repo)
- `README_scenario_design.md` - Scenario JSON format
- `README_design.md` - Game design document
- `planning_notes/room-loading/README_ROOM_LOADING.md` - Room system
- `docs/NPC_INTEGRATION_GUIDE.md` - NPC system
- `docs/CONTAINER_MINIGAME_USAGE.md` - Container system

### Migration Docs (this directory)
- `NPC_MIGRATION_OPTIONS.md` - NPC approaches
- `CLIENT_SERVER_SEPARATION_PLAN.md` - Refactoring plan
- `RAILS_ENGINE_MIGRATION_PLAN.md` - Implementation guide

### Architecture Docs (parent directory)
- `ARCHITECTURE_COMPARISON.md` - Current vs future
- `SERVER_CLIENT_MODEL_ASSESSMENT.md` - Compatibility analysis

---

## Questions & Answers

### Q: Can we still run BreakEscape standalone?

**A:** Yes! The Rails Engine can run as a standalone application for development and testing. Just run `rails server` in the engine directory.

---

### Q: Will this break the current game?

**A:** No. We'll use a dual-mode approach during migration. The `GameDataAccess` abstraction allows toggling between local JSON and server API. Current game continues working until migration is complete.

---

### Q: How long until we can mount in Hacktivity?

**A:** Basic mounting possible after Week 8 (room loading + unlock system working). Full feature parity requires ~16 weeks.

---

### Q: What about existing scenario JSON files?

**A:** They'll be imported into the database using rake tasks (provided in the plan). The JSON format becomes the import format, not the runtime format.

---

### Q: Can scenarios be updated without code changes?

**A:** Yes! Once in the database, scenarios can be edited via Rails console or admin interface. No need to modify JSON files or redeploy.

---

### Q: What happens to ink scripts?

**A:** Stored in database as TEXT (JSON). Hybrid approach: loaded client-side at game start, actions validated server-side. See `NPC_MIGRATION_OPTIONS.md` for details.

---

### Q: Will this work with mobile devices?

**A:** The client-side code (Phaser) already works on mobile. The Rails Engine just provides the backend API. No changes needed for mobile support.

---

## Conclusion

This migration is **highly feasible** due to excellent architectural preparation:

✅ **Separation exists:** Tiled (visual) vs Scenario (logic)  
✅ **Hooks exist:** `loadRoom()` perfect for server integration  
✅ **Matching is deterministic:** TiledItemPool works identically  
✅ **Minimal changes needed:** Only data source changes  

**Estimated effort:** 18-20 weeks  
**Confidence level:** High (95%)  
**Risk level:** Low-Medium (well understood, mitigations in place)  

**Recommendation:** Proceed with migration following the phased approach in these documents.

---

## Document Version History

- **v1.0** (2025-11-01) - Initial comprehensive planning documents created
  - NPC Migration Options
  - Client-Server Separation Plan  
  - Rails Engine Migration Plan
  - This summary document

---

## Contact & Feedback

For questions about this migration plan, contact the development team or file an issue in the repository.

**Happy migrating! 🚀**


