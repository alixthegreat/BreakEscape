# Player Preferences System - Implementation Plan

## Overview

Add a persistent player preferences system allowing players to customize their in-game sprite and display name. Preferences are stored per-player (polymorphic association) and validated against scenario-specific sprite requirements.

---

## 1. Database Schema

### New Table: `break_escape_player_preferences`

```ruby
create_table :break_escape_player_preferences do |t|
  # Polymorphic association to User (Hacktivity) or DemoUser (Standalone)
  t.references :player, polymorphic: true, null: false, index: true

  # Player customization
  t.string :selected_sprite  # NULL until player chooses
  t.string :in_game_name, default: 'Zero', null: false

  t.timestamps
end

# Ensure one preference record per player
add_index :break_escape_player_preferences, 
          [:player_type, :player_id], 
          unique: true, 
          name: 'index_player_prefs_on_player'
```

### Migration Command

```bash
rails generate migration CreateBreakEscapePlayerPreferences
```

### Validation Rules

- `player`: must be present
- `selected_sprite`: must be in `AVAILABLE_SPRITES` list if present (allows NULL)
- `in_game_name`: must be present, length 1-20 characters, alphanumeric + spaces/underscores only

---

## 2. Model Layer

### `app/models/break_escape/player_preference.rb`

```ruby
module BreakEscape
  class PlayerPreference < ApplicationRecord
    self.table_name = 'break_escape_player_preferences'

    # Associations
    belongs_to :player, polymorphic: true

    # Constants
    AVAILABLE_SPRITES = %w[
      female_hacker_hood
      female_hacker
      female_office_worker
      female_security_guard
      female_telecom
      female_spy
      female_scientist
      woman_bow
      male_hacker_hood
      male_hacker
      male_office_worker
      male_security_guard
      male_telecom
      male_spy
      male_scientist
      male_nerd
    ].freeze

    # Validations
    validates :player, presence: true
    validates :selected_sprite, inclusion: { in: AVAILABLE_SPRITES }, allow_nil: true
    validates :in_game_name, presence: true, length: { in: 1..20 }, format: { 
      with: /\A[a-zA-Z0-9_ ]+\z/, 
      message: 'only allows letters, numbers, spaces, and underscores' 
    }

    # Callbacks
    before_validation :set_defaults, on: :create

    # Check if selected sprite is valid for a given scenario
    def sprite_valid_for_scenario?(scenario_data)
      # If no sprite selected, invalid (player must choose)
      return false if selected_sprite.blank?
      
      # If scenario has no restrictions, any sprite is valid
      return true unless scenario_data['validSprites'].present?

      valid_sprites = Array(scenario_data['validSprites'])
      
      # Check if sprite matches any pattern
      valid_sprites.any? do |pattern|
        sprite_matches_pattern?(selected_sprite, pattern)
      end
    end
    
    # Check if player has selected a sprite
    def sprite_selected?
      selected_sprite.present?
    end

    private

    def set_defaults
      # Seed in_game_name from player.handle if available
      if in_game_name.blank? && player.respond_to?(:handle) && player.handle.present?
        self.in_game_name = player.handle
      end

      # Fallback to 'Zero' if still blank
      self.in_game_name = 'Zero' if in_game_name.blank?

      # NOTE: selected_sprite left NULL - player MUST choose before first game
    end

    # Pattern matching for sprite validation
    # Supports:
    # - Exact match: "female_hacker"
    # - Wildcard: "female_*" (all female sprites)
    # - Wildcard: "*_hacker" (all hacker sprites)
    # - Wildcard: "*" (all sprites)
    def sprite_matches_pattern?(sprite, pattern)
      return true if pattern == '*'
      
      # Convert wildcard pattern to regex
      regex_pattern = Regexp.escape(pattern).gsub('\*', '.*')
      regex = /\A#{regex_pattern}\z/
      
      sprite.match?(regex)
    end
  end
end
```

### Update `BreakEscape::DemoUser`

```ruby
module BreakEscape
  class DemoUser < ApplicationRecord
    # ... existing code ...

    has_one :preference, as: :player, class_name: 'BreakEscape::PlayerPreference', dependent: :destroy

    # Ensure preference exists
    def ensure_preference!
      create_preference! unless preference
    end
  end
end
```

