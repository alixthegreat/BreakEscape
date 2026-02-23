# BreakEscape Engine Configuration
BreakEscape.configure do |config|
  # Set to true for standalone mode (development)
  # Set to false when mounted in Hacktivity (production)
  config.standalone_mode = ENV['BREAK_ESCAPE_STANDALONE'] == 'true'

  # Demo user handle for standalone mode
  config.demo_user_handle = ENV['BREAK_ESCAPE_DEMO_USER'] || 'demo_player'
end

# TTS configuration check
unless ENV['GEMINI_API_KEY'].present?
  Rails.logger.warn '[BreakEscape] GEMINI_API_KEY is not set — TTS (text-to-speech) will be disabled'
end
