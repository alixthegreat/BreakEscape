module BreakEscape
  module PlayerPreferencesHelper
    def sprite_valid_for_scenario?(sprite, scenario_data)
      return true unless scenario_data['validSprites'].present?

      valid_sprites = Array(scenario_data['validSprites'])

      valid_sprites.any? do |pattern|
        sprite_matches_pattern?(sprite, pattern)
      end
    end

    # Headshot filename for sprite (prefer _down_headshot for hacker_hood, else _headshot)
    def sprite_headshot_path(sprite)
      base = sprite
      if sprite.end_with?('_hood_down')
        "/break_escape/assets/characters/#{base}_headshot.png"
      else
        "/break_escape/assets/characters/#{base}_headshot.png"
      end
    end

    private

    def sprite_matches_pattern?(sprite, pattern)
      return true if pattern == '*'

      # Convert wildcard pattern to regex
      regex_pattern = Regexp.escape(pattern).gsub('\*', '.*')
      regex = /\A#{regex_pattern}\z/

      sprite.match?(regex)
    end
  end
end