### Update Parent App `User` Model

**Note**: This requires adding to Hacktivity's `User` model when mounted.

```ruby
# In Hacktivity's app/models/user.rb
has_one :break_escape_preference, 
        as: :player, 
        class_name: 'BreakEscape::PlayerPreference', 
        dependent: :destroy

def ensure_break_escape_preference!
  create_break_escape_preference! unless break_escape_preference
end
```

---

## 3. Controller Layer

### `app/controllers/break_escape/player_preferences_controller.rb`

```ruby
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
      if defined?(current_user) && current_user
        current_user.break_escape_preference
      elsif current_demo_user
        current_demo_user.preference
      end
    end

    def create_default_preference
      if defined?(current_user) && current_user
        current_user.ensure_break_escape_preference!
        current_user.break_escape_preference
      elsif current_demo_user
        current_demo_user.ensure_preference!
        current_demo_user.preference
      end
    end

    def authorize_preference
      authorize(@player_preference)
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
```

---

## 4. Policy Layer

### `app/policies/break_escape/player_preference_policy.rb`

```ruby
module BreakEscape
  class PlayerPreferencePolicy < ApplicationPolicy
    def show?
      # All authenticated players can view their preferences
      player_owns_preference?
    end

    def update?
      # All authenticated players can update their preferences
      player_owns_preference?
    end

    private

    def player_owns_preference?
      return false unless user

      # Check if user owns this preference record
      record.player_type == user.class.name && record.player_id == user.id
    end
  end
end
```

---

## 5. View Layer

### `app/views/break_escape/player_preferences/show.html.erb`

**Note**: Using single Phaser instance for animated sprite previews (breathing-idle animations).

```erb
<div class="configuration-container">
  <h1>Character Configuration</h1>
  
  <% if params[:game_id].present? %>
    <p class="config-prompt">Please select your character before starting the mission.</p>
  <% end %>

  <%= form_with model: @player_preference, 
                url: configuration_path, 
                method: :patch, 
                local: true,
                id: 'preference-form' do |f| %>
    
    <!-- In-Game Name -->
    <div class="form-group">
      <%= f.label :in_game_name, "Your Code Name" %>
      <%= f.text_field :in_game_name, 
                       class: 'form-control', 
                       maxlength: 20,
                       placeholder: 'Zero' %>
      <small>1-20 characters (letters, numbers, spaces, underscores only)</small>
    </div>

    <!-- Sprite Selection Grid -->
    <div class="form-group">
      <%= f.label :selected_sprite, "Select Your Character" %>
      <% if @player_preference.selected_sprite.blank? %>
        <p class="selection-required">⚠️ Character selection required</p>
      <% end %>
      
      <!-- Phaser canvas container (single instance rendering all sprites) -->
      <div id="sprite-preview-canvas-container"></div>
      
      <!-- Selection grid (overlaid on Phaser canvas via absolute positioning) -->
      <div class="sprite-grid" id="sprite-selection-grid">
        <% @available_sprites.each_with_index do |sprite, index| %>
          <% 
            is_valid = @scenario.nil? || sprite_valid_for_scenario?(sprite, @scenario)
            is_selected = @player_preference.selected_sprite == sprite
          %>
          
          <label for="sprite_<%= sprite %>" 
                 class="sprite-card <%= 'invalid' unless is_valid %> <%= 'selected' if is_selected %>"
                 data-sprite="<%= sprite %>"
                 data-sprite-index="<%= index %>">
            
            <!-- Phaser will render sprite here (positioned via grid layout) -->
            <div class="sprite-preview-container" data-sprite-slot="<%= index %>">
              <!-- Padlock overlay for locked sprites -->
              <% unless is_valid %>
                <div class="sprite-lock-overlay">
                  <%= image_tag '/break_escape/assets/icons/padlock_32.png', 
                                class: 'lock-icon',
                                alt: 'Locked' %>
                </div>
              <% end %>
            </div>

            <!-- Radio button (hidden, styled via label) -->
            <div class="sprite-info">
              <%= f.radio_button :selected_sprite, 
                                 sprite, 
                                 id: "sprite_#{sprite}",
                                 disabled: !is_valid,
                                 class: 'sprite-radio' %>
              <span class="sprite-label"><%= sprite.humanize %></span>
            </div>
          </label>
        <% end %>
      </div>
    </div>

    <!-- Hidden field for game_id if validating -->
    <% if params[:game_id].present? %>
      <%= hidden_field_tag :game_id, params[:game_id] %>
    <% end %>

    <!-- Submit -->
    <div class="form-actions">
      <%= f.submit 'Save Configuration', class: 'btn btn-primary' %>
      
      <% if params[:game_id].blank? %>
        <%= link_to 'Cancel', root_path, class: 'btn btn-secondary' %>
      <% end %>
    </div>
  <% end %>
</div>

<!-- Load Phaser and initialize sprite grid -->
<script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
<script type="module">
  import { initializeSpriteGrid } from '/break_escape/js/ui/sprite-grid.js?v=1';
  
  document.addEventListener('DOMContentLoaded', () => {
    const sprites = <%= raw @available_sprites.to_json %>;
    const validSprites = <%= raw (@scenario&.dig('validSprites') || []).to_json %>;
    const selectedSprite = '<%= @player_preference.selected_sprite %>';
    
    initializeSpriteGrid(sprites, validSprites, selectedSprite);
  });
</script>
```

