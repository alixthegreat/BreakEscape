# Hacktivity Compatibility Review

**Date**: November 28, 2025  
**Reviewed**: Hacktivity codebase at `/home/cliffe/Files/Projects/Code/Hacktivity/`

---

## Executive Summary

After reviewing Hacktivity's codebase, our implementation plan is **mostly compatible** with a few issues that need addressing. The main findings relate to:

1. ✅ Model structure matches our assumptions
2. ⚠️ Flag submission uses `FlagService`, not direct model update
3. ⚠️ `scenario` field naming differs from our assumption  
4. ⚠️ `auto_flag_submit` endpoint requires VM name, not flag_key alone
5. ⚠️ No `display_name` method on VmSet
6. ✅ Console URL pattern is correct

---

## Model Structure Analysis

### VmSet Model
```ruby
# Hacktivity: app/models/vm_set.rb
class VmSet < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :sec_gen_batch           # <-- NOT secgen_batch
  belongs_to :cluster, optional: true
  belongs_to :target_node, optional: true
  belongs_to :team, optional: true
  has_many :vms
end
```

**Compatibility Issue**: Our plan uses `secgen_batch` but Hacktivity uses `sec_gen_batch` (with underscore).

### VM Model
```ruby
# Hacktivity: app/models/vm.rb
class Vm < ApplicationRecord
  belongs_to :vm_set
  belongs_to :node, optional: true
  has_many :flags
  has_many :snapshots
  
  # Has ip_address field
  # Has title field (VM name like "desktop", "server", etc.)
end
```

**Compatibility**: ✅ Matches our assumptions - VMs have `title`, `ip_address`, and `has_many :flags`.

### Flag Model
```ruby
# Hacktivity: app/models/flag.rb
class Flag < ApplicationRecord
  belongs_to :vm
end

# Schema:
# - flag_key (string)
# - solved (boolean)
# - solved_date (datetime)
# - failed_attempts (integer)
# - vm_id (integer)
```

**Compatibility**: ✅ Matches our assumptions - flags have `flag_key`, `solved`, `solved_date`.

### SecGenBatch Model
```ruby
# Hacktivity: app/models/sec_gen_batch.rb
class SecGenBatch < ApplicationRecord
  # Key field:
  # - scenario (string) - contains path like "scenarios/ctf/foo.xml"
  
  belongs_to :event
  has_many :vm_sets
end
```

**Compatibility Issue**: 
- Hacktivity field: `scenario` (path to XML file like `"scenarios/ctf/foo.xml"`)
- Our plan assumes: `secgen_scenario` on Mission model

This is OK - we just need to match the `scenario` field value.

---

## Flag Submission Analysis

### FlagService (Hacktivity)
```ruby
# Hacktivity: app/services/flag_service.rb
def self.process_flag(vm, submitted_flag, user, flash)
  # 1. Find matching flags (case-insensitive)
  vm.flags.where("lower(flag_key) = ?", submitted_flag.downcase).each do |flag|
    if !flag.solved
      mark_flag_as_solved!(flag: flag, vm_set: vm_set, user: user, flash: flash)
    end
  end
  
  # 2. Calculate score (percent or early-bird)
  # 3. Update vm_set.score
  # 4. Update user's Result
  # 5. Send ActionCable notifications
end

def self.mark_flag_as_solved!(flag:, vm_set:, user:, flash:)
  flag.solved = true
  flag.solved_date = DateTime.current
  flag.save
  
  # Update streaks
  # Update vm_set first_flag_date / completed_flags_date
end
```

**Compatibility Issue**: Our plan's direct model update approach is too simplistic. It misses:
- Score calculation (percent-based or early-bird)
- Streak tracking
- Result updates  
- ActionCable notifications

**Recommendation**: Call `FlagService.process_flag()` instead of direct update.

### auto_flag_submit Endpoint
```ruby
# Hacktivity: app/controllers/vms_controller.rb
def auto_flag_submit
  submitted_flag = params[:flag]
  submitted_vmname = params[:vm_name]  # <-- Requires VM name!

  if submitted_vmname =~ /server|grader/i
    @vm = Vm.find_by(ovirt_vm_name: submitted_vmname)
    FlagService.process_flag(@vm, submitted_flag, @vm.vm_set&.user, flash)
  end
end
```

