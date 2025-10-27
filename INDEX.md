# Lockpicking Minigame Refactoring - Project Index

## 🎯 Project Overview

We are refactoring the **lockpicking minigame** (`js/minigames/lockpicking/lockpicking-game-phaser.js`) from a monolithic 4670-line class into a clean, modular architecture with 12 focused modules.

### Current State
- **File Size:** 4,670 lines
- **Class Count:** 1 (monolithic)
- **Methods:** 50+
- **Maintainability:** Low
- **Testability:** Low
- **Reusability:** Low

### Target State
- **File Sizes:** 100-1200 lines each
- **Module Count:** 12 focused modules
- **Methods:** 5-10 per module
- **Maintainability:** High
- **Testability:** High
- **Reusability:** High

---

## 📚 Documentation Structure

### ⭐ NEW: PARENT_INSTANCE_PATTERN.md - THE KEY FEATURE!
**Purpose:** Understand the parent instance pattern for state sharing  
**Contents:**
- How the pattern works (with examples)
- Why it's the safe approach
- Complete generated module structure
- Integration workflow (test → commit)
- 11-phase complete refactoring plan

**Read Time:** 20 minutes  
**Critical For:** Understanding how extracted modules access parent state  
**Next:** QUICKSTART_AUTO_INTEGRATION.md for hands-on use

---

### ⭐ NEW: QUICKSTART_AUTO_INTEGRATION.md - Execute This First!
**Purpose:** One-command extraction with automatic main file integration  
**Contents:**
- TL;DR: One command does everything
- Phase 1 walkthrough (Lock Configuration)
- How to verify extraction succeeded
- All 11 phase commands (copy-paste ready)
- Troubleshooting guide

**Read Time:** 10 minutes  
**Action:** Run Phase 1 command and test  
**Next:** After first success, run Phase 2

---

### 1. **QUICKSTART.md** ← Original Quick Start
**Purpose:** Get started in 5 minutes  
**Contents:**
- TL;DR quick reference
- First extraction command (old method)
- Common questions
- Success criteria

**Read Time:** 5 minutes  
**Note:** Consider using QUICKSTART_AUTO_INTEGRATION.md instead  
**Next:** Run Phase 1 extraction

---

### 2. **REFACTORING_SUMMARY.md** ← Read for Context
**Purpose:** Executive overview of the entire project  
**Contents:**
- What was created (3 deliverables)
- Recommended extraction order (Phases 1-5)
- Benefits of refactoring
- Before/after metrics

**Read Time:** 10 minutes  
**Next:** Choose your approach (learn vs. execute)

