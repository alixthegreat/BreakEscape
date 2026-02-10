#!/usr/bin/env ruby
# frozen_string_literal: true

# Break Escape Scenario Validator
# Validates scenario.json.erb files by rendering ERB to JSON and checking against schema
#
# Usage:
#   ruby scripts/validate_scenario.rb scenarios/ceo_exfil/scenario.json.erb
#   ruby scripts/validate_scenario.rb scenarios/ceo_exfil/scenario.json.erb --schema scripts/scenario-schema.json

require 'erb'
require 'json'
require 'optparse'
require 'pathname'
require 'set'

# Try to load json-schema gem, provide helpful error if missing
begin
  require 'json-schema'
rescue LoadError
  $stderr.puts <<~ERROR
    ERROR: json-schema gem is required for validation.

    Install it with:
      gem install json-schema

    Or add to Gemfile:
      gem 'json-schema'

    Then run: bundle install
  ERROR
  exit 1
end

# ScenarioBinding class - replicates the one from app/models/break_escape/mission.rb
class ScenarioBinding
  def initialize(vm_context = {})
    require 'securerandom'
    @random_password = SecureRandom.alphanumeric(8)
    @random_pin = rand(1000..9999).to_s
    @random_code = SecureRandom.hex(4)
    @vm_context = vm_context || {}
  end

  attr_reader :random_password, :random_pin, :random_code, :vm_context

  # Get a VM from the context by title, or return a fallback VM object
  def vm_object(title, fallback = {})
    if vm_context && vm_context['hacktivity_mode'] && vm_context['vms']
      vm = vm_context['vms'].find { |v| v['title'] == title }
      return vm.to_json if vm
    end

    result = fallback.dup
    if vm_context && vm_context['vm_ips'] && vm_context['vm_ips'][title]
      result['ip'] = vm_context['vm_ips'][title]
    end
    result.to_json
  end

  # Get flags for a specific VM from the context
  def flags_for_vm(vm_name, fallback = [])
    if vm_context && vm_context['flags_by_vm']
      flags = vm_context['flags_by_vm'][vm_name]
      return flags.to_json if flags
    end
    fallback.to_json
  end

  def get_binding
    binding
  end
end

# Render ERB template to JSON
def render_erb_to_json(erb_path, vm_context = {})
  unless File.exist?(erb_path)
    raise "ERB file not found: #{erb_path}"
  end

  erb_content = File.read(erb_path)
  erb = ERB.new(erb_content)
  binding_context = ScenarioBinding.new(vm_context)
  json_output = erb.result(binding_context.get_binding)

  JSON.parse(json_output)
rescue JSON::ParserError => e
  raise "Invalid JSON after ERB processing: #{e.message}\n\nGenerated JSON:\n#{json_output}"
rescue StandardError => e
  raise "Error processing ERB: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
end

# Validate JSON against schema
def validate_json(json_data, schema_path)
  unless File.exist?(schema_path)
    raise "Schema file not found: #{schema_path}"
  end

  schema = JSON.parse(File.read(schema_path))
  errors = JSON::Validator.fully_validate(schema, json_data, strict: false)

  errors
rescue JSON::ParserError => e
  raise "Invalid JSON schema: #{e.message}"
end