**Compatibility Issue**: This endpoint expects `vm_name` (the ovirt_vm_name) and only works for server/grader VMs. It's designed for automated grading from within VMs, not for client-side submission.

**Recommendation**: Don't use `auto_flag_submit`. Instead, use `flag_submit` action which is the user-facing endpoint:

```ruby
# POST /events/:event_id/challenges/:sec_gen_batch_id/vm_sets/:vm_set_id/vms/:id/flag_submit
def flag_submit
  authorize(@vm)
  submitted_flag = params[:flag]
  FlagService.process_flag(@vm, submitted_flag, current_user, flash)
  # ...
end
```

---

## Console/VM Launch URL Analysis

### ovirt_console Endpoint
```ruby
# Route: POST /events/:event_id/challenges/:sec_gen_batch_id/vm_sets/:vm_set_id/vms/:id/ovirt_console
def ovirt_console
  authorize(@vm)
  
  # Handles timer start for timed tests
  # Dispatches console command asynchronously
  # Console file is generated and stored on @vm.console_file
end
```

**URL Helper**:
```ruby
ovirt_console_event_sec_gen_batch_vm_set_vm_path(event, sec_gen_batch, vm_set, vm)
# Example: /hacktivities/5/challenges/10/vm_sets/123/vms/456/ovirt_console
```

**Compatibility**: ✅ Our plan can construct this URL, but we need:
- `event_id` (from `vm_set.sec_gen_batch.event_id`)
- `sec_gen_batch_id` (from `vm_set.sec_gen_batch_id`)
- `vm_set_id`
- `vm_id`

The actual SPICE file download is handled asynchronously - clicking the button triggers the generation.

---

## VmSet Query Analysis

### Finding User's VM Sets
Our plan proposes:
```ruby
::VmSet.joins(:sec_gen_batch)
       .where(sec_gen_batches: { scenario: secgen_scenario })
       .where(user: user, relinquished: false)
```

**Compatibility**: ✅ This is correct, but:
- Table name is `sec_gen_batches` (verified in schema)
- Column is `scenario` (verified)
- Association is `sec_gen_batch` (not `secgen_batch`)

### No `display_name` Method
Our plan's view uses:
```erb
<%= f.select :vm_set_id, 
    options_from_collection_for_select(@available_vm_sets, :id, :display_name) %>
```

**Compatibility Issue**: VmSet doesn't have a `display_name` method.

**Available Fields**:
- `secgen_prefix` - e.g., `"hacktivity_5_10_0_abc123"`
- `sec_gen_batch.title` - The challenge title
- `vms.count` - Number of VMs

**Fix**: Use a custom method or inline logic:
```erb
<%= f.select :vm_set_id, 
    @available_vm_sets.map { |vs| ["#{vs.sec_gen_batch.title} (#{vs.vms.count} VMs)", vs.id] } %>
```

---

## Authorization Considerations

### VmPolicy
```ruby
def user_allocated_vm_set?
  @vm_set = @record.vm_set
  admin? || 
  scoped_vip_by_user?(@vm_set.user) || 
  (@vm_set.user == @user && @user.has_event_role?(@vm_set.sec_gen_batch.event)) ||
  @vm_set.team&.users&.exists?(@user.id)
end
```

**Key Requirements**:
1. User must own the vm_set (`vm_set.user == current_user`)
2. User must have event role (`user.has_event_role?(event)`)
3. OR user is on the team that owns the vm_set
4. OR user is admin/VIP

**Compatibility**: ✅ Our plan correctly queries user's own vm_sets.

---

## Required Plan Updates

### 1. Fix `submit_to_hacktivity` Method

**Current (Wrong)**:
```ruby
def submit_to_hacktivity(flag_key)
  flag.update!(solved: true, solved_date: Time.current)
end
```

