module BreakEscape
  class MissionsController < ApplicationController
    def index
      @missions = if defined?(Pundit)
                    policy_scope(Mission)
      else
                    Mission.published
      end

      # Filter by collection if specified
      if params[:collection].present?
        @missions = @missions.by_collection(params[:collection])
      end

      # Eager load CyBOK data for display
      @missions = @missions.includes(:break_escape_cyboks)
    end

    def show
      @mission = Mission.find(params[:id])
      authorize @mission if defined?(Pundit)

      if @mission.requires_vms? && BreakEscape::Mission.hacktivity_mode?
        # VM missions need explicit game creation with VM set selection
        # Redirect to games#new which shows VM set selection UI
        # Use explicit path instead of route helper to ensure it works in engine context
        redirect_to "/break_escape/games/new?mission_id=#{@mission.id}"
      else
        # Legacy behavior for non-VM missions - auto-create game
        @game = Game.find_or_create_by!(
          player: current_player,
          mission: @mission
        )
        # Use explicit path instead of route helper to ensure it works in engine context
        redirect_to "/break_escape/games/#{@game.id}"
      end
    end
  end
end
