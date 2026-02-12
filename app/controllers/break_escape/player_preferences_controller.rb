module BreakEscape
  class PlayerPreferencesController < ApplicationController
    before_action :set_player_preference
    before_action :authorize_preference

    # GET /break_escape/configuration
    def show
      @available_sprites = PlayerPreference::AVAILABLE_SPRITES
      @scenario = load_scenario_if_validating
    end

    # PATCH /break_escape/configuration
    def update
      if @player_preference.update(player_preference_params)
        flash[:notice] = 'Character configuration saved!'

        # Redirect to game if came from validation flow
        if params[:game_id].present?
          redirect_to game_path(params[:game_id])
        else
          redirect_to configuration_path
        end
      else
        flash.now[:alert] = 'Please select a character sprite.'
        @available_sprites = PlayerPreference::AVAILABLE_SPRITES
        @scenario = load_scenario_if_validating
        render :show, status: :unprocessable_entity
      end
    end

    private

    def set_player_preference
      @player_preference = current_player_preference || create_default_preference
    end

    def current_player_preference
      if current_player.respond_to?(:break_escape_preference)
        current_player.break_escape_preference
      elsif current_player.respond_to?(:preference)
        current_player.preference
      end
    end

    def create_default_preference
      if current_player.respond_to?(:ensure_break_escape_preference!)
        current_player.ensure_break_escape_preference!
        current_player.break_escape_preference
      elsif current_player.respond_to?(:ensure_preference!)
        current_player.ensure_preference!
        current_player.preference
      else
        # Fallback: create directly
        PlayerPreference.create!(player: current_player)
      end
    end

    def authorize_preference
      authorize(@player_preference) if defined?(Pundit)
    end

    def player_preference_params
      params.require(:player_preference).permit(:selected_sprite, :in_game_name)
    end

    def load_scenario_if_validating
      return nil unless params[:game_id].present?

      game = Game.find_by(id: params[:game_id])
      return nil unless game

      # Return scenario data with validSprites info
      game.scenario_data
    end
  end
end
