require 'json'
require 'fileutils'
require 'digest'

module BreakEscape
  class TtsBatchProcessor
    attr_reader :stats

    # Seconds to wait between each Gemini API call.
    # Free tier (AI Studio key): ~15 RPM → use 4s.
    # Paid tier (Cloud billing key): 1000+ RPM → 0.1s is fine and keeps batch fast.
    # Override via GEMINI_TTS_DELAY env var: GEMINI_TTS_DELAY=0.5
    REQUEST_DELAY_SECONDS = (ENV['GEMINI_TTS_DELAY'] || 0.1).to_f

    # Maximum number of retry attempts for a failed generation.
    MAX_RETRIES = 3

    def initialize(verbose: true)
      @tts_service = TtsService.new
      @verbose = verbose
      @stats = {
        scenarios_scanned: 0,
        npcs_found: 0,
        dialogue_lines_extracted: 0,
        unique_lines: 0,
        audio_generated: 0,
        cache_hits: 0,
        errors: 0,
        skipped: 0
      }
      @errors_list = []
      @last_request_at = nil
    end

    # Process all scenarios in the scenarios directory
    # @param scenario_filter [String, nil] Optional scenario directory name to process only one scenario
    # @return [Hash] Statistics about the batch processing
    def process_all_scenarios(scenario_filter: nil)
      scenarios_dir = BreakEscape::Engine.root.join('scenarios')
      
      unless Dir.exist?(scenarios_dir)
        log_error "Scenarios directory not found: #{scenarios_dir}"
        return @stats
      end

      unless @tts_service.enabled?
        log_error "TTS service not enabled — set GEMINI_API_KEY to generate audio"
        @stats[:errors] += 1
        return @stats
      end

      scenario_dirs = Dir.entries(scenarios_dir).select do |entry|
        full_path = scenarios_dir.join(entry)
        File.directory?(full_path) && !entry.start_with?('.')
      end

      # Apply filter if specified
      if scenario_filter
        scenario_dirs.select! { |dir| dir == scenario_filter }
        if scenario_dirs.empty?
          log_error "Scenario not found: #{scenario_filter}"
          return @stats
        end
      end

      log_info "=" * 80
      log_info "TTS BATCH PROCESSOR - Starting"
      log_info "=" * 80
      log_info "Scenarios to process: #{scenario_dirs.length}"
      log_info ""

      scenario_dirs.sort.each do |scenario_dir|
        process_scenario(scenarios_dir.join(scenario_dir))
      end

      print_summary
      @stats
    end

    private

    def process_scenario(scenario_path)
      scenario_name = scenario_path.basename.to_s
      scenario_file = scenario_path.join('scenario.json.erb')

      unless File.exist?(scenario_file)
        log_info "Skipping #{scenario_name} (no scenario.json.erb)"
        @stats[:skipped] += 1
        return
      end

      @stats[:scenarios_scanned] += 1
      log_info "Processing scenario: #{scenario_name}"

      begin
        # Render via Mission::ScenarioBinding so ERB helpers (vm_context, vm_object,
        # flags_for_vm, random_password, etc.) are all available. Pass an empty
        # vm_context since batch generation runs outside of a Hacktivity VM session.
        mission = Mission.find_by(name: scenario_name)
        scenario_data = if mission
          mission.generate_scenario_data({})
        else
          # No DB record — render the template directly using ScenarioBinding
          template_path = scenario_path.join('scenario.json.erb')
          erb = ERB.new(File.read(template_path))
          binding_context = Mission::ScenarioBinding.new({})
          JSON.parse(erb.result(binding_context.get_binding))
        end

        # Extract NPCs from all rooms
        npcs = extract_npcs_from_scenario(scenario_data)
        @stats[:npcs_found] += npcs.length

        if npcs.empty?
          log_info "  No NPCs with voice config found"
          return
        end

        log_info "  Found #{npcs.length} NPCs with voice configuration"

        npcs.each do |npc|
          process_npc(npc, scenario_path, scenario_name)
        end

        log_info ""
      rescue => e
        log_error "Error processing scenario #{scenario_path.basename}: #{e.message}"
        @stats[:errors] += 1
      end
    end

    def extract_npcs_from_scenario(scenario_data)
      npcs = []

      # Extract from rooms
      rooms = scenario_data['rooms'] || {}
      rooms.each do |room_id, room_data|
        # Room NPCs
        room_npcs = room_data['npcs'] || []
        room_npcs.each do |npc|
          if npc['voice'].is_a?(Hash) && npc['storyPath']
            npcs << npc.merge('room_id' => room_id)
          end
        end

        # Room objects with voice (like intercoms)
        room_objects = room_data['objects'] || []
        room_objects.each do |obj|
          if obj['ttsVoice'].is_a?(Hash) && obj['voice'].is_a?(String)
            npcs << {
              'id' => obj['id'],
              'voice' => obj['ttsVoice'],
              'fixed_text' => obj['voice'],
              'room_id' => room_id
            }
          end
        end
      end

      # Extract from startRoomObjects
      start_objects = scenario_data['startRoomObjects'] || []
      start_objects.each do |obj|
        if obj['voice'].is_a?(Hash) && obj['storyPath']
          npcs << obj.merge('room_id' => 'start')
        end
      end

      npcs
    end

    def process_npc(npc, scenario_path, scenario_name)
      npc_id = npc['id']
      voice_config = npc['voice']

      log_info "    NPC: #{npc_id} (voice: #{voice_config['name']})"

      # Handle fixed text (room objects like intercoms)
      if npc['fixed_text']
        process_fixed_text(npc['fixed_text'], voice_config, scenario_name)
        return
      end

      # Handle Ink story NPCs
      return unless npc['storyPath']

      # Resolve ink path relative to engine root
      ink_path = resolve_ink_path(npc['storyPath'], scenario_path)
      unless ink_path
        log_error "      Story file not found: #{npc['storyPath']}"
        @stats[:errors] += 1
        return
      end

      # Extract dialogue lines
      dialogue_lines = extract_dialogue_from_ink(ink_path)
      @stats[:dialogue_lines_extracted] += dialogue_lines.length

      log_info "      Extracted #{dialogue_lines.length} dialogue lines"

      dialogue_lines.each do |line|
        generate_audio_for_line(line, voice_config, scenario_name)
      end
    end

    def process_fixed_text(text, voice_config, scenario_name)
      @stats[:dialogue_lines_extracted] += 1
      log_info "      Fixed text (1 line)"
      generate_audio_for_line(text, voice_config, scenario_name)
    end

    def resolve_ink_path(story_path, scenario_path)
      # Try multiple resolution strategies
      
      # Strategy 1: Relative to engine root (as stored in scenario)
      full_path = BreakEscape::Engine.root.join(story_path)
      return full_path if File.exist?(full_path)

      # Strategy 2: Relative to scenario directory
      relative_path = scenario_path.join(File.basename(story_path))
      return relative_path if File.exist?(relative_path)

      # Strategy 3: Look in scenario's ink subdirectory
      ink_dir = scenario_path.join('ink')
      if Dir.exist?(ink_dir)
        basename = File.basename(story_path, '.*')
        json_path = ink_dir.join("#{basename}.json")
        return json_path if File.exist?(json_path)
      end

      nil
    end

    # Ink command tag prefixes (with or without a colon).
    # Compiled Ink stores these as bare strings like "^exit_conversation" or
    # "^give_item:lockpick" — we must match both forms.
    INK_COMMAND_PATTERN = /\A(set_variable|complete_task|unlock_task|unlock_aim|unlock_room|give_item|exit_conversation|hostile|npc_behaviour|complete_objective|set_background)(:|\z)/

    def extract_dialogue_from_ink(ink_json_path)
      ink_data = File.read(ink_json_path)
      npc_lines = []

      # Compiled Ink stores all text as ^-prefixed strings inside JSON string literals.
      # Player choice options appear inside "str"/"str" wrapper tokens, so we can detect
      # them by checking that the preceding token is NOT "str".
      #
      # Strategy: scan for ^-prefixed strings and retain only lines that:
      #   1. Have a "Speaker: " prefix (NPC dialogue)
      #   2. Are NOT from a "Player" speaker
      #   3. Are NOT Ink command tags
      ink_data.scan(/"(\^[^"]*)"/).flatten.each do |ink_text|
        clean_text = ink_text[1..]

        next if clean_text.strip.empty?

        # Skip Ink command tags (e.g., exit_conversation, set_variable:x=y, give_item:lockpick)
        next if clean_text =~ INK_COMMAND_PATTERN

        # Only keep lines that have a "Speaker: " prefix — these are NPC dialogue lines.
        # Player choice options have no speaker prefix (e.g., "Happy to help.") and will
        # therefore be skipped. Narrator lines (rare in these stories) are also skipped.
        next unless clean_text =~ /\A[^:]+:\s+\S/

        # Skip player-spoken lines (e.g., "Player: I've been observing...")
        next if clean_text =~ /\APlayer:\s/i

        # Strip the "Speaker: " prefix — this is what the TTS endpoint and cache key use
        # (the client sends clean dialogue text with the speaker already stripped).
        dialogue_only = clean_text.sub(/\A[^:]+:\s*/, "").strip
        next if dialogue_only.empty?

        # Skip very short fragments — these are typically Ink variable-substitution
        # artefacts (e.g., "And " or ", thanks" left over when a variable splits a line).
        next if dialogue_only.length < 10

        npc_lines << dialogue_only
      end

      npc_lines.uniq
    end

    def generate_audio_for_line(text, voice_config, scenario_name)
      voice_name = voice_config['name']
      style_prompt = voice_config['style']
      language_code = voice_config['language']

      # Check if already cached — no API call needed.
      # Use the service's own cache_path so the path logic is defined in one place.
      cache_key = compute_cache_key(text, voice_name, style_prompt, language_code)
      mp3_path = @tts_service.cache_path(cache_key, scenario_name)

      if File.exist?(mp3_path)
        @stats[:cache_hits] += 1
        log_verbose "      ✓ Cached: #{text.truncate(60)}"
        return
      end

      @stats[:unique_lines] += 1
      log_verbose "      → Generating: #{text.truncate(60)}"

      # Respect rate limit: enforce minimum gap between API calls
      throttle_request!

      attempt = 0
      begin
        attempt += 1
        result = @tts_service.generate(text, voice_name, style_prompt, language_code, scenario_name: scenario_name)

        if result
          @stats[:audio_generated] += 1
          log_verbose "      ✓ Generated: #{File.basename(result)}"
        else
          raise "TtsService returned nil"
        end
      rescue TtsService::QuotaExhaustedError => e
        # Daily quota exhausted — no point retrying any remaining lines
        @stats[:errors] += 1
        log_error ""
        log_error "  ╔══════════════════════════════════════════════════════════════╗"
        log_error "  ║  QUOTA EXHAUSTED — stopping batch                           ║"
        log_error "  ║  #{e.message.ljust(62)}║"
        log_error "  ║  Run again once the quota resets. Already-cached files are  ║"
        log_error "  ║  safe and will be skipped on the next run.                  ║"
        log_error "  ╚══════════════════════════════════════════════════════════════╝"
        log_error ""
        print_summary
        exit 1
      rescue => e
        if attempt < MAX_RETRIES
          wait = REQUEST_DELAY_SECONDS * (2 ** (attempt - 1))  # exponential backoff
          log_verbose "      ↻ Retry #{attempt}/#{MAX_RETRIES - 1} in #{wait}s: #{text.truncate(40)}"
          sleep wait
          @last_request_at = Time.now
          retry
        end

        @stats[:errors] += 1
        @errors_list << "Failed: #{text.truncate(60)}"
        log_error "      ✗ Failed after #{MAX_RETRIES} attempts: #{text.truncate(60)}"
      end
    end

    # Enforce REQUEST_DELAY_SECONDS between consecutive API calls.
    def throttle_request!
      if @last_request_at
        elapsed = Time.now - @last_request_at
        remaining = REQUEST_DELAY_SECONDS - elapsed
        if remaining > 0
          log_verbose "      … rate-limit wait #{remaining.round(1)}s"
          sleep remaining
        end
      end
      @last_request_at = Time.now
    end

    def compute_cache_key(text, voice_name, style_prompt, language_code)
      normalized = text.to_s.downcase.gsub(/[^\w\s]/, "").strip.gsub(/\s+/, " ")
      Digest::MD5.hexdigest("#{normalized}|#{voice_name}|#{style_prompt}|#{language_code}")
    end

    def print_summary
      log_info "=" * 80
      log_info "BATCH PROCESSING COMPLETE"
      log_info "=" * 80
      log_info "Scenarios scanned:        #{@stats[:scenarios_scanned]}"
      log_info "NPCs found:               #{@stats[:npcs_found]}"
      log_info "Dialogue lines extracted: #{@stats[:dialogue_lines_extracted]}"
      log_info "Unique lines:             #{@stats[:unique_lines]}"
      log_info "Audio generated:          #{@stats[:audio_generated]}"
      log_info "Cache hits:               #{@stats[:cache_hits]}"
      log_info "Errors:                   #{@stats[:errors]}"
      log_info "Skipped scenarios:        #{@stats[:skipped]}"
      log_info ""

      cache_size = calculate_cache_size
      log_info "Cache size: #{format_bytes(cache_size)}"
      log_info "Cache location: #{TtsService::CACHE_DIR}"
      log_info ""

      if @errors_list.any?
        log_info "ERRORS:"
        @errors_list.each { |err| log_info "  - #{err}" }
        log_info ""
      end

      log_info "=" * 80
    end

    def calculate_cache_size
      return 0 unless Dir.exist?(TtsService::CACHE_DIR)
      
      Dir.glob(TtsService::CACHE_DIR.join('*.mp3')).sum do |file|
        File.size(file)
      rescue
        0
      end
    end

    def format_bytes(bytes)
      if bytes < 1024
        "#{bytes} B"
      elsif bytes < 1024 * 1024
        "#{(bytes / 1024.0).round(1)} KB"
      else
        "#{(bytes / 1024.0 / 1024.0).round(1)} MB"
      end
    end

    def log_info(message)
      puts message if @verbose
      Rails.logger.info("[TTS Batch] #{message}")
    end

    def log_verbose(message)
      puts message if @verbose
      Rails.logger.debug("[TTS Batch] #{message}")
    end

    def log_error(message)
      puts "ERROR: #{message}" if @verbose
      Rails.logger.error("[TTS Batch] #{message}")
    end
  end
end