```

---

### 3. **REFACTORING_PLAN.md** ← Deep Dive
**Purpose:** Comprehensive technical analysis  
**Contents:**
- Current architecture breakdown
- 12 identified concerns (modules)
- Dependency relationships
- Phase grouping (low to high risk)
- Testing strategy

**Read Time:** 15 minutes  
**Next:** Understand module relationships

---

### 4. **IMPLEMENTATION_DETAILS.md** ← Important Read (NEW!)
**Purpose:** How the refactoring actually works  
**Contents:**
- Does the tool remove methods? (No, you must)
- Does the new JS file get used? (Yes, but you must update calls)
- How to handle shared state & dependencies
- How to keep Phaser scene available
- Complete workflow example
- Implementation checklist
- Common mistakes to avoid

**Read Time:** 15 minutes  
**IMPORTANT:** Read this BEFORE you start extracting!  
**Next:** Understand the implementation requirements

---

### 5. **EXTRACTION_GUIDE.md** ← Implementation Manual
**Purpose:** Step-by-step extraction instructions  
**Contents:**
- Tool installation & setup
- Basic usage examples
- All 11 extraction phases (copy-paste commands)
- Post-extraction workflow
- Dependency handling
- Troubleshooting guide

**Read Time:** 20 minutes  
**Next:** Execute extractions one phase at a time

---

### 6. **MODULE_ARCHITECTURE.md** ← Visual Reference
**Purpose:** Architecture diagrams and data flows  
**Contents:**
- Current monolithic structure diagram
- Proposed modular architecture
- Module dependency graph
- Phase timeline with risk levels
- Data flow architecture
- Integration points
- Testing strategy per module
- Rollback procedures

**Read Time:** 15 minutes  
**Next:** Reference while implementing

---

### 7. **scripts/extract_lockpicking_methods.py** ← The Tool
**Purpose:** Python utility to extract methods  
**Features:**
- Exact code extraction (no modifications)
- Method dependency detection
- Class/object module generation
- Flexible CLI interface
- Full documentation

**Usage:** `python3 scripts/extract_lockpicking_methods.py --help`  
**Next:** Use for each extraction phase

---

## 🚀 Quick Navigation

### I want to...

**...understand the project in 30 seconds**
→ Read `QUICKSTART.md` (first section)

**...see a diagram of the current/target architecture**
→ Read `MODULE_ARCHITECTURE.md`

**...know why this refactoring matters**
→ Read `REFACTORING_SUMMARY.md` (benefits section)

**...understand dependencies between modules**
→ Read `REFACTORING_PLAN.md` (dependency section)

**...understand HOW the refactoring works (IMPORTANT!)**
→ Read `IMPLEMENTATION_DETAILS.md` ← **Must read before starting**

**...extract the first module**
→ Run command in `QUICKSTART.md`

**...extract all modules systematically**
→ Follow `EXTRACTION_GUIDE.md` (phases 1-11)

**...understand what went wrong**
→ Check `EXTRACTION_GUIDE.md` (troubleshooting)

**...rollback an extraction**
→ See `MODULE_ARCHITECTURE.md` (rollback strategy)

---

## 📋 Reading Paths

### Path 1: Executive (15 min)
1. `QUICKSTART.md` - Overview
2. `REFACTORING_SUMMARY.md` - Why it matters
3. Run Phase 1 extraction
4. `EXTRACTION_GUIDE.md` - Continue phases

**Best for:** Managers, architects, quick start

---

### Path 2: Technical Deep Dive (60 min)
1. `QUICKSTART.md` - Overview
2. `REFACTORING_PLAN.md` - Architecture
3. `MODULE_ARCHITECTURE.md` - Diagrams
4. `EXTRACTION_GUIDE.md` - Implementation
5. Run all phases systematically

**Best for:** Developers, technical leads, full understanding

---

### Path 3: Hands-On (30 min)
1. `QUICKSTART.md` - Get context
2. `EXTRACTION_GUIDE.md` - Section "Phase 1"
3. Run extraction command
4. Test game
5. Repeat phases 2-5 with testing

**Best for:** Implementers, pragmatists, action-oriented

---

## 🔧 Tool Usage Quick Reference

### Extract Methods
```bash
cd /home/cliffe/Files/Projects/Code/BreakEscape/BreakEscape

python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2,method3" \
  --output-file "js/minigames/lockpicking/module.js"
```

### Show Help
```bash
python3 scripts/extract_lockpicking_methods.py --help
```

### See Dependencies
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "method1,method2" \
  --output-file "test.js" \
  --show-dependencies
```

### Full Example (Phase 1)
```bash
python3 scripts/extract_lockpicking_methods.py \
  --methods "saveLockConfiguration,loadLockConfiguration,clearLockConfiguration,getLockPinConfiguration,clearAllLockConfigurations,resetPinsToOriginalPositions" \
  --output-file "js/minigames/lockpicking/lock-configuration.js" \
  --object-mode \
  --show-dependencies
```

---

## 📊 Project Phases Overview

| Phase | Module | LOC | Methods | Risk | Status |
|-------|--------|-----|---------|------|--------|
| 1 | Lock Configuration | 100 | 6 | Low | 🔵 Ready |
| 2 | Lock Graphics | 200 | 3 | Low | 🔵 Ready |
| 3 | Key Data Generator | 400 | 8 | Low | 🔵 Ready |
| 4 | Pin System | 900 | 10 | Medium | 🔵 Ready |
| 5 | Key Rendering | 1200 | 10 | Medium | 🔵 Ready |
| 6 | Key Selection UI | 300 | 7 | High | 🔵 Ready |
| 7 | Input Handlers | 200 | 5 | High | 🔵 Ready |
| 8 | Completion | 150 | 3 | High | 🔵 Ready |
| 9 | UI Elements | 400 | 6 | High | 🔵 Ready |
| 10 | Mode Switching | 150 | 4 | High | 🔵 Ready |
| 11 | Utilities | 300 | 8 | Medium | 🔵 Ready |
| - | **TOTAL** | **5800** | **70** | - | 🔵 Ready |

**Legend:** 🔵 Ready to extract | 🟢 Completed | 🟡 In progress | 🔴 Blocked

---

## ✅ Checklist for Success

### Before You Start
- [ ] Read `QUICKSTART.md`
- [ ] Verify Python 3 installed: `python3 --version`
- [ ] Git repository is clean: `git status`
- [ ] Game runs currently: `python3 -m http.server 8000`

### Phase 1 (Lock Configuration)
- [ ] Run extraction command
- [ ] Review generated `lock-configuration.js`
- [ ] Update imports in main class
- [ ] Test game loads
- [ ] Test lock state persists
- [ ] Commit to git

