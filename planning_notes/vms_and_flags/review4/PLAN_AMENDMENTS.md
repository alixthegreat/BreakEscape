# Plan Amendments - Review 4

These are the specific amendments to apply to `IMPLEMENTATION_PLAN.md` based on Review 4 findings.

---

## 1. Add Policy Requirements to Implementation Checklist

**Location**: Lines 2448-2462 (Phase 2 checklist)

**Add after line 2.13**:
```markdown
- [ ] 2.14 Add GamePolicy#submit_flag? method
- [ ] 2.15 Add MissionPolicy#create_game? method (for authorization in games#create)
```

---

## 2. Fix Authorization in `games#create` Action

**Location**: Lines 820-864 (games#create action code)

**Change line 821**:
```ruby
# FROM:
authorize @mission if defined?(Pundit)

# TO:
authorize @mission, :create_game? if defined?(Pundit)
```

**Remove lines 831-832**:
```ruby
# REMOVE THESE LINES (redundant - valid_vm_sets_for_user already validates ownership):
vm_set = ::VmSet.find(params[:vm_set_id])
authorize vm_set, :use? if defined?(Pundit)
```

**Replace with**:
```ruby
vm_set = ::VmSet.find_by(id: params[:vm_set_id])
return render json: { error: 'VM set not found' }, status: :not_found unless vm_set
```

---

## 3. Update `hacktivity_mode?` Reference in Model Changes

**Location**: Lines 580-600 (Mission model changes)

**Add note after line 585**:
```markdown
**NOTE**: Update the existing `hacktivity_mode?` method (line 60-62 in current code) to use this new definition. The current definition only checks for `::Cybok`.
```

---

## 4. Add Policy Code Examples

**Location**: Add new section after line 1080 (after controller routes section)

```markdown
### 3. Update Policies

#### GamePolicy

Add to `app/policies/break_escape/game_policy.rb`:

```ruby
def submit_flag?
  show?
end

def container?
  show?
end
```

#### MissionPolicy

Add to `app/policies/break_escape/mission_policy.rb`:

```ruby
def create_game?
  # Anyone authenticated can create a game for a mission
  user.present?
end
```
```

---

## 5. Clarify `hacktivity-cable.js` Script Loading

**Location**: Lines 1472-1488 (loading hacktivity-cable.js)

**Replace the two options with single recommended approach**:
```markdown
**Loading this module:**

Add to `app/views/break_escape/games/show.html.erb` after the Phaser script loads:

```erb
<% if BreakEscape::Mission.hacktivity_mode? %>
  <script type="module" src="/break_escape/js/systems/hacktivity-cable.js" nonce="<%= content_security_policy_nonce %>"></script>
<% end %>
```

**Note**: The module self-initializes on load. No additional setup required.
```

---

## 6. Add Fallback for Non-Hacktivity VmSet Authorization

**Location**: Lines 833-839 (games#create validation)

**Update the validation block**:
```ruby
# Validate VM set belongs to user and matches mission
if BreakEscape::Mission.hacktivity_mode?
  unless @mission.valid_vm_sets_for_user(current_user).include?(vm_set)
    return render json: { error: 'Invalid VM set for this mission' }, status: :forbidden
  end
else
  # Standalone mode - vm_set_id shouldn't be used
  Rails.logger.warn "[BreakEscape] vm_set_id provided but not in Hacktivity mode, ignoring"
  params.delete(:vm_set_id)
end
```

---

## Summary

| Amendment | Severity | Reason |
|-----------|----------|--------|
| Add policy methods | Minor | Pundit will fail without these |
| Fix authorization action | Minor | `authorize @mission` uses `show?` not `create_game?` |
| Remove redundant VmSet auth | Cleanup | Query already validates ownership |
| Add `hacktivity-cable.js` load | Clarification | Two options were confusing |
| Add Hacktivity mode check | Robustness | Prevents errors in standalone mode |

These amendments can be applied incrementally during implementation without blocking the start of development.

