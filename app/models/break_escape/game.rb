module BreakEscape
  class Game < ApplicationRecord
    self.table_name = 'break_escape_games'

    # Associations
    belongs_to :player, polymorphic: true
    belongs_to :mission, class_name: 'BreakEscape::Mission'

    # Validations
    validates :player, presence: true
    validates :mission, presence: true
    validates :status, inclusion: { in: %w[in_progress completed abandoned] }

    # Scopes
    scope :active, -> { where(status: 'in_progress') }
    scope :completed, -> { where(status: 'completed') }

    # Callbacks
    before_create :generate_scenario_data
    before_create :initialize_player_state
    before_create :set_started_at

    # Room management
    def unlock_room!(room_id)
      player_state['unlockedRooms'] ||= []
      player_state['unlockedRooms'] << room_id unless player_state['unlockedRooms'].include?(room_id)
      save!
    end

    def room_unlocked?(room_id)
      player_state['unlockedRooms']&.include?(room_id) || start_room?(room_id)
    end

    def start_room?(room_id)
      scenario_data['startRoom'] == room_id
    end

    # Object management
    def unlock_object!(object_id)
      player_state['unlockedObjects'] ||= []
      player_state['unlockedObjects'] << object_id unless player_state['unlockedObjects'].include?(object_id)
      save!
    end

    def object_unlocked?(object_id)
      player_state['unlockedObjects']&.include?(object_id)
    end

    # Inventory management
    def add_inventory_item!(item)
      player_state['inventory'] ||= []
      player_state['inventory'] << item
      save!
    end

    def remove_inventory_item!(item_id)
      player_state['inventory']&.reject! { |item| item['id'] == item_id }
      save!
    end

    # Check if player has a specific key in inventory
    def has_key_in_inventory?(key_id)
      inventory = player_state['inventory'] || []

      Rails.logger.info "[BreakEscape] Checking for key #{key_id} in inventory (#{inventory.length} items)"

      # Check for key with matching key_id
      found = inventory.any? do |item|
        is_match = item['scenarioData']&.dig('key_id') == key_id ||
                   item['scenarioData']&.dig('id') == key_id ||
                   item['key_id'] == key_id ||
                   item['id'] == key_id

        item_key_id = item['scenarioData']&.dig('key_id') || item['key_id']
        item_name = item['scenarioData']&.dig('name') || item['name']
        Rails.logger.debug "[BreakEscape] Inventory item: name=#{item_name}, key_id=#{item_key_id}, is_match=#{is_match}"
        is_match
      end

      Rails.logger.info "[BreakEscape] Key #{key_id} found in inventory: #{found}"
      found
    end

    # Check if player has a lockpick in inventory
    def has_lockpick_in_inventory?
      inventory = player_state['inventory'] || []

      Rails.logger.info "[BreakEscape] Checking for lockpick in inventory (#{inventory.length} items)"

      # Check for lockpick item in scenarioData or at top level
      found = inventory.any? do |item|
        is_lockpick = item['scenarioData']&.dig('type') == 'lockpick' ||
                      item['type'] == 'lockpick'
        Rails.logger.debug "[BreakEscape] Inventory item: type=#{item['type']}, scenarioData.type=#{item['scenarioData']&.dig('type')}, is_lockpick=#{is_lockpick}"
        is_lockpick
      end

      Rails.logger.info "[BreakEscape] Lockpick found in inventory: #{found}"
      found
    end

    # NPC tracking
    def encounter_npc!(npc_id)
      player_state['encounteredNPCs'] ||= []
      unless player_state['encounteredNPCs'].include?(npc_id)
        player_state['encounteredNPCs'] << npc_id
        
        # Try to get NPC display name from scenario for better logging
        npc_display_name = npc_id
        if scenario_data && scenario_data['rooms']
          scenario_data['rooms'].each do |_room_id, room_data|
            npc_data = room_data['npcs']&.find { |npc| npc['id'] == npc_id }
            if npc_data && npc_data['displayName']
              npc_display_name = npc_data['displayName']
              break
            end
          end
        end
        
        Rails.logger.info "[BreakEscape] 🎭 NPC ENCOUNTERED (via encounter_npc!): #{npc_display_name} (#{npc_id})"
        save!
      end
    end

    # Global variables (synced with client)
    def update_global_variables!(variables)
      player_state['globalVariables'] ||= {}
      player_state['globalVariables'].merge!(variables)
      save!
    end

    # Minigame state
    def add_biometric_sample!(sample)
      player_state['biometricSamples'] ||= []
      player_state['biometricSamples'] << sample
      save!
    end

    def add_bluetooth_device!(device)
      player_state['bluetoothDevices'] ||= []
      unless player_state['bluetoothDevices'].any? { |d| d['mac'] == device['mac'] }
        player_state['bluetoothDevices'] << device
      end
      save!
    end

    def add_note!(note)
      player_state['notes'] ||= []
      player_state['notes'] << note
      save!
    end

    # Health management
    def update_health!(value)
      player_state['health'] = value.clamp(0, 100)
      save!
    end

    # Scenario data access
    def room_data(room_id)
      scenario_data.dig('rooms', room_id)
    end

    def filtered_scenario_for_bootstrap
      # Returns scenario data without room contents for lazy-loading
      # This significantly reduces initial payload by only sending metadata
      filtered = scenario_data.deep_dup

      # Remove all room contents - they'll be lazy-loaded via /room/:room_id endpoint
      if filtered['rooms'].present?
        filtered['rooms'].each do |room_id, room_data|
          # Keep only essential fields for navigation and metadata
          # keyPins MUST be included: Door locks need pin configuration at interaction time,
          # before the connected room is lazy-loaded. Without keyPins here, lockpicking uses random pins.
          kept_fields = {}
          %w[type connections locked lockType requires difficulty door_sign keyPins].each do |field|
            kept_fields[field] = room_data[field] if room_data.key?(field)
          end

          # Replace room data with filtered version
          filtered['rooms'][room_id] = kept_fields
        end
      end

      filtered
    end

    def filtered_room_data(room_id)
      room = room_data(room_id)&.deep_dup
      return nil unless room

      # Remove ONLY the 'requires' field (the solution) and locked 'contents'
      # Keep lockType, locked, observations visible to client
      filter_requires_and_contents_recursive(room)

      room
    end

    # Unlock validation
    def validate_unlock(target_type, target_id, attempt, method)
      Rails.logger.info "[BreakEscape] validate_unlock: type=#{target_type}, id=#{target_id}, attempt=#{attempt}, method=#{method}"

      if target_type == 'door'
        # Check if already unlocked in player state (grants access regardless of method)
        if room_unlocked?(target_id)
          Rails.logger.info "[BreakEscape] Door already unlocked in player state, granting access"
          return true
        end

        room = room_data(target_id)
        return false unless room

        Rails.logger.debug "[BreakEscape] Room data: locked=#{room['locked']}, lockType=#{room['lockType']}, requires=#{room['requires']}"

        # If room is LOCKED, it requires validation
        if room['locked']
          Rails.logger.info "[BreakEscape] Room is LOCKED, method must be valid: #{method}"

          # Handle method='unlocked' - REJECT for locked doors
          if method == 'unlocked'
            Rails.logger.warn "[BreakEscape] SECURITY VIOLATION: Client sent method='unlocked' for LOCKED door: #{target_id}"
            return false
          end

          # NPC unlock: Validate NPC has been encountered and has permission to unlock this door
          if method == 'npc'
            npc_id = attempt  # NPC id is passed as 'attempt'
            return validate_npc_unlock(npc_id, target_id)
          end

          result = case method
          when 'key'
            # Server validates player has the correct key in inventory
            is_valid = room['requires'].present? && has_key_in_inventory?(room['requires'])
            Rails.logger.info "[BreakEscape] Key validation result: #{is_valid}"
            is_valid
          when 'lockpick'
            # Server validates player has lockpick in inventory
            # Lockpick can bypass any key-based lock
            is_valid = has_lockpick_in_inventory?
            Rails.logger.info "[BreakEscape] Lockpick validation result: #{is_valid}"
            is_valid
          when 'biometric', 'bluetooth', 'rfid'
            # Client validated these - trust it
            # (player had fingerprint, had bluetooth device, had RFID card)
            Rails.logger.info "[BreakEscape] #{method} validation passed (trusted client)"
            true
          when 'pin', 'password'
            # Server validates password/PIN attempts
            is_valid = room['requires'].to_s == attempt.to_s
            Rails.logger.info "[BreakEscape] #{method} validation result: #{is_valid}"
            is_valid
          else
            Rails.logger.warn "[BreakEscape] SECURITY VIOLATION: No valid unlock method for LOCKED door: #{target_id}, method=#{method}"
            false
          end

          Rails.logger.info "[BreakEscape] validate_unlock returning: #{result}"
          result
        else
          # Room is unlocked
          if method == 'unlocked'
            Rails.logger.info "[BreakEscape] Door is unlocked in scenario data, granting access"
            true
          else
            Rails.logger.warn "[BreakEscape] Client sent method='#{method}' for UNLOCKED door: #{target_id}, but room has no lock"
            true # Still allow access since room is unlocked
          end
        end
      else
        # Check if already unlocked in player state (grants access regardless of method)
        if object_unlocked?(target_id)
          Rails.logger.info "[BreakEscape] Object already unlocked in player state, granting access"
          return true
        end

        # Find object in all rooms - check both id and name
        scenario_data['rooms'].each do |_room_id, room_data|
          object = room_data['objects']&.find { |obj|
            obj['id'] == target_id || obj['name'] == target_id
          }

          if object
            Rails.logger.info "[BreakEscape] Found object: id=#{object['id']}, name=#{object['name']}, locked=#{object['locked']}, requires=#{object['requires']}"

            # Handle method='unlocked' - verify against scenario data
            if method == 'unlocked'
              if !object['locked']
                Rails.logger.info "[BreakEscape] Object is unlocked in scenario data, granting access"
                return true
              else
                Rails.logger.warn "[BreakEscape] SECURITY VIOLATION: Client sent method='unlocked' for LOCKED object: #{target_id}"
                return false
              end
            end

            # NPC unlock: Validate NPC has been encountered and has permission to unlock this object
            if method == 'npc'
              npc_id = attempt  # NPC id is passed as 'attempt'
              return validate_npc_unlock(npc_id, target_id)
            end

            case method
            when 'key', 'lockpick', 'biometric', 'bluetooth', 'rfid'
              # Client validated the unlock - trust it
              return true
            when 'pin', 'password'
              result = object['requires'].to_s == attempt.to_s
              Rails.logger.info "[BreakEscape] Password validation: required='#{object['requires']}', attempt='#{attempt}', result=#{result}"
              return result
            end
          end
        end
        Rails.logger.warn "[BreakEscape] Object not found: #{target_id}"
        false
      end
    end

    # Validate NPC unlock permission
    def validate_npc_unlock(npc_id, target_id)
      Rails.logger.info "[BreakEscape] Validating NPC unlock: npc=#{npc_id}, target=#{target_id}"

      # Find NPC in scenario data
      npc = find_npc_in_scenario(npc_id)
      unless npc
        Rails.logger.warn "[BreakEscape] NPC not found: #{npc_id}"
        return false
      end

      # Check if player has encountered this NPC
      unless player_state['encounteredNPCs']&.include?(npc_id)
        Rails.logger.warn "[BreakEscape] Player has not encountered NPC: #{npc_id}"
        return false
      end

      # Check if NPC has permission to unlock this target
      unlockable = npc['unlockable']
      unless unlockable.is_a?(Array) && unlockable.include?(target_id)
        Rails.logger.warn "[BreakEscape] NPC #{npc_id} does not have permission to unlock #{target_id}"
        return false
      end

      Rails.logger.info "[BreakEscape] NPC unlock validated: #{npc_id} can unlock #{target_id}"
      true
    end

    # Find NPC in scenario data
    def find_npc_in_scenario(npc_id)
      scenario_data['rooms']&.each do |_room_id, room_data|
        room_data['npcs']&.each do |npc|
          return npc if npc['id'] == npc_id
        end
      end
      nil
    end

    # ==========================================
    # Objectives System
    # ==========================================

    # Initialize objectives state structure
    def initialize_objectives
      return unless scenario_data['objectives'].present?

      player_state['objectivesState'] ||= {
        'aims' => {},      # { aimId: { status, completedAt } }
        'tasks' => {},     # { taskId: { status, progress, completedAt } }
        'itemCounts' => {} # { itemType: count } for collect objectives
      }
    end

    # Complete a task with server-side validation
    def complete_task!(task_id, validation_data = {})
      initialize_objectives

      task = find_task_in_scenario(task_id)
      return { success: false, error: 'Task not found' } unless task

      # Check if already completed
      if player_state.dig('objectivesState', 'tasks', task_id, 'status') == 'completed'
        return { success: true, taskId: task_id, message: 'Already completed' }
      end

      # Validate based on task type
      case task['type']
      when 'collect_items'
        unless validate_collection(task)
          return { success: false, error: 'Insufficient items collected' }
        end
      when 'unlock_room'
        unless room_unlocked?(task['targetRoom'])
          return { success: false, error: 'Room not unlocked' }
        end
      when 'unlock_object'
        unless object_unlocked?(task['targetObject'])
          return { success: false, error: 'Object not unlocked' }
        end
      when 'npc_conversation'
        target_npc = task['targetNPC'] || task['targetNpc']
        unless npc_encountered?(target_npc)
          return { success: false, error: 'NPC not encountered' }
        end
      when 'enter_room'
        # Room entry is validated by the client having discovered the room
        # Trust the client for this low-stakes validation
      when 'custom'
        # Custom tasks are completed via ink tags - no validation needed
      end

      # Mark task complete
      player_state['objectivesState']['tasks'][task_id] = {
        'status' => 'completed',
        'completedAt' => Time.current.iso8601
      }

      # Process onComplete actions
      process_task_completion(task)

      # Check if aim is now complete
      check_aim_completion(task['aimId'])

      # Update statistics
      self.tasks_completed = (self.tasks_completed || 0) + 1

      save!
      { success: true, taskId: task_id }
    end

    # Update task progress (for collect_items tasks)
    def update_task_progress!(task_id, progress)
      initialize_objectives

      player_state['objectivesState']['tasks'][task_id] ||= {}
      player_state['objectivesState']['tasks'][task_id]['progress'] = progress
      save!

      { success: true, taskId: task_id, progress: progress }
    end

    # Get current objectives state
    def objectives_state
      {
        'objectives' => scenario_data['objectives'],
        'state' => player_state['objectivesState'] || {}
      }
    end

    # Aim/Task status helpers
    def aim_status(aim_id)
      player_state.dig('objectivesState', 'aims', aim_id, 'status') || 'active'
    end

    def task_status(task_id)
      player_state.dig('objectivesState', 'tasks', task_id, 'status') || 'active'
    end

    def task_progress(task_id)
      player_state.dig('objectivesState', 'tasks', task_id, 'progress') || 0
    end

    private

    # Find a task in scenario objectives by taskId
    def find_task_in_scenario(task_id)
      scenario_data['objectives']&.each do |aim|
        task = aim['tasks']&.find { |t| t['taskId'] == task_id }
        return task.merge('aimId' => aim['aimId']) if task
      end
      nil
    end

    # Validate collection tasks
    def validate_collection(task)
      inventory = player_state['inventory'] || []
      target_items = Array(task['targetItems'])
      count = inventory.count do |item|
        item_type = item['type'] || item.dig('scenarioData', 'type')
        target_items.include?(item_type)
      end
      count >= (task['targetCount'] || 1)
    end

    # Check if NPC was encountered
    def npc_encountered?(npc_id)
      player_state['encounteredNPCs']&.include?(npc_id)
    end

    # Process task.onComplete actions
    def process_task_completion(task)
      return unless task['onComplete']

      if task['onComplete']['unlockTask']
        unlock_objective_task!(task['onComplete']['unlockTask'])
      end

      if task['onComplete']['unlockAim']
        unlock_objective_aim!(task['onComplete']['unlockAim'])
      end
    end

    # Unlock a task (change status to active)
    def unlock_objective_task!(task_id)
      player_state['objectivesState']['tasks'][task_id] ||= {}
      player_state['objectivesState']['tasks'][task_id]['status'] = 'active'
    end

    # Unlock an aim (change status to active)
    def unlock_objective_aim!(aim_id)
      player_state['objectivesState']['aims'][aim_id] ||= {}
      player_state['objectivesState']['aims'][aim_id]['status'] = 'active'
    end

    # Check if all tasks in an aim are complete
    def check_aim_completion(aim_id)
      aim = scenario_data['objectives']&.find { |a| a['aimId'] == aim_id }
      return unless aim

      all_complete = aim['tasks'].all? do |task|
        task_status(task['taskId']) == 'completed'
      end

      if all_complete
        player_state['objectivesState']['aims'][aim_id] = {
          'status' => 'completed',
          'completedAt' => Time.current.iso8601
        }
        self.objectives_completed = (self.objectives_completed || 0) + 1
      end
    end

    # ==========================================
    # End Objectives System
    # ==========================================

    def filter_requires_and_contents_recursive(obj)
      case obj
      when Hash
        # Remove 'requires' for exploitable lock types (key/pin/password)
        # Keep it for biometric/bluetooth/rfid since they reference collectible items, not answers
        # - biometric: requires fingerprint owner name (e.g., "Mrs Moo")
        # - bluetooth: requires device MAC/name (e.g., "00:11:22:33:44:55")
        # - rfid: requires card IDs (e.g., ["master_keycard"])
        lock_type = obj['lockType']
        if lock_type && !%w[biometric bluetooth rfid].include?(lock_type)
          obj.delete('requires')
        end

        # Remove 'contents' if locked (lazy-loaded via separate endpoint)
        obj.delete('contents') if obj['locked']

        # Keep lockType - client needs it to show correct UI
        # Keep locked - client needs it to show lock status

        # Recursively filter nested objects and NPCs
        obj['objects']&.each { |o| filter_requires_and_contents_recursive(o) }
        obj['npcs']&.each { |n| filter_requires_and_contents_recursive(n) }

      when Array
        obj.each { |item| filter_requires_and_contents_recursive(item) }
      end
    end

    def generate_scenario_data
      # Only generate scenario data if it's not already set (e.g., in tests)
      return if self.scenario_data.present?

      # Build VM context only if mission requires VMs and we're in Hacktivity mode
      vm_context = if mission&.requires_vms? && BreakEscape::Mission.hacktivity_mode?
                     build_vm_context
      else
                     {}
      end

      # Add flags_by_vm and vm_ips from player_state for standalone mode
      state = player_state.is_a?(Hash) ? player_state : {}
      if state['flags_by_vm'].present?
        vm_context['flags_by_vm'] = state['flags_by_vm']
      end
      if state['vm_ips'].present?
        vm_context['vm_ips'] = state['vm_ips']
      end

      # Generate with VM context (or empty context for non-VM missions)
      self.scenario_data = mission.generate_scenario_data(vm_context)
    end

    def initialize_player_state
      # Ensure player_state is always a hash
      self.player_state = {} unless self.player_state.is_a?(Hash)

      self.player_state['currentRoom'] ||= scenario_data['startRoom']
      self.player_state['unlockedRooms'] ||= [scenario_data['startRoom']]
      self.player_state['unlockedObjects'] ||= []

      # Ensure inventory is always an array, even if it was corrupted
      unless self.player_state['inventory'].is_a?(Array)
        self.player_state['inventory'] = []
      end

      # Initialize starting items from scenario
      if scenario_data && scenario_data['startItemsInInventory']
        start_items = scenario_data['startItemsInInventory']
        if start_items.is_a?(Array)
          # Use dup instead of deep_dup to avoid issues with ActiveSupport extensions
          start_items.each do |item|
            self.player_state['inventory'] << (item.is_a?(Hash) ? item.dup : item)
          end
        else
          Rails.logger.warn "[BreakEscape] startItemsInInventory is not an Array: #{start_items.class}"
        end
      end

      self.player_state['encounteredNPCs'] ||= []
      self.player_state['globalVariables'] ||= {}
      self.player_state['biometricSamples'] ||= []
      self.player_state['biometricUnlocks'] ||= []
      self.player_state['bluetoothDevices'] ||= []
      self.player_state['notes'] ||= []
      self.player_state['health'] ||= 100

      # VM/Flag tracking fields
      self.player_state['submitted_flags'] ||= []       # Array of submitted flag strings
      self.player_state['flag_rewards_claimed'] ||= []  # Track claimed rewards
      self.player_state['pending_events'] ||= []        # Events to emit on next sync
    end

    def set_started_at
      self.started_at ||= Time.current
    end

    # Build VM context from player_state vm_set_id (Hacktivity mode only)
    def build_vm_context
      # CRITICAL: player_state may still be a JSON string during callbacks
      # Ensure it's a hash before attempting to access it
      state = player_state.is_a?(Hash) ? player_state : {}
      vm_set_id = state['vm_set_id']

      return {} unless vm_set_id && BreakEscape::Mission.hacktivity_mode?

      vm_set = ::VmSet.find_by(id: vm_set_id)
      return {} unless vm_set

      # Build context hash for ERB template
      {
        'vm_set_id' => vm_set.id,
        'vms' => vm_set.vms.map do |vm|
          {
            'id' => vm.id,
            'title' => vm.title,
            'ip' => vm.ip_address,
            'enable_console' => vm.enable_console,
            'event_id' => vm.event_id,
            'sec_gen_batch_id' => vm.sec_gen_batch_id
          }
        end,
        'flags' => extract_flags_from_vm_set(vm_set),
        'hacktivity_mode' => true
      }
    end

    # Extract flags from VM set's SecGenBatch
    def extract_flags_from_vm_set(vm_set)
      return [] unless vm_set.sec_gen_batch&.flags.present?

      vm_set.sec_gen_batch.flags.map do |flag|
        {
          'id' => flag.id,
          'value' => flag.flag,  # The actual flag string
          'points' => flag.points
        }
      end
    end

    public

    # ==========================================
    # Flag Submission System
    # ==========================================

    # Submit a CTF flag
    def submit_flag(flag_key)
      # Check if already submitted
      if flag_submitted?(flag_key)
        return { success: false, message: 'Flag already submitted' }
      end

      # Validate flag exists in scenario
      valid_flags = extract_valid_flags_from_scenario
      unless valid_flags.any? { |f| f.downcase == flag_key.downcase }
        return { success: false, message: 'Invalid flag' }
      end

      # Submit to Hacktivity if in Hacktivity mode
      if BreakEscape::Mission.hacktivity_mode? && player_state['vm_set_id'].present?
        result = submit_to_hacktivity(flag_key)
        return result unless result[:success]
      end

      # Track submission
      player_state['submitted_flags'] ||= []
      player_state['submitted_flags'] << flag_key
      save!

      { success: true, message: 'Flag accepted!' }
    end

    # Check if flag was already submitted
    def flag_submitted?(flag_key)
      player_state['submitted_flags']&.any? { |f| f.downcase == flag_key.downcase }
    end

    private

    # Extract valid flags from scenario data (flag-station objects)
    def extract_valid_flags_from_scenario
      flags = []

      # Check standalone flags first (flat list for backward compatibility)
      if player_state['standalone_flags'].present?
        flags.concat(player_state['standalone_flags'])
      end

      # Check flags_by_vm (new XML-based format)
      if player_state['flags_by_vm'].present?
        player_state['flags_by_vm'].each_value do |vm_flags|
          flags.concat(vm_flags) if vm_flags.is_a?(Array)
        end
      end

      # Extract from flag-station objects in scenario
      scenario_data['rooms']&.each do |_room_id, room|
        room['objects']&.each do |obj|
          next unless obj['type'] == 'flag-station'
          flags.concat(obj['flags']) if obj['flags'].is_a?(Array)
        end
      end

      flags.uniq
    end

    # Submit flag to Hacktivity's FlagService
    def submit_to_hacktivity(flag_key)
      return { success: false, message: 'FlagService not available' } unless defined?(::FlagService)

      begin
        # FlagService.process_flag requires: player, flag, flash
        # We create a mock flash object since we're not in a controller context
        mock_flash = {}

        result = ::FlagService.process_flag(player, flag_key, mock_flash)

        if result
          { success: true, message: mock_flash[:notice] || 'Flag submitted to Hacktivity' }
        else
          { success: false, message: mock_flash[:alert] || 'Flag rejected by Hacktivity' }
        end
      rescue StandardError => e
        Rails.logger.error "[BreakEscape] FlagService error: #{e.message}"
        { success: false, message: 'Error submitting flag to Hacktivity' }
      end
    end
  end
end