### Helper Methods

```ruby
# app/helpers/break_escape/player_preferences_helper.rb
module BreakEscape
  module PlayerPreferencesHelper
    def sprite_valid_for_scenario?(sprite, scenario_data)
      return true unless scenario_data['validSprites'].present?

      valid_sprites = Array(scenario_data['validSprites'])
      
      valid_sprites.any? do |pattern|
        sprite_matches_pattern?(sprite, pattern)
      end
    end

    private

    def sprite_matches_pattern?(sprite, pattern)
      return true if pattern == '*'
      
      regex_pattern = Regexp.escape(pattern).gsub('\*', '.*')
      regex = /\A#{regex_pattern}\z/
      
      sprite.match?(regex)
    end
  end
end
```

---

## 6. JavaScript Layer

### `public/break_escape/js/ui/sprite-grid.js`

**Approach**: Single Phaser instance rendering all 16 sprites in a grid layout.

```javascript
// Sprite Grid - Single Phaser instance for character selection
// Renders all 16 sprites with breathing-idle animations in a grid

export function initializeSpriteGrid(sprites, validSprites, selectedSprite) {
  console.log('🎨 Initializing sprite selection grid...');
  console.log(`Sprites: ${sprites.length}, Valid patterns: ${validSprites.length}, Selected: ${selectedSprite}`);

  const SPRITES_PER_ROW = 4;
  const SPRITE_SIZE = 80;
  const SPRITE_PADDING = 16;
  const CELL_SIZE = SPRITE_SIZE + SPRITE_PADDING;

  const rows = Math.ceil(sprites.length / SPRITES_PER_ROW);
  const canvasWidth = SPRITES_PER_ROW * CELL_SIZE;
  const canvasHeight = rows * CELL_SIZE;

  // Create single Phaser game instance
  const config = {
    type: Phaser.AUTO,
    parent: 'sprite-preview-canvas-container',
    width: canvasWidth,
    height: canvasHeight,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
      preload: function() { preloadSprites(this, sprites); },
      create: function() { createSpriteGrid(this, sprites); }
    }
  };

  new Phaser.Game(config);
}

function preloadSprites(scene, sprites) {
  console.log('📦 Loading sprite atlases...');
  
  sprites.forEach(sprite => {
    const atlasPath = `/break_escape/assets/characters/${sprite}.png`;
    const jsonPath = `/break_escape/assets/characters/${sprite}.json`;
    
    scene.load.atlas(sprite, atlasPath, jsonPath);
  });
}

function createSpriteGrid(scene, sprites) {
  console.log('🎭 Creating sprite grid...');
  
  const SPRITES_PER_ROW = 4;
  const SPRITE_SIZE = 80;
  const SPRITE_PADDING = 16;
  const CELL_SIZE = SPRITE_SIZE + SPRITE_PADDING;

  sprites.forEach((sprite, index) => {
    const col = index % SPRITES_PER_ROW;
    const row = Math.floor(index / SPRITES_PER_ROW);
    
    // Position sprite in grid (centered in cell)
    const x = col * CELL_SIZE + SPRITE_SIZE / 2;
    const y = row * CELL_SIZE + SPRITE_SIZE / 2;
    
    // Create sprite
    const spriteObj = scene.add.sprite(x, y, sprite);
    
    // Scale to fit 80x80 (sprites are 80x80 already, but may vary)
    spriteObj.setDisplaySize(SPRITE_SIZE, SPRITE_SIZE);
    
    // Create breathing-idle animation if not exists
    const animKey = `${sprite}-idle-south`;
    if (!scene.anims.exists(animKey)) {
      const frames = scene.anims.generateFrameNames(sprite, {
        prefix: 'breathing-idle_south_frame_',
        start: 0,
        end: 3,
        zeroPad: 1
      });

      scene.anims.create({
        key: animKey,
        frames: frames,
        frameRate: 8,
        repeat: -1
      });
    }
    
    // Play animation
    spriteObj.play(animKey);
    
    console.log(`✓ Created sprite ${index}: ${sprite} at (${x}, ${y})`);
  });
  
  console.log('✅ Sprite grid initialized');
}
```

