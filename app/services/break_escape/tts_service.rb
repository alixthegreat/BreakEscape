require 'digest'
require 'fileutils'
require 'open3'
require 'net/http'
require 'json'
require 'base64'
require 'uri'

module BreakEscape
  class TtsService
    # Raised when the Gemini API returns 429 RESOURCE_EXHAUSTED.
    # Carries the retry_after seconds from the API's retryDelay field (if present).
    class QuotaExhaustedError < StandardError
      attr_reader :retry_after

      def initialize(retry_after = nil)
        @retry_after = retry_after
        msg = retry_after ? "Quota exhausted. Retry in #{retry_after}s (~#{(retry_after / 3600.0).round(1)}h)" : "Quota exhausted"
        super(msg)
      end
    end
    GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"
    GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
    # Engine-root cache so pre-generated MP3s can be committed to git and are
    # found in both standalone and mounted (Hacktivity) mode without relying on
    # the host app's Rails.root.
    CACHE_DIR = BreakEscape::Engine.root.join("tts_cache")

    def initialize
      @api_key = ENV["GEMINI_API_KEY"]
      @enabled = @api_key.present?
    end

    def enabled?
      @enabled
    end

    # Generate or retrieve cached MP3 for text + voice.
    # Audio is stored under CACHE_DIR/{scenario_name}/{hash}.mp3 when a scenario
    # name is provided, falling back to CACHE_DIR/{hash}.mp3 for legacy callers.
    # If a flat (legacy) file exists for the same key it is migrated automatically.
    #
    # @param text [String] Dialog text to synthesize
    # @param voice_name [String] Gemini voice name (e.g., "Kore")
    # @param style_prompt [String, nil] Optional style instructions
    # @param language_code [String, nil] BCP-47 language code (e.g., "en-GB")
    # @param scenario_name [String, nil] Scenario directory name (e.g., "m01_first_contact")
    # @return [Pathname, nil] Path to cached MP3 file, or nil on failure
    def generate(text, voice_name, style_prompt = nil, language_code = nil, scenario_name: nil)
      return nil unless enabled?
      return nil if text.blank?

      cache_key = compute_cache_key(text, voice_name, style_prompt, language_code)
      mp3_path  = cache_path(cache_key, scenario_name)

      # Migrate a flat (legacy) file into the scenario subdir if needed
      migrate_flat_cache!(cache_key, mp3_path) if scenario_name.present?

      # Cache hit
      if File.exist?(mp3_path)
        Rails.logger.debug "[TTS] Cache hit: #{scenario_name}/#{cache_key}"
        return mp3_path
      end

      # Cache miss — generate via API
      Rails.logger.info "[TTS] Cache miss, generating: #{text.truncate(60)} (voice: #{voice_name})"
      FileUtils.mkdir_p(mp3_path.dirname)

      pcm_data = call_gemini_tts(text, voice_name, style_prompt, language_code)
      return nil unless pcm_data

      # Write raw PCM to temp file alongside the final MP3
      pcm_path = mp3_path.dirname.join("#{cache_key}.pcm")
      File.binwrite(pcm_path, pcm_data)

      # Convert PCM to MP3 via ffmpeg
      success = convert_pcm_to_mp3(pcm_path, mp3_path)

      # Cleanup temp PCM
      begin
        File.delete(pcm_path) if File.exist?(pcm_path)
      rescue => e
        Rails.logger.warn "[TTS] Failed to delete temp PCM file #{pcm_path}: #{e.message}"
      end

      if success
        Rails.logger.info "[TTS] Generated: #{scenario_name}/#{cache_key}.mp3 (#{(File.size(mp3_path) / 1024.0).round(1)} KB)"
        mp3_path
      else
        nil
      end
    rescue => e
      Rails.logger.error "[TTS] Error generating audio: #{e.class} - #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
      nil
    end

    # Return the expected cache path for a given key and optional scenario name.
    # Public so TtsBatchProcessor can use it for cache-hit checks without calling generate.
    def cache_path(cache_key, scenario_name = nil)
      if scenario_name.present?
        CACHE_DIR.join(scenario_name, "#{cache_key}.mp3")
      else
        CACHE_DIR.join("#{cache_key}.mp3")
      end
    end

    # Compute the cache key for a set of TTS parameters.
    # Public so callers can check cache state without a generate call.
    def cache_key_for(text, voice_name, style_prompt = nil, language_code = nil)
      compute_cache_key(text, voice_name, style_prompt, language_code)
    end

    private

    # Move a flat (legacy) cache file into the scenario subdirectory.
    # Called only when scenario_name is present and the new path doesn't exist yet.
    # Parse the retryDelay seconds from a Gemini 429 response body.
    # The API returns either a "retryDelay":"8031s" field in details, or a
    # human-readable "2h13m51s" string in the message.
    def parse_retry_delay(body)
      parsed = JSON.parse(body.to_s) rescue {}

      # Prefer the structured retryDelay from RetryInfo details
      details = parsed.dig("error", "details") || []
      details.each do |detail|
        if detail["@type"]&.include?("RetryInfo") && detail["retryDelay"]
          delay_str = detail["retryDelay"].to_s
          return delay_str.to_i if delay_str =~ /\A\d+s?\z/
        end
      end

      # Fall back to parsing "2h13m51s" from the error message
      msg = parsed.dig("error", "message").to_s
      if msg =~ /retry in\s+((?:\d+h)?(?:\d+m)?(?:\d+(?:\.\d+)?s)?)/i
        parse_duration($1)
      end
    rescue
      nil
    end

    def parse_duration(str)
      total = 0
      total += $1.to_i * 3600 if str =~ /(\d+)h/
      total += $1.to_i * 60   if str =~ /(\d+)m/
      total += $1.to_f         if str =~ /(\d+(?:\.\d+)?)s/
      total > 0 ? total.ceil : nil
    end

    def migrate_flat_cache!(cache_key, new_path)
      flat_path = CACHE_DIR.join("#{cache_key}.mp3")
      return unless File.exist?(flat_path)
      return if File.exist?(new_path)

      FileUtils.mkdir_p(new_path.dirname)
      FileUtils.mv(flat_path, new_path)
      Rails.logger.info "[TTS] Migrated #{cache_key}.mp3 → #{new_path.relative_path_from(CACHE_DIR)}"
    rescue => e
      Rails.logger.warn "[TTS] Migration failed for #{cache_key}: #{e.message}"
    end

    def compute_cache_key(text, voice_name, style_prompt = nil, language_code = nil)
      normalized = normalize_text(text)
      Digest::MD5.hexdigest("#{normalized}|#{voice_name}|#{style_prompt}|#{language_code}")
    end

    def normalize_text(text)
      text.to_s.downcase.gsub(/[^\w\s]/, "").strip.gsub(/\s+/, " ")
    end

    def call_gemini_tts(text, voice_name, style_prompt, language_code = nil)
      uri = URI("#{GEMINI_API_BASE}/#{GEMINI_TTS_MODEL}:generateContent?key=#{@api_key}")

      # Build the text input — prepend style prompt if provided
      input_text = style_prompt.present? ? "#{style_prompt}\n\n#{text}" : text

      speech_config = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice_name
          }
        }
      }
      speech_config[:languageCode] = language_code if language_code.present?

      body = {
        contents: [{
          parts: [{ text: input_text }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: speech_config
        }
      }

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 15
      http.read_timeout = 60

      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request.body = body.to_json

      response = http.request(request)

      unless response.is_a?(Net::HTTPSuccess)
        body_preview = response.body.to_s.truncate(400)
        Rails.logger.error "[TTS] Gemini API error: #{response.code} #{body_preview}"

        # Surface quota exhaustion clearly so callers (e.g. batch processor) can
        # detect it and abort early rather than retrying hundreds of times.
        if response.code == "429"
          retry_seconds = parse_retry_delay(response.body)
          raise QuotaExhaustedError.new(retry_seconds)
        end

        return nil
      end

      parsed = JSON.parse(response.body)
      audio_data = parsed.dig("candidates", 0, "content", "parts", 0, "inlineData", "data")

      unless audio_data
        Rails.logger.error "[TTS] No audio data in Gemini response"
        return nil
      end

      Base64.decode64(audio_data)
    end

    def convert_pcm_to_mp3(pcm_path, mp3_path)
      # Gemini returns 16-bit signed little-endian PCM at 24kHz, mono
      stdout, stderr, status = Open3.capture3(
        "ffmpeg", "-y",
        "-f", "s16le",
        "-ar", "24000",
        "-ac", "1",
        "-i", pcm_path.to_s,
        "-codec:a", "libmp3lame",
        "-qscale:a", "4",
        mp3_path.to_s
      )

      unless status.success?
        Rails.logger.error "[TTS] ffmpeg conversion failed: #{stderr.truncate(200)}"
        return false
      end

      true
    end
  end
end
