require 'json'

module BreakEscape
  class InkTextValidator
    # Validate that text exists in the NPC's compiled Ink JSON.
    # Compiled Ink stores dialog as ^-prefixed strings, e.g.:
    #   "^Sarah: Hi! You must be the IT contractor."
    #
    # The client sends text WITHOUT the speaker prefix (just "Hi! You must be...")
    # since speaker detection happens client-side via parsing.
    #
    # @param ink_json_path [String] Path to compiled .json file
    # @param text [String] Text to validate (may or may not include "Speaker: " prefix)
    # @return [Boolean]
    def self.validate(ink_json_path, text)
      return false unless File.exist?(ink_json_path)
      return false if text.blank?

      ink_data = File.read(ink_json_path)
      normalized_request = normalize(text)

      # Extract all ^-prefixed text strings from the compiled Ink JSON
      # These are the dialog lines in Ink's compiled format
      ink_data.scan(/"(\^[^"]*)"/).flatten.each do |ink_text|
        # Remove the ^ prefix
        clean_text = ink_text[1..]

        # Match against the full text (with speaker prefix)
        return true if normalize(clean_text) == normalized_request

        # Also match against text with speaker prefix stripped
        # Ink stores "^Sarah: Hello" but client may send just "Hello"
        dialog_only = clean_text.sub(/\A[^:]+:\s*/, "")
        return true if normalize(dialog_only) == normalized_request
      end

      false
    end

    private

    def self.normalize(text)
      text.to_s.downcase.gsub(/[^\w\s]/, "").strip.gsub(/\s+/, " ")
    end
  end
end
