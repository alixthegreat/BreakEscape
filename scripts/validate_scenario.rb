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
          
          # Check for locked objects without difficulty
          if obj['locked'] && !obj['difficulty']
            warnings << "Missing recommended field: '#{path}/difficulty' - helps players gauge lock complexity"
          end

          # Check for key locks without keyPins
          if obj['lockType'] == 'key' && !obj['keyPins']
            warnings << "Missing recommended field: '#{path}/keyPins' - key locks should specify keyPins array for lockpicking minigame"
          end

          # Check for key items without keyPins
          if obj['type'] == 'key' && !obj['keyPins']
            warnings << "Missing recommended field: '#{path}/keyPins' - key items should specify keyPins array for lockpicking"
          end
        end
      end

      # Check locked rooms with key lockType without keyPins
      if room['locked'] && room['lockType'] == 'key' && !room['keyPins']
        warnings << "Missing recommended field: 'rooms/#{room_id}/keyPins' - key locks should specify keyPins array for lockpicking minigame"
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

      # Check locked rooms without difficulty
      if room['locked'] && !room['difficulty']
        warnings << "Missing recommended field: 'rooms/#{room_id}/difficulty' - helps players gauge lock complexity"
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