### Integration Notes

- **Canvas positioning**: Phaser canvas positioned absolutely behind the grid
- **Click handling**: HTML labels capture clicks, update radio buttons
- **Responsive**: Phaser's `Scale.FIT` mode handles different screen sizes
- **Padlock overlays**: HTML elements positioned over invalid sprites

---

## 7. CSS Styling

### `public/break_escape/css/player_preferences.css`

**Note**: Break Escape uses `public/break_escape/css/` for all stylesheets (not Rails asset pipeline).

```css
.configuration-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.sprite-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.sprite-card {
  border: 2px solid #333; /* Match pixel-art aesthetic */
  padding: 12px;
  text-align: center;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.2s;
  display: block; /* Label as block for full card clickability */
  position: relative;
}

.sprite-card:hover:not(.invalid) {
  border-color: #007bff;
}

.sprite-card.selected {
  border-color: #28a745;
  background: #e6ffe6;
}

.sprite-card.invalid {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f0f0f0;
}

.sprite-preview-container {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto;
  pointer-events: none; /* Allow clicks to pass through to label */
}

#sprite-preview-canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: none; /* Canvas doesn't capture clicks */
}

#sprite-selection-grid {
  position: relative;
  z-index: 2; /* Grid above canvas */
}

.sprite-lock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.lock-icon {
  width: 32px;
  height: 32px;
}

.sprite-radio {
  display: none; /* Hidden, styled via card */
}

.sprite-label {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  font-weight: bold;
}

.form-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}

.config-prompt {
  padding: 12px;
  background: #fff3cd;
  border: 2px solid #ffc107;
  margin-bottom: 20px;
  font-weight: bold;
}

.selection-required {
  color: #dc3545;
  font-weight: bold;
  margin: 8px 0;
}

/* Responsive grid */
@media (max-width: 768px) {
  .sprite-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .sprite-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Pixel-art button styling (no border-radius) */
.btn {
  border: 2px solid #333;
  padding: 8px 16px;
  cursor: pointer;
  background: #fff;
  font-weight: bold;
}

.btn-primary {
  background: #007bff;
  color: #fff;
}

.btn-secondary {
  background: #6c757d;
  color: #fff;
}
```

---

## 8. Scenario Integration

### Scenario JSON Schema Extension

Add optional `validSprites` field to scenario root:

```json
{
  "scenario_brief": "Mission description",
  "startRoom": "reception",
  "validSprites": ["female_*", "male_spy", "male_security_guard"],
  "rooms": { ... }
}
```

**Wildcard Patterns Supported:**
- `"*"` - All sprites allowed
- `"female_*"` - All female sprites
- `"male_*"` - All male sprites
- `"*_hacker"` - All hacker sprites (any gender)
- `"female_hacker_hood"` - Exact sprite match

**Default**: If `validSprites` is not specified, all sprites are allowed.

### Game Initialization Flow

Update `BreakEscape::GamesController#create`:

