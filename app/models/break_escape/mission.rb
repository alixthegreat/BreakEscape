module BreakEscape
  class Mission < ApplicationRecord
    self.table_name = 'break_escape_missions'

    has_many :games, class_name: 'BreakEscape::Game', dependent: :destroy

    # CyBOK associations - always use our table for standalone mode
    has_many :break_escape_cyboks,
             class_name: 'BreakEscape::Cybok',
             as: :cybokable,
             dependent: :destroy

    validates :name, presence: true, uniqueness: true
    validates :display_name, presence: true
    validates :difficulty_level, inclusion: { in: 1..5 }

    scope :published, -> { where(published: true) }
    scope :by_collection, ->(collection) { where(collection: collection) }

    # Get all distinct collections
    def self.collections
      distinct.pluck(:collection).compact.sort
    end

    # Path to scenario directory
    def scenario_path
      BreakEscape::Engine.root.join('scenarios', name)
    end

    # Path to mission metadata file
    def mission_json_path
      scenario_path.join('mission.json')
    end

    # Check if mission.json exists
    def has_mission_json?
      File.exist?(mission_json_path)
    end

    # Load mission metadata from JSON file
    def load_mission_metadata
      return nil unless has_mission_json?

      JSON.parse(File.read(mission_json_path))
    rescue JSON::ParserError => e
      Rails.logger.error "Invalid mission.json for #{name}: #{e.message}"
      nil
    end

    # Get all CyBOK entries (uses Hacktivity's if available for reads)
    def all_cyboks
      if defined?(::Cybok) && respond_to?(:cyboks)
        cyboks
      else
        break_escape_cyboks
      end
    end

    # Check if Hacktivity mode is available (VMs and flag service)
    def self.hacktivity_mode?
      defined?(::VmSet) && defined?(::FlagService)
    end

    # Check if mission requires VMs (has secgen_scenario configured)
    def requires_vms?
      secgen_scenario.present?
    end

    # Get valid VM sets for this mission (Hacktivity mode only)
    #
    # HACKTIVITY COMPATIBILITY NOTES:
    # - Hacktivity uses `sec_gen_batch` (with underscore), not `secgen_batch`
    # - The `scenario` field contains the XML path (e.g., "scenarios/ctf/foo.xml")
    # - VmSet doesn't have a `display_name` method - use sec_gen_batch.title instead
    # - Always eager-load :vms and :sec_gen_batch to avoid N+1 queries
    def valid_vm_sets_for_user(user)
      return [] unless self.class.hacktivity_mode? && requires_vms?

      # Query Hacktivity's vm_sets where:
      # - scenario matches our secgen_scenario
      # - user owns it (or is on the team)
      # - not relinquished
      # - build completed successfully
      ::VmSet.joins(:sec_gen_batch)
             .where(sec_gen_batches: { scenario: secgen_scenario })
             .where(user: user, relinquished: false)
             .where.not(build_status: ['pending', 'error'])
             .includes(:vms, :sec_gen_batch)
             .order(created_at: :desc)
    end

    # Generate scenario data via ERB with optional VM context
    def generate_scenario_data(vm_context = {})
      template_path = scenario_path.join('scenario.json.erb')
      raise "Scenario template not found: #{name}" unless File.exist?(template_path)

      erb = ERB.new(File.read(template_path))
      binding_context = ScenarioBinding.new(vm_context)
      output = erb.result(binding_context.get_binding)

      JSON.parse(output)
    rescue JSON::ParserError => e
      raise "Invalid JSON in #{name} after ERB processing: #{e.message}"
    end

    # Binding context for ERB variables
    class ScenarioBinding
      def initialize(vm_context = {})
        @random_password = SecureRandom.alphanumeric(8)
        @random_pin = rand(1000..9999).to_s
        @random_code = SecureRandom.hex(4)
        @vm_context = vm_context  # VM/flag data for CTF integration
      end

      attr_reader :random_password, :random_pin, :random_code, :vm_context

      def get_binding
        binding
      end
    end
  end
end