### Phases 2-5 (Core Modules)
- [ ] Extract module
- [ ] Update main class
- [ ] Test functionality
- [ ] Commit changes
- [ ] Repeat for next phase

### Phases 6-11 (UI & Utilities)
- [ ] Extract module
- [ ] Test full feature set
- [ ] Commit changes
- [ ] Continue systematic extraction

### Final Verification
- [ ] All 12 modules extracted
- [ ] Main class down to ~1500 LOC
- [ ] Game plays from start to finish
- [ ] All features identical to original
- [ ] Code is well-organized

---

## 🎓 Learning Resources

### Understanding the Tool
```bash
# View tool source code
cat scripts/extract_lockpicking_methods.py

# Test tool on a subset
python3 scripts/extract_lockpicking_methods.py \
  --methods "shuffleArray" \
  --output-file "test.js" \
  --show-dependencies
```

### Understanding the Architecture
1. Open `lockpicking-game-phaser.js`
2. Find method: `createPins()`
3. Note dependencies it calls
4. Compare with Pin System module extraction plan
5. See how methods group logically

### Understanding the Game Flow
1. Open `scenario_select.html`
2. Launch a lockpicking scenario
3. Observe: Load → Init → Create Graphics → Ready for input
4. Compare with `EXTRACTION_GUIDE.md` workflow diagram

---

## 🐛 Troubleshooting Guide

### "Module not found" Error
```
Error in browser console: "Cannot find module './lock-configuration.js'"
```
**Solution:** Verify file was created and path is correct in import statement

### "Game breaks after extraction"
```
ReferenceError: createPins is not defined
```
**Solution:** You removed the method but didn't update the call. Either re-add the method or update the call to use the module.

### "Extraction tool says method not found"
```
❌ Method 'createLockBackground' not found
```
**Solution:** Check spelling (case-sensitive) and method exists in source file

### "Don't understand dependencies warning"
```
⚠️  Dependencies: updatePinVisuals, this.scene.add.graphics()
```
**Solution:** This is informational. You don't need to do anything. The tool just tells you what the extracted methods call.

### "Want to undo an extraction"
```bash
# Option 1: Delete the file
rm js/minigames/lockpicking/lock-configuration.js

# Option 2: Revert all changes
git checkout -- .
```

---

## 📞 Support Matrix

| Question | Resource |
|----------|----------|
| Where do I start? | `QUICKSTART.md` |
| Why refactor? | `REFACTORING_SUMMARY.md` → Benefits |
| How do modules relate? | `MODULE_ARCHITECTURE.md` |
| What's Phase 1? | `EXTRACTION_GUIDE.md` → Phase 1 section |
| How to use tool? | `scripts/extract_lockpicking_methods.py --help` |
| What are dependencies? | `REFACTORING_PLAN.md` → Dependency section |
| Something broke | `EXTRACTION_GUIDE.md` → Troubleshooting |
| Want to rollback | `MODULE_ARCHITECTURE.md` → Rollback Strategy |
| Need visual diagram | `MODULE_ARCHITECTURE.md` |

---

## 🚀 Ready to Start?

### Step 1: Read
Start with `QUICKSTART.md` (5 minutes)

### Step 2: Execute
Run the Phase 1 extraction command (2 minutes)

### Step 3: Test
Start server and verify game works (2 minutes)

### Step 4: Continue
Follow `EXTRACTION_GUIDE.md` for phases 2-11

---

## 📈 Success Metrics

### After Phase 1
✓ Lock configuration extracted  
✓ Game still loads  
✓ No console errors  
✓ Data persistence works  

### After Phases 2-5 (Major Milestone)
✓ 5 core modules extracted  
✓ Game fully playable  
✓ All interactions working  
✓ Main class ~2500 LOC  

### After All 11 Phases
✓ 12 focused modules  
✓ Main class ~1500 LOC  
✓ Game identical to original  
✓ Code highly maintainable  
✓ Easy to test and extend  

---

## 📝 Documentation Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-27 | Initial documentation suite |
| - | - | QUICKSTART, REFACTORING_SUMMARY, REFACTORING_PLAN, EXTRACTION_GUIDE, MODULE_ARCHITECTURE, this INDEX |

---

## 🎯 Bottom Line

**You have everything you need to refactor the lockpicking minigame from a 4670-line monolith into 12 clean, focused modules.**

All pre-built commands are ready to copy-paste. Full documentation guides you through each step. The Python tool handles the heavy lifting. You just need to:

1. Extract methods using the tool
2. Update imports in the main class
3. Test the game
4. Commit your changes
5. Repeat

**Estimated time:** 1-2 weeks of development with testing  
**Difficulty:** Medium (high reward, manageable risk)  
**Starting point:** `QUICKSTART.md`

---

**Happy refactoring! 🚀**