```ruby
def create
  @game = Game.new(game_params)
  @game.player = current_player
  
  authorize(@game)

  if @game.save
    # Get or create player preference
    player_pref = current_player_preference || create_default_preference
    
    # Check if player needs to configure sprite
    if !player_pref.sprite_selected?
      # No sprite selected - MUST configure
      flash[:alert] = 'Please select your character before starting.'
      redirect_to configuration_path(game_id: @game.id)
    elsif !player_pref.sprite_valid_for_scenario?(@game.scenario_data)
      # Sprite selected but invalid for this scenario
      flash[:alert] = 'Your selected character is not available for this mission. Please choose another.'
      redirect_to configuration_path(game_id: @game.id)
    else
      # All good - start game
      redirect_to game_path(@game)
    end
  else
    flash[:alert] = 'Failed to create game.'
    redirect_to missions_path
  end
end

private

def current_player_preference
  if defined?(current_user) && current_user
    current_user.break_escape_preference
  elsif current_demo_user
    current_demo_user.preference
  end
end

def create_default_preference
  if defined?(current_user) && current_user
    current_user.ensure_break_escape_preference!
    current_user.break_escape_preference
  elsif current_demo_user
    current_demo_user.ensure_preference!
    current_demo_user.preference
  end
end
```

### Inject Sprite into Scenario

Update `Game#generate_scenario_data` to inject player sprite:

```ruby
def generate_scenario_data
  # ... existing code ...
  
  # Inject player preferences
  inject_player_preferences(self.scenario_data)
  
  self.scenario_data
end

private

def inject_player_preferences(scenario_data)
  player_pref = player.respond_to?(:break_escape_preference) ? 
                player.break_escape_preference : 
                player.preference
  
  return unless player_pref
  
  # Set player sprite
  scenario_data['player'] ||= {}
  scenario_data['player']['spriteSheet'] = player_pref.selected_sprite
  scenario_data['player']['displayName'] = player_pref.in_game_name
end
```

---

## 9. Routes

### `config/routes.rb`

```ruby
BreakEscape::Engine.routes.draw do
  # ... existing routes ...

  # Player configuration
  get 'configuration', to: 'player_preferences#show', as: :configuration
  patch 'configuration', to: 'player_preferences#update'
end
```

---

## 10. Testing Strategy

### Model Tests

**`test/models/break_escape/player_preference_test.rb`**

```ruby
require 'test_helper'

module BreakEscape
  class PlayerPreferenceTest < ActiveSupport::TestCase
    test "defaults in_game_name to 'Zero'" do
      demo_user = break_escape_demo_users(:alice)
      pref = PlayerPreference.create!(player: demo_user)
      assert_equal 'Zero', pref.in_game_name
    end

    test "selected_sprite is nil by default" do
      demo_user = break_escape_demo_users(:alice)
      pref = PlayerPreference.create!(player: demo_user)
      assert_nil pref.selected_sprite
    end

    test "sprite_selected? returns false when nil" do
      pref = PlayerPreference.new(selected_sprite: nil)
      assert_not pref.sprite_selected?
    end

    test "sprite_selected? returns true when present" do
      pref = PlayerPreference.new(selected_sprite: 'female_hacker')
      assert pref.sprite_selected?
    end

    test "seeds in_game_name from player.handle" do
      demo_user = break_escape_demo_users(:alice)
      demo_user.update!(handle: 'Agent007')
      pref = PlayerPreference.create!(player: demo_user)
      assert_equal 'Agent007', pref.in_game_name
    end

    test "validates sprite inclusion when present" do
      demo_user = break_escape_demo_users(:alice)
      pref = PlayerPreference.new(player: demo_user, selected_sprite: 'invalid_sprite')
      assert_not pref.valid?
      assert_includes pref.errors[:selected_sprite], 'is not included in the list'
    end

    test "allows nil sprite" do
      demo_user = break_escape_demo_users(:alice)
      pref = PlayerPreference.new(player: demo_user, selected_sprite: nil)
      assert pref.valid?
    end

    test "sprite_valid_for_scenario? with exact match" do
      pref = PlayerPreference.new(selected_sprite: 'female_hacker')
      scenario = { 'validSprites' => ['female_hacker', 'male_spy'] }
      assert pref.sprite_valid_for_scenario?(scenario)
    end

    test "sprite_valid_for_scenario? with wildcard" do
      pref = PlayerPreference.new(selected_sprite: 'female_scientist')
      scenario = { 'validSprites' => ['female_*'] }
      assert pref.sprite_valid_for_scenario?(scenario)
    end

    test "sprite_valid_for_scenario? with no restrictions" do
      pref = PlayerPreference.new(selected_sprite: 'male_nerd')
      scenario = {}
      assert pref.sprite_valid_for_scenario?(scenario)
    end

    test "sprite_valid_for_scenario? rejects invalid sprite" do
      pref = PlayerPreference.new(selected_sprite: 'male_spy')
      scenario = { 'validSprites' => ['female_*'] }
      assert_not pref.sprite_valid_for_scenario?(scenario)
    end

    test "sprite_valid_for_scenario? rejects nil sprite" do
      pref = PlayerPreference.new(selected_sprite: nil)
      scenario = {}
      assert_not pref.sprite_valid_for_scenario?(scenario)
    end
  end
end
```