# Check for common issues and structural problems
def check_common_issues(json_data)
  issues = []
  start_room_id = json_data['startRoom']

  # Valid directions for room connections
  valid_directions = %w[north south east west]

  # Track features for suggestions
  has_vm_launcher = false
  has_flag_station = false
  has_pc_with_files = false
  has_phone_npc_with_messages = false
  has_phone_npc_with_events = false
  has_opening_cutscene = false
  has_closing_debrief = false
  has_person_npcs = false
  has_npc_with_waypoints = false
  has_phone_contacts = false
  phone_npcs_without_messages = []
  lock_types_used = Set.new
  has_rfid_lock = false
  has_bluetooth_lock = false
  has_pin_lock = false
  has_password_lock = false
  has_key_lock = false
  has_security_tools = false
  has_container_with_contents = false
  has_readable_items = false

  # Check rooms
  if json_data['rooms']
    json_data['rooms'].each do |room_id, room|
      # Check for invalid room connection directions (diagonal directions)
      if room['connections']
        room['connections'].each do |direction, target|
          unless valid_directions.include?(direction)
            issues << "❌ INVALID: Room '#{room_id}' uses invalid direction '#{direction}' - only north, south, east, west are valid (not northeast, southeast, etc.)"
          end

          # Check reverse connections if target is a single room
          if target.is_a?(String) && json_data['rooms'][target]
            reverse_dir = case direction
            when 'north' then 'south'
            when 'south' then 'north'
            when 'east' then 'west'
            when 'west' then 'east'
            end
            target_room = json_data['rooms'][target]
            if target_room['connections']
              has_reverse = target_room['connections'].any? do |dir, targets|
                (dir == reverse_dir) && (targets == room_id || (targets.is_a?(Array) && targets.include?(room_id)))
              end
              unless has_reverse
                issues << "⚠ WARNING: Room '#{room_id}' connects #{direction} to '#{target}', but '#{target}' doesn't connect #{reverse_dir} back - bidirectional connections recommended"
              end
            end
          end
        end
      end

      # Check room objects
      if room['objects']
        room['objects'].each_with_index do |obj, idx|
          path = "rooms/#{room_id}/objects[#{idx}]"

          # Check for incorrect VM launcher configuration (type: "pc" with vmAccess)
          if obj['type'] == 'pc' && obj['vmAccess']
            issues << "❌ INVALID: '#{path}' uses type: 'pc' with vmAccess - should use type: 'vm-launcher' instead. See scenarios/secgen_vm_lab/scenario.json.erb for example"
          end

          # Track VM launchers
          if obj['type'] == 'vm-launcher'
            has_vm_launcher = true
            unless obj['vm']
              issues << "⚠ WARNING: '#{path}' (vm-launcher) missing 'vm' object - use ERB helper vm_object()"
            end
            unless obj.key?('hacktivityMode')
              issues << "⚠ WARNING: '#{path}' (vm-launcher) missing 'hacktivityMode' field"
            end
          end

          # Track flag stations
          if obj['type'] == 'flag-station'
            has_flag_station = true
            unless obj['acceptsVms'] && !obj['acceptsVms'].empty?
              issues << "⚠ WARNING: '#{path}' (flag-station) missing or empty 'acceptsVms' array"
            end
            unless obj['flags']
              issues << "⚠ WARNING: '#{path}' (flag-station) missing 'flags' array - use ERB helper flags_for_vm()"
            end
          end

          # Check for PC containers with files
          if obj['type'] == 'pc' && obj['contents'] && obj['contents'].any? { |item| item['type'] == 'text_file' || item['readable'] }
            has_pc_with_files = true
          end

          # Track containers with contents (safes, suitcases, etc.)
          if (obj['type'] == 'safe' || obj['type'] == 'suitcase') && obj['contents'] && !obj['contents'].empty?
            has_container_with_contents = true
          end

          # REQUIRED: Containers with contents must specify locked field explicitly
          container_types = ['briefcase', 'bag', 'bag1', 'suitcase', 'safe', 'pc', 'bin1']
          if container_types.include?(obj['type']) && obj['contents'] && !obj['contents'].empty?
            unless obj.key?('locked')
              issues << "❌ INVALID: '#{path}' is a container with contents but missing required 'locked' field - must be explicitly true or false for server-side validation"
            end
          end

          # Track readable items (notes, documents)
          if obj['readable'] || (obj['type'] == 'notes' && obj['text'])
            has_readable_items = true
          end

          # Track security tools
          if ['fingerprint_kit', 'pin-cracker', 'bluetooth_scanner', 'rfid_cloner'].include?(obj['type'])
            has_security_tools = true
          end

          # Track lock types
          if obj['locked'] && obj['lockType']
            lock_types_used.add(obj['lockType'])
            case obj['lockType']
            when 'rfid'
              has_rfid_lock = true
            when 'bluetooth'
              has_bluetooth_lock = true
            when 'pin'
              has_pin_lock = true
            when 'password'
              has_password_lock = true
            when 'key'
              has_key_lock = true
              # Check for key locks without keyPins (REQUIRED, not recommended)
              unless obj['keyPins']
                issues << "❌ INVALID: '#{path}' has lockType: 'key' but missing required 'keyPins' array - key locks must specify keyPins array for lockpicking minigame"
              end
            end
          end

          # Check for key items without keyPins (REQUIRED, not recommended)
          if obj['type'] == 'key' && !obj['keyPins']
            issues << "❌ INVALID: '#{path}' (key item) missing required 'keyPins' array - key items must specify keyPins array for lockpicking"
          end

          # Check for items with id field (should use type field for #give_item tags)
          if obj['itemsHeld']
            obj['itemsHeld'].each_with_index do |item, item_idx|
              if item['id']
                issues << "❌ INVALID: '#{path}/itemsHeld[#{item_idx}]' has 'id' field - items should NOT have 'id' field. Use 'type' field to match #give_item tag parameter"
              end
            end
          end
        end
      end

      # Track room lock types
      if room['locked'] && room['lockType']
        lock_types_used.add(room['lockType'])
        case room['lockType']
        when 'rfid'
          has_rfid_lock = true
        when 'bluetooth'
          has_bluetooth_lock = true
        when 'pin'
          has_pin_lock = true
        when 'password'
          has_password_lock = true
        when 'key'
          has_key_lock = true
          # Check for key locks without keyPins (REQUIRED, not recommended)
          unless room['keyPins']
            issues << "❌ INVALID: 'rooms/#{room_id}' has lockType: 'key' but missing required 'keyPins' array - key locks must specify keyPins array for lockpicking minigame"
          end
        end
      end

      # Check NPCs in rooms
      if room['npcs']
        room['npcs'].each_with_index do |npc, idx|
          path = "rooms/#{room_id}/npcs[#{idx}]"

          # Track person NPCs
          if npc['npcType'] == 'person' || (!npc['npcType'] && npc['position'])
            has_person_npcs = true

            # Check for waypoints in behavior.patrol
            if npc['behavior'] && npc['behavior']['patrol']
              patrol = npc['behavior']['patrol']
              # Check for single-room waypoints
              if patrol['waypoints'] && !patrol['waypoints'].empty?
                has_npc_with_waypoints = true
              end
              # Check for multi-room route waypoints
              if patrol['route'] && patrol['route'].is_a?(Array) && patrol['route'].any? { |segment| segment['waypoints'] && !segment['waypoints'].empty? }
                has_npc_with_waypoints = true
              end
            end
          end

          # Check for opening cutscene in starting room
          if room_id == start_room_id && npc['timedConversation']
            has_opening_cutscene = true
            if npc['timedConversation']['delay'] != 0
              issues << "⚠ WARNING: '#{path}' timedConversation delay is #{npc['timedConversation']['delay']} - opening cutscenes typically use delay: 0"
            end
          end

          # Validate timedConversation structure
          if npc['timedConversation']
            tc = npc['timedConversation']
            # Check for incorrect property name
            if tc['knot'] && !tc['targetKnot']
              issues << "❌ INVALID: '#{path}' timedConversation uses 'knot' property - should use 'targetKnot' instead. Change 'knot' to 'targetKnot'"
            end
            # Check for missing targetKnot
            unless tc['targetKnot']
              issues << "❌ INVALID: '#{path}' timedConversation missing required 'targetKnot' property - must specify the Ink knot to navigate to"
            end
            # Check for missing delay
            unless tc.key?('delay')
              issues << "⚠ WARNING: '#{path}' timedConversation missing 'delay' property - should specify delay in milliseconds (0 for immediate)"
            end
          end

          # Track phone NPCs (phone contacts)
          if npc['npcType'] == 'phone'
            has_phone_contacts = true

            # Validate phone NPC structure - should have phoneId
            unless npc['phoneId']
              issues << "❌ INVALID: '#{path}' (phone NPC) missing required 'phoneId' field - phone NPCs must specify which phone they appear on (e.g., 'player_phone')"
            end

            # Validate phone NPC structure - should have storyPath
            unless npc['storyPath']
              issues << "❌ INVALID: '#{path}' (phone NPC) missing required 'storyPath' field - phone NPCs must have a path to their Ink story JSON file"
            end

            # Validate phone NPC structure - should NOT have position (phone NPCs don't have positions)
            if npc['position']
              issues << "⚠ WARNING: '#{path}' (phone NPC) has 'position' field - phone NPCs should NOT have position (they're not in-world sprites). Remove the position field."
            end

            # Validate phone NPC structure - should NOT have spriteSheet (phone NPCs don't have sprites)
            if npc['spriteSheet']
              issues << "⚠ WARNING: '#{path}' (phone NPC) has 'spriteSheet' field - phone NPCs should NOT have spriteSheet (they're not in-world sprites). Remove the spriteSheet field."
            end

            # Track phone NPCs with messages in rooms
            if npc['timedMessages'] && !npc['timedMessages'].empty?
              has_phone_npc_with_messages = true
            else
              # Track phone NPCs without timed messages
              phone_npcs_without_messages << "#{path} (#{npc['displayName'] || npc['id']})"
            end

            # Track phone NPCs with event mappings in rooms
            if npc['eventMappings'] && !npc['eventMappings'].empty?
              has_phone_npc_with_events = true
            end
          end

          # Check for items with id field in NPC itemsHeld
          if npc['itemsHeld']
            npc['itemsHeld'].each_with_index do |item, item_idx|
              if item['id']
                issues << "❌ INVALID: '#{path}/itemsHeld[#{item_idx}]' has 'id' field - items should NOT have 'id' field. Use 'type' field to match #give_item tag parameter (e.g., type: 'id_badge' matches #give_item:id_badge)"
              end

              # Track security tools in NPC itemsHeld
              if ['fingerprint_kit', 'pin-cracker', 'bluetooth_scanner', 'rfid_cloner'].include?(item['type'])
                has_security_tools = true
              end
            end
          end
        end
      end
    end
  end

  # Check startItemsInInventory for security tools and readable items
  if json_data['startItemsInInventory']
    json_data['startItemsInInventory'].each do |item|
      # Track security tools
      if ['fingerprint_kit', 'pin-cracker', 'bluetooth_scanner', 'rfid_cloner'].include?(item['type'])
        has_security_tools = true
      end

      # Track readable items
      if item['readable'] || (item['type'] == 'notes' && item['text'])
        has_readable_items = true
      end
    end
  end

  # Check phoneNPCs section - this is the OLD/INCORRECT format
  if json_data['phoneNPCs']
    json_data['phoneNPCs'].each_with_index do |npc, idx|
      path = "phoneNPCs[#{idx}]"

      # Flag incorrect structure - phone NPCs should be in rooms, not phoneNPCs section
      issues << "❌ INVALID: '#{path}' - Phone NPCs should be defined in 'rooms/{room_id}/npcs[]' arrays, NOT in a separate 'phoneNPCs' section. See scenarios/npc-sprite-test3/scenario.json.erb for correct format. Phone NPCs should be in the starting room (or room where phone is accessible) with npcType: 'phone'"

      # Track phone NPCs (phone contacts) - but note they're in wrong location
      has_phone_contacts = true

      # Track phone NPCs with messages
      if npc['timedMessages'] && !npc['timedMessages'].empty?
        has_phone_npc_with_messages = true
      else
        # Track phone NPCs without timed messages
        phone_npcs_without_messages << "#{path} (#{npc['displayName'] || npc['id']})"
      end

      # Track phone NPCs with event mappings (for closing debriefs)
      if npc['eventMappings'] && !npc['eventMappings'].any? { |m| m['eventPattern']&.include?('global_variable_changed') }
        has_phone_npc_with_events = true
      end

      # Check for closing debrief trigger
      if npc['eventMappings']
        npc['eventMappings'].each do |mapping|
          if mapping['eventPattern']&.include?('global_variable_changed')
            has_closing_debrief = true
          end
        end
      end
    end
  end

  # Feature suggestions
  unless has_vm_launcher
    issues << "💡 SUGGESTION: Consider adding VM launcher terminals (type: 'vm-launcher') - see scenarios/secgen_vm_lab/scenario.json.erb for example"
  end

  unless has_flag_station
    issues << "💡 SUGGESTION: Consider adding flag station terminals (type: 'flag-station') for VM flag submission - see scenarios/secgen_vm_lab/scenario.json.erb for example"
  end

  unless has_pc_with_files
    issues << "💡 SUGGESTION: Consider adding at least one PC container (type: 'pc') with files in 'contents' array and optional post-it notes - see scenarios/ceo_exfil/scenario.json.erb for example"
  end

  unless has_phone_npc_with_messages || has_phone_npc_with_events
    issues << "💡 SUGGESTION: Consider adding at least one phone NPC (in rooms or phoneNPCs section) with timedMessages or eventMappings - see scenarios/ceo_exfil/scenario.json.erb for example"
  end

  unless has_opening_cutscene
    issues << "💡 SUGGESTION: Consider adding opening briefing cutscene - NPC with timedConversation (delay: 0) in starting room - see scenarios/m01_first_contact/scenario.json.erb for example"
  end

  unless has_closing_debrief
    issues << "💡 SUGGESTION: Consider adding closing debrief trigger - phone NPC with eventMapping for global_variable_changed - see scenarios/m01_first_contact/scenario.json.erb for example"
  end

  # Check for NPCs without waypoints
  if has_person_npcs && !has_npc_with_waypoints
    issues << "💡 SUGGESTION: Consider adding waypoints to at least one person NPC for more dynamic patrol behavior - see scenarios/test-npc-waypoints/scenario.json.erb for example. Add 'behavior.patrol.waypoints' array with {x, y} coordinates"
  end

  # Check for phone contacts without timed messages
  if has_phone_contacts && !phone_npcs_without_messages.empty?
    npc_list = phone_npcs_without_messages.join(', ')
    issues << "💡 SUGGESTION: Consider adding timedMessages to phone contacts for more engaging interactions - see scenarios/npc-sprite-test3/scenario.json.erb for example. Phone NPCs without timed messages: #{npc_list}"
  end

      # Suggest variety in lock types
      if lock_types_used.size < 2
        issues << "💡 SUGGESTION: Consider adding variety in lock types - scenarios typically use 2+ different lock mechanisms (key, pin, rfid, password). Currently using: #{lock_types_used.to_a.join(', ') || 'none'}. See scenarios/ceo_exfil/scenario.json.erb for examples"
      end

  # Suggest RFID locks
  unless has_rfid_lock
    issues << "💡 SUGGESTION: Consider adding RFID locks for modern security scenarios - see scenarios/test-rfid/scenario.json.erb for examples"
  end

  # Suggest PIN locks
  unless has_pin_lock
    issues << "💡 SUGGESTION: Consider adding PIN locks for numeric code challenges - see scenarios/ceo_exfil/scenario.json.erb for examples"
  end

  # Suggest password locks
  unless has_password_lock
    issues << "💡 SUGGESTION: Consider adding password locks for computer/device access - see scenarios/ceo_exfil/scenario.json.erb for examples"
  end

  # Suggest security tools
  unless has_security_tools
    issues << "💡 SUGGESTION: Consider adding security tools (fingerprint_kit, pin-cracker, bluetooth_scanner, rfid_cloner) for more interactive gameplay - see scenarios/ceo_exfil/scenario.json.erb for examples"
  end

  # Suggest containers with contents
  unless has_container_with_contents
    issues << "💡 SUGGESTION: Consider adding containers (safes, suitcases) with contents for hidden items and rewards - see scenarios/ceo_exfil/scenario.json.erb for examples"
  end

  # Suggest readable items
  unless has_readable_items
    issues << "💡 SUGGESTION: Consider adding readable items (notes, documents) for storytelling and clues - see scenarios/ceo_exfil/scenario.json.erb for examples"
  end

  issues