**Corrected**:
```ruby
def submit_to_hacktivity(flag_key)
  return unless defined?(::VmSet) && player_state['vm_set_id'].present?
  
  vm_set = ::VmSet.find_by(id: player_state['vm_set_id'])
  return unless vm_set
  
  # Find the flag and its VM
  vm_set.vms.each do |vm|
    flag = vm.flags.find_by("lower(flag_key) = ?", flag_key.downcase)
    next unless flag
    
    # Use FlagService for proper scoring, streaks, and notifications
    # NOTE: We pass nil for flash since we're not in a web request context
    #       The service will still update the flag and scores
    ::FlagService.process_flag(vm, flag_key, vm_set.user || player, OpenStruct.new(
      :[]= => ->(k,v) { Rails.logger.info "[BreakEscape] Flag result: #{k}: #{v}" }
    ))
    
    return # Only process once
  end
end
```

### 2. Fix VmSet Query

**Current (Minor Issue)**:
```ruby
::VmSet.joins(:sec_gen_batch)
```

**Corrected** (already correct, just verify):
```ruby
::VmSet.joins(:sec_gen_batch)
       .where(sec_gen_batches: { scenario: secgen_scenario })
       .where(user: user, relinquished: false)
       .includes(:vms, :sec_gen_batch)  # Add eager loading
```

### 3. Fix VM Set Display

**Current (Won't Work)**:
```erb
options_from_collection_for_select(@available_vm_sets, :id, :display_name)
```

**Corrected**:
```erb
@available_vm_sets.map { |vs| 
  ["#{vs.sec_gen_batch.title} (#{vs.vms.count} VMs)", vs.id] 
}
```

### 4. Add VM Launch URL Helper

Add a helper method to construct the console URL:

```ruby
# In Game model or a helper
def hacktivity_console_url(vm)
  return nil unless defined?(::Rails) && vm.respond_to?(:vm_set)
  
  vm_set = vm.vm_set
  sec_gen_batch = vm_set.sec_gen_batch
  event = sec_gen_batch.event
  
  # Use Hacktivity's route helpers
  Rails.application.routes.url_helpers.ovirt_console_event_sec_gen_batch_vm_set_vm_path(
    event, sec_gen_batch, vm_set, vm
  )
end
```

### 5. Update ERB VM Context Structure

**Current**:
```ruby
context[:vms] = vm_set.vms.map do |vm|
  {
    id: vm.id,
    title: vm.title,
    description: vm.description,
    ip_address: vm.ip_address,
    vm_set_id: vm_set.id
  }
end
```

**Enhanced** (add console URL info):
```ruby
context[:vms] = vm_set.vms.map do |vm|
  {
    id: vm.id,
    title: vm.title,
    description: vm.description,
    ip_address: vm.ip_address,
    vm_set_id: vm_set.id,
    enable_console: vm.enable_console,
    # Store IDs needed to construct console URL client-side
    event_id: vm_set.sec_gen_batch.event_id,
    sec_gen_batch_id: vm_set.sec_gen_batch_id
  }
end
```

---

## Summary of Required Changes

| Item | Severity | Change Required |
|------|----------|-----------------|
| Flag submission method | High | Use `FlagService.process_flag()` instead of direct update |
| VmSet display_name | Medium | Use inline map instead of collection method |
| VM context structure | Medium | Add event_id, sec_gen_batch_id for console URLs |
| Eager loading | Low | Add `.includes(:vms, :sec_gen_batch)` to VmSet query |

---

## Verified Compatible Items

| Item | Status | Notes |
|------|--------|-------|
| VmSet → sec_gen_batch association | ✅ | Uses `belongs_to :sec_gen_batch` |
| Vm → flags association | ✅ | Uses `has_many :flags` |
| Flag model structure | ✅ | Has `flag_key`, `solved`, `solved_date` |
| VmSet user ownership | ✅ | Has `belongs_to :user, optional: true` |
| VM ip_address field | ✅ | Available on Vm model |
| VM title field | ✅ | Available (e.g., "desktop", "server") |
| Console endpoint | ✅ | POST to nested route works |
| Scenario matching | ✅ | Can match on `sec_gen_batches.scenario` |