### Controller Tests

**`test/controllers/break_escape/player_preferences_controller_test.rb`**

```ruby
require 'test_helper'

module BreakEscape
  class PlayerPreferencesControllerTest < ActionDispatch::IntegrationTest
    setup do
      @demo_user = break_escape_demo_users(:alice)
      sign_in_demo_user(@demo_user)
      @preference = @demo_user.ensure_preference!
    end

    test "should get configuration page" do
      get configuration_url
      assert_response :success
      assert_select 'h1', 'Player Configuration'
    end

    test "should update preferences" do
      patch configuration_url, params: {
        player_preference: {
          selected_sprite: 'male_spy',
          in_game_name: 'Agent99'
        }
      }
      assert_redirected_to configuration_path
      
      @preference.reload
      assert_equal 'male_spy', @preference.selected_sprite
      assert_equal 'Agent99', @preference.in_game_name
    end

    test "should reject invalid sprite" do
      patch configuration_url, params: {
        player_preference: {
          selected_sprite: 'invalid_sprite'
        }
      }
      assert_response :unprocessable_entity
    end

    test "should require sprite selection" do
      patch configuration_url, params: {
        player_preference: {
          selected_sprite: nil,
          in_game_name: 'Test'
        }
      }
      # Should re-render form with error
      assert_response :success
      assert_select '.selection-required'
    end

    test "should redirect to game after validation flow" do
      mission = break_escape_missions(:m01)
      game = Game.create!(player: @demo_user, mission: mission)
      
      patch configuration_url, params: {
        player_preference: { selected_sprite: 'female_spy' },
        game_id: game.id
      }
      
      assert_redirected_to game_path(game)
    end
  end
end
```

### Policy Tests

**`test/policies/break_escape/player_preference_policy_test.rb`**

```ruby
require 'test_helper'

module BreakEscape
  class PlayerPreferencePolicyTest < ActiveSupport::TestCase
    test "player can view their own preference" do
      user = break_escape_demo_users(:alice)
      preference = PlayerPreference.create!(player: user)
      
      policy = PlayerPreferencePolicy.new(user, preference)
      assert policy.show?
      assert policy.update?
    end

    test "player cannot view another player's preference" do
      alice = break_escape_demo_users(:alice)
      bob = break_escape_demo_users(:bob)
      preference = PlayerPreference.create!(player: bob)
      
      policy = PlayerPreferencePolicy.new(alice, preference)
      assert_not policy.show?
      assert_not policy.update?
    end
  end
end
```

### Integration Tests

**`test/integration/sprite_selection_flow_test.rb`**