end

# Check for recommended fields and return warnings
def check_recommended_fields(json_data)
  warnings = []

  # Top-level recommended fields
  warnings << "Missing recommended field: 'globalVariables' - useful for Ink dialogue state management" unless json_data.key?('globalVariables')
  warnings << "Missing recommended field: 'player' - player sprite configuration improves visual experience" unless json_data.key?('player')

  # Check for objectives with tasks (recommended for structured gameplay)
  if !json_data['objectives'] || json_data['objectives'].empty?
    warnings << "Missing recommended: 'objectives' array with tasks - helps structure gameplay and track progress"
  elsif json_data['objectives'].none? { |obj| obj['tasks'] && !obj['tasks'].empty? }
    warnings << "Missing recommended: objectives should include tasks - objectives without tasks don't provide clear goals"
  end

  # Track if there's at least one NPC with timed conversation (for cut-scenes)
  has_timed_conversation_npc = false

  # Check rooms
  if json_data['rooms']
    json_data['rooms'].each do |room_id, room|
      # Check room objects
      if room['objects']
        room['objects'].each_with_index do |obj, idx|
          path = "rooms/#{room_id}/objects[#{idx}]"
          warnings << "Missing recommended field: '#{path}/observations' - helps players understand what items are" unless obj.key?('observations')
        end
      end


      # Check NPCs
      if room['npcs']
        room['npcs'].each_with_index do |npc, idx|
          path = "rooms/#{room_id}/npcs[#{idx}]"

          # Phone NPCs should have avatar
          if npc['npcType'] == 'phone' && !npc['avatar']
            warnings << "Missing recommended field: '#{path}/avatar' - phone NPCs should have avatar images"
          end

          # Person NPCs should have position
          if npc['npcType'] == 'person' && !npc['position']
            warnings << "Missing recommended field: '#{path}/position' - person NPCs need x,y coordinates"
          end

          # NPCs with storyPath should have currentKnot
          if npc['storyPath'] && !npc['currentKnot']
            warnings << "Missing recommended field: '#{path}/currentKnot' - specifies starting dialogue knot"
          end

          # Check for NPCs without behavior (no storyPath, no timedMessages, no timedConversation, no eventMappings)
          has_behavior = npc['storyPath'] ||
                         (npc['timedMessages'] && !npc['timedMessages'].empty?) ||
                         npc['timedConversation'] ||
                         (npc['eventMappings'] && !npc['eventMappings'].empty?)

          unless has_behavior
            warnings << "Missing recommended: '#{path}' has no behavior - NPCs should have storyPath, timedMessages, timedConversation, or eventMappings"
          end

          # Track timed conversations (for cut-scene recommendation)
          if npc['timedConversation']
            has_timed_conversation_npc = true
          end
        end
      end
    end
  end

  # Check for at least one NPC with timed conversation (recommended for starting cut-scenes)
  unless has_timed_conversation_npc
    warnings << "Missing recommended: No NPCs with 'timedConversation' - consider adding one for immersive starting cut-scenes"
  end

  # Check objectives
  if json_data['objectives']
    json_data['objectives'].each_with_index do |objective, idx|
      path = "objectives[#{idx}]"
      warnings << "Missing recommended field: '#{path}/description' - helps players understand the objective" unless objective.key?('description')

      if objective['tasks']
        objective['tasks'].each_with_index do |task, task_idx|
          task_path = "#{path}/tasks[#{task_idx}]"
          # Tasks with targetCount should have showProgress
          if task['targetCount'] && !task['showProgress']
            warnings << "Missing recommended field: '#{task_path}/showProgress' - shows progress for collect_items tasks"
          end
        end
      end
    end
  end

  # Check startItemsInInventory
  if json_data['startItemsInInventory']
    json_data['startItemsInInventory'].each_with_index do |item, idx|
      path = "startItemsInInventory[#{idx}]"
      warnings << "Missing recommended field: '#{path}/observations' - helps players understand starting items" unless item.key?('observations')
    end
  end

  warnings