```ruby
require 'test_helper'

module BreakEscape
  class SpriteSelectionFlowTest < ActionDispatch::IntegrationTest
    test "new player gets default name but no sprite" do
      demo_user = DemoUser.create!(handle: 'NewPlayer')
      sign_in_demo_user(demo_user)
      
      pref = demo_user.ensure_preference!
      assert_nil pref.selected_sprite
      assert_equal 'NewPlayer', pref.in_game_name
    end

    test "new player prompted to select sprite before game" do
      demo_user = break_escape_demo_users(:alice)
      sign_in_demo_user(demo_user)
      
      # Ensure no sprite selected
      pref = demo_user.ensure_preference!
      pref.update!(selected_sprite: nil)
      
      mission = break_escape_missions(:m01)
      post games_url, params: { game: { mission_id: mission.id } }
      
      # Should redirect to configuration
      assert_redirected_to configuration_path(game_id: assigns(:game).id)
      follow_redirect!
      assert_select '.config-prompt', /select your character/
    end

    test "player with invalid sprite prompted to reconfigure" do
      demo_user = break_escape_demo_users(:alice)
      sign_in_demo_user(demo_user)
      
      # Set invalid sprite for scenario
      pref = demo_user.ensure_preference!
      pref.update!(selected_sprite: 'male_spy')
      
      # Create game with female-only sprites
      mission = break_escape_missions(:m01)
      mission.scenario_template['validSprites'] = ['female_*']
      mission.save!
      
      post games_url, params: { game: { mission_id: mission.id } }
      
      # Should redirect to configuration
      assert_redirected_to configuration_path(game_id: assigns(:game).id)
      follow_redirect!
      assert_select '.alert', /not available for this mission/
    end

    test "valid sprite allows direct game start" do
      demo_user = break_escape_demo_users(:alice)
      sign_in_demo_user(demo_user)
      
      pref = demo_user.ensure_preference!
      pref.update!(selected_sprite: 'female_hacker')
      
      mission = break_escape_missions(:m01)
      post games_url, params: { game: { mission_id: mission.id } }
      
      # Should go directly to game
      assert_redirected_to game_path(assigns(:game))
    end
  end
end
```

---

## 11. Fixtures

### `test/fixtures/break_escape/player_preferences.yml`

```yaml
alice_preference:
  player: alice (BreakEscape::DemoUser)
  selected_sprite: female_hacker_hood
  in_game_name: Alice

bob_preference:
  player: bob (BreakEscape::DemoUser)
  selected_sprite: male_spy
  in_game_name: BobTheBuilder

new_player_preference:
  player: charlie (BreakEscape::DemoUser)
  selected_sprite: null  # No sprite selected yet
  in_game_name: Zero
```

---

## 12. Migration Steps

### Order of Operations

1. **Generate migration**:
   ```bash
   rails generate migration CreateBreakEscapePlayerPreferences
   ```

2. **Edit migration file** (use schema from Section 1)

3. **Run migration**:
   ```bash
   rails db:migrate
   ```

4. **Create model** with validations and associations

5. **Update DemoUser model** to include `has_one :preference`

6. **Create controller** with show/update actions

7. **Create policy** for authorization

8. **Add routes** to `config/routes.rb`

9. **Create views** with sprite grid and Phaser previews

10. **Add JavaScript** for sprite animations

11. **Add CSS** for styling (pixel-art aesthetic)

12. **Update Game model** to inject preferences into scenario

13. **Update GamesController** to validate sprite before game start

14. **Write tests** (model, controller, policy, integration)

15. **Add fixtures** for testing

---

## 13. Edge Cases & Considerations

### Edge Cases to Handle

1. **Player has no preference record**:
   - Auto-create on game creation or configuration access
   - Defaults: sprite = NULL (must choose), name = `Zero` or seeded from handle

2. **Scenario adds `validSprites` mid-playthrough**:
   - Only validate on game creation
   - Allow existing games to continue with current sprite

3. **New sprites added to system**:
   - Add to `AVAILABLE_SPRITES` constant
   - Existing preferences remain valid
   - New sprites appear in grid automatically

4. **Player deletes preference record**:
   - Auto-recreate with defaults on next access
   - Will be prompted to select sprite again

5. **Hacktivity user has no `handle`**:
   - Fall back to `Zero` default name

6. **Scenario specifies empty `validSprites: []`**:
   - Treat as "no sprites allowed" (block game creation)
   - Show error message

7. **Scenario has overlapping wildcards**:
   - Example: `['female_*', 'female_hacker']`
   - Works correctly (both patterns match)

8. **Legacy scenarios without `validSprites`**:
   - All sprites allowed (backward compatible)

### Performance Considerations

- **Preference lookup**: Single query per request (cached in controller)
- **Sprite validation**: In-memory regex matching (fast)
- **Phaser rendering**: Single WebGL context, shared texture memory (~15MB)
- **Grid rendering**: 16 animated sprites, acceptable performance on modern devices

### Security Considerations

- **Policy enforcement**: Every action authorized via Pundit
- **SQL injection**: Use parameterized queries (ActiveRecord handles this)
- **XSS**: ERB escapes output by default
- **CSRF**: Rails form helpers include CSRF tokens
- **Mass assignment**: Strong parameters whitelist fields

---

## 14. Future Enhancements

### Phase 2 Features (Not in Initial Implementation)

1. **Sprite unlocking system**:
   - Start with subset unlocked
   - Unlock more via achievements/missions
   - Show unlock requirements on locked sprites

2. **Custom color tinting**:
   - Allow players to customize sprite colors
   - Store `sprite_color_tint` in preferences

3. **Sprite portraits**:
   - Auto-generate portrait from sprite sheet
   - Use in dialogue scenes and profile page

4. **Multiple preference profiles**:
   - Allow players to save multiple configurations
   - Switch between profiles per game

5. **Admin sprite override**:
   - Instructors can force specific sprites for story reasons
   - Store in `mission.forced_sprite`

6. **Sprite preview in game select**:
   - Show player's sprite on mission select screen
   - Preview how sprite looks in that scenario

7. **Animated previews**:
   - If performance allows, add CSS sprite animations
   - Or lightweight Phaser previews on desktop only

---

## 15. Documentation Updates

### Files to Update

1. **README.md**: Add player configuration section
2. **docs/PLAYER_PREFERENCES.md**: New file with usage guide
3. **.github/copilot-instructions.md**: Add preference system to architecture section
4. **CHANGELOG.md**: Document new feature

### User Documentation

Create `docs/PLAYER_PREFERENCES.md`:

```markdown
# Player Preferences

Break Escape allows players to customize their in-game appearance and code name.

## Configuration Screen

Access via `/break_escape/configuration` to set:

- **Code Name**: Your display name in-game (1-20 characters)
- **Character Sprite**: Visual appearance (16 sprites available)

## Scenario Restrictions

Some missions may restrict available sprites for story reasons. 
Locked sprites are shown with a padlock icon.

## Sprite Categories

- **Female Characters**: 8 variants (hacker, spy, scientist, etc.)
- **Male Characters**: 8 variants (hacker, spy, scientist, etc.)

Preferences persist across all games and scenarios.
```

---

## 16. Implementation Checklist

- [ ] Create migration for `break_escape_player_preferences`
- [ ] Run migration (`rails db:migrate`)
- [ ] Create `PlayerPreference` model with validations
- [ ] Update `DemoUser` model with `has_one :preference`
- [ ] Create `PlayerPreferencesController` with show/update
- [ ] Create `PlayerPreferencePolicy` with authorization
- [ ] Add routes to `config/routes.rb`
- [ ] Create view `show.html.erb` with sprite grid
- [ ] Create JavaScript `sprite-preview.js` for Phaser previews
- [ ] Create CSS `player_preferences.css` with pixel-art styling
- [ ] Update `Game` model to inject preferences
- [ ] Update `GamesController#create` to validate sprite
- [ ] Add helper methods to `PlayerPreferencesHelper`
- [ ] Create fixtures for testing
- [ ] Write model tests (validations, sprite matching)
- [ ] Write controller tests (show, update)
- [ ] Write policy tests (authorization)
- [ ] Write integration tests (full flow)
- [ ] Update documentation (README, CHANGELOG, copilot-instructions)
- [ ] Create user guide (`docs/PLAYER_PREFERENCES.md`)
- [ ] Test in both standalone and Hacktivity modes
- [ ] Test with various wildcard patterns
- [ ] Test padlock overlay rendering
- [ ] Test Phaser preview animations

---

## 17. Review Decisions (APPROVED)

1. **Default sprite**: ✅ NULL - player MUST choose before first game
2. **Name validation**: ✅ Alphanumeric + spaces/underscores, server-side validation only
3. **Scenario wildcards**: ✅ `female_*`, `male_*`, `*_hacker` patterns approved
4. **Locked sprites UI**: ⏸️ Deferred to Phase 2 (show reason for lock)
5. **Preview animation**: ✅ Static images (`breathing-idle_south` frame 0)
6. **Mobile UI**: ✅ HTML-based grid with responsive CSS (not Phaser canvases)
7. **Preference migration**: ✅ Prompt when starting a game
8. **Analytics**: ❌ Not needed for initial release

---

## End of Plan

This plan is ready for review. Once approved, implementation can proceed in the order outlined in Section 12 (Migration Steps).