end

# Main execution
def main
  options = {
    schema_path: File.join(__dir__, 'scenario-schema.json'),
    verbose: false,
    output_json: false
  }

  OptionParser.new do |opts|
    opts.banner = "Usage: #{$PROGRAM_NAME} <scenario.json.erb> [options]"

    opts.on('-s', '--schema PATH', 'Path to JSON schema file') do |path|
      options[:schema_path] = path
    end

    opts.on('-v', '--verbose', 'Show detailed validation output') do
      options[:verbose] = true
    end

    opts.on('-o', '--output-json', 'Output the rendered JSON to stdout') do
      options[:output_json] = true
    end

    opts.on('-h', '--help', 'Show this help message') do
      puts opts
      exit 0
    end
  end.parse!

  erb_path = ARGV[0]

  if erb_path.nil? || erb_path.empty?
    $stderr.puts "ERROR: No scenario.json.erb file specified"
    $stderr.puts "Usage: #{$PROGRAM_NAME} <scenario.json.erb> [options]"
    exit 1
  end

  erb_path = File.expand_path(erb_path)
  schema_path = File.expand_path(options[:schema_path])

  puts "Validating scenario: #{erb_path}"
  puts "Using schema: #{schema_path}"
  puts

  begin
    # Render ERB to JSON
    puts "Rendering ERB template..."
    json_data = render_erb_to_json(erb_path)
    puts "✓ ERB rendered successfully"
    puts

    # Output JSON if requested
    if options[:output_json]
      puts "Rendered JSON:"
      puts JSON.pretty_generate(json_data)
      puts
    end

    # Validate against schema
    puts "Validating against schema..."
    errors = validate_json(json_data, schema_path)

    # Check for common issues and structural problems
    puts "Checking for common issues..."
    common_issues = check_common_issues(json_data)

    # Check for recommended fields
    puts "Checking recommended fields..."
    warnings = check_recommended_fields(json_data)

    # Report errors
    if errors.empty?
      puts "✓ Schema validation passed!"
    else
      puts "✗ Schema validation failed with #{errors.length} error(s):"
      puts

      errors.each_with_index do |error, index|
        puts "#{index + 1}. #{error}"
        puts
      end

      if options[:verbose]
        puts "Full JSON structure:"
        puts JSON.pretty_generate(json_data)
      end

      exit 1
    end

    # Report common issues
    if common_issues.empty?
      puts "✓ No common issues found."
      puts
    else
      puts "⚠ Found #{common_issues.length} issue(s) and suggestion(s):"
      puts

      common_issues.each_with_index do |issue, index|
        puts "#{index + 1}. #{issue}"
      end
      puts
    end

    # Report warnings
    if warnings.empty?
      puts "✓ No missing recommended fields."
      puts
    else
      puts "⚠ Found #{warnings.length} missing recommended field(s):"
      puts

      warnings.each_with_index do |warning, index|
        puts "#{index + 1}. #{warning}"
      end
      puts
    end

    # Exit with success (warnings don't cause failure)
    puts "✓ Validation complete!"
    exit 0
  rescue StandardError => e
    $stderr.puts "ERROR: #{e.message}"
    if options[:verbose]
      $stderr.puts e.backtrace.join("\n")
    end
    exit 1
  end
end

main if __FILE__ == $PROGRAM_NAME
