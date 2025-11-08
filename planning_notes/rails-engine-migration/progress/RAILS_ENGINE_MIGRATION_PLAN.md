# Rails Engine Migration Plan for BreakEscape

## Executive Summary

This document provides a comprehensive plan to migrate BreakEscape from a standalone browser application to a Rails Engine that can:
1. Run standalone as a complete application
2. Mount inside Hacktivity Cyber Security Labs
3. Access Hacktivity's user authentication (Devise)
4. Generate customized scenarios per user
5. Track game state in database

---

## What is a Rails Engine?

A Rails Engine is a miniature Rails application that can be mounted inside a host application. Think of it as a plugin or module that brings complete functionality.

**Key Benefits:**
- Self-contained (models, controllers, views, assets)
- Mountable in host apps
- Can share resources (users table) with host app
- Can run standalone for development/testing
- Namespace isolation (no conflicts with host app)

---

## Project Structure

### Current Structure (Standalone Browser App)

```
BreakEscape/
├── assets/           # Images, sounds, sprites
├── css/              # Stylesheets
├── js/               # JavaScript game engine
├── scenarios/        # Scenario JSON files
├── index.html        # Main entry point
└── *.html           # Test pages
```

### Target Structure (Rails Engine)

```
break_escape/                         # Root gem directory
├── app/
│   ├── assets/
│   │   ├── config/
│   │   │   └── break_escape_manifest.js  # Asset pipeline manifest
│   │   ├── images/
│   │   │   └── break_escape/            # All images (from assets/)
│   │   ├── javascripts/
│   │   │   └── break_escape/            # All JS (from js/)
│   │   │       ├── application.js
│   │   │       ├── core/
│   │   │       ├── systems/
│   │   │       ├── minigames/
│   │   │       └── utils/
│   │   └── stylesheets/
│   │       └── break_escape/            # All CSS (from css/)
│   ├── controllers/
│   │   └── break_escape/
│   │       ├── application_controller.rb
│   │       ├── games_controller.rb
│   │       ├── scenarios_controller.rb
│   │       └── api/
│   │           ├── rooms_controller.rb
│   │           ├── containers_controller.rb
│   │           ├── inventory_controller.rb
│   │           ├── npcs_controller.rb
│   │           └── unlock_controller.rb
│   ├── models/
│   │   └── break_escape/
│   │       ├── application_record.rb
│   │       ├── game_instance.rb
│   │       ├── scenario.rb
│   │       ├── room.rb
│   │       ├── room_object.rb
│   │       ├── npc.rb
│   │       ├── conversation.rb
│   │       ├── player_state.rb
│   │       └── inventory_item.rb
│   ├── views/
│   │   └── break_escape/
│   │       ├── layouts/
│   │       │   └── application.html.erb
│   │       ├── games/
│   │       │   ├── index.html.erb       # Game launcher
│   │       │   └── show.html.erb        # Main game view
│   │       └── scenarios/
│   │           ├── index.html.erb       # Scenario selector
│   │           └── show.html.erb        # Scenario details
│   ├── policies/
│   │   └── break_escape/
│   │       ├── game_instance_policy.rb
│   │       ├── scenario_policy.rb
│   │       └── api/
│   │           └── base_policy.rb
│   ├── serializers/
│   │   └── break_escape/
│   │       ├── room_serializer.rb
│   │       ├── container_serializer.rb
│   │       └── npc_serializer.rb
│   └── services/
│       └── break_escape/
│           ├── scenario_generator.rb
│           ├── game_state_manager.rb
│           └── unlock_validator.rb
├── config/
│   └── routes.rb                        # Engine routes
├── db/
│   └── migrate/                         # Engine migrations
├── lib/
│   ├── break_escape/
│   │   ├── engine.rb                    # Engine definition
│   │   └── version.rb
│   └── break_escape.rb                  # Gem entry point
├── test/
│   ├── controllers/
│   ├── models/
│   ├── integration/
│   └── policies/
├── break_escape.gemspec                 # Gem specification
├── Gemfile
└── README.md
```

---

## Phase 1: Create Rails Engine

### Step 1.1: Generate Engine

```bash
# From parent directory of BreakEscape
cd /path/to/parent

# Generate a mountable engine
rails plugin new break_escape --mountable --database=postgresql

# This creates the engine structure with proper namespacing
```

**What this creates:**
- Engine skeleton with proper namespacing
- `lib/break_escape/engine.rb` - Engine definition
- `app/` directories with `break_escape/` namespacing
- `config/routes.rb` for engine routes
- Test framework setup
- Gemspec file

### Step 1.2: Configure Engine

**Edit `lib/break_escape/engine.rb`:**

```ruby
module BreakEscape
  class Engine < ::Rails::Engine
    isolate_namespace BreakEscape

    # Configure asset pipeline
    config.assets.paths << root.join('app', 'assets', 'images', 'break_escape')
    config.assets.paths << root.join('app', 'assets', 'javascripts', 'break_escape')
    config.assets.paths << root.join('app', 'assets', 'stylesheets', 'break_escape')
    config.assets.precompile += %w( break_escape/application.js break_escape/application.css )
    
    # Configure generators
    config.generators do |g|
      g.test_framework :test_unit, fixture: false
      g.fixture_replacement :factory_bot
      g.factory_bot dir: 'test/factories'
    end
    
    # Allow host app to override policies
    config.to_prepare do
      # Load engine policies
      Dir.glob(Engine.root.join('app', 'policies', '**', '*_policy.rb')).each do |c|
        require_dependency(c)
      end
    end
    
    # Initialize game on engine load
    initializer "break_escape.assets" do |app|
      Rails.application.config.assets.precompile += %w( 
        break_escape/**/*.js 
        break_escape/**/*.css
        break_escape/**/*.png
        break_escape/**/*.jpg
        break_escape/**/*.mp3
      )
    end
  end
end
```

**Edit `break_escape.gemspec`:**

```ruby
require_relative "lib/break_escape/version"

Gem::Specification.new do |spec|
  spec.name        = "break_escape"
  spec.version     = BreakEscape::VERSION
  spec.authors     = ["Your Name"]
  spec.email       = ["your.email@example.com"]
  spec.homepage    = "https://github.com/yourorg/break_escape"
  spec.summary     = "A cyber security escape room game engine"
  spec.description = "Rails engine for BreakEscape - an educational cyber security game"
  spec.license     = "MIT"

  spec.files = Dir.chdir(File.expand_path(__dir__)) do
    Dir["{app,config,db,lib}/**/*", "MIT-LICENSE", "Rakefile", "README.md"]
  end

  spec.add_dependency "rails", ">= 7.0"
  spec.add_dependency "pundit", "~> 2.3"
  spec.add_dependency "sprockets-rails"
  
  # For JSON API responses
  spec.add_dependency "jbuilder"
  
  # For Ink script processing (if server-side needed)
  # spec.add_dependency "execjs"
  
  spec.add_development_dependency "pg"
  spec.add_development_dependency "rspec-rails"
  spec.add_development_dependency "factory_bot_rails"
  spec.add_development_dependency "faker"
end
```

---

## Phase 2: Move Assets to Engine

### Step 2.1: Create Asset Directory Structure

```bash
cd break_escape

# Create directories
mkdir -p app/assets/images/break_escape
mkdir -p app/assets/javascripts/break_escape/{core,systems,minigames,utils}
mkdir -p app/assets/stylesheets/break_escape
```

### Step 2.2: Move Files Using Bash Script

**Create `scripts/migrate_assets.sh`:**

```bash
#!/bin/bash

# Script to migrate BreakEscape assets to Rails Engine structure
# Run from BreakEscape root directory

ENGINE_ROOT="../break_escape"
SOURCE_ROOT="."

echo "Migrating BreakEscape assets to Rails Engine..."

# Function to copy with progress
copy_with_progress() {
    local source=$1
    local dest=$2
    echo "  Copying: $source -> $dest"
    cp -r "$source" "$dest"
}

# 1. Migrate Images
echo "1. Migrating images..."
copy_with_progress "$SOURCE_ROOT/assets/" "$ENGINE_ROOT/app/assets/images/break_escape/"

# 2. Migrate JavaScript
echo "2. Migrating JavaScript..."

# Core files
copy_with_progress "$SOURCE_ROOT/js/core/" "$ENGINE_ROOT/app/assets/javascripts/break_escape/core/"

# Systems
copy_with_progress "$SOURCE_ROOT/js/systems/" "$ENGINE_ROOT/app/assets/javascripts/break_escape/systems/"

# Minigames
copy_with_progress "$SOURCE_ROOT/js/minigames/" "$ENGINE_ROOT/app/assets/javascripts/break_escape/minigames/"

# Utils
copy_with_progress "$SOURCE_ROOT/js/utils/" "$ENGINE_ROOT/app/assets/javascripts/break_escape/utils/"

# UI
copy_with_progress "$SOURCE_ROOT/js/ui/" "$ENGINE_ROOT/app/assets/javascripts/break_escape/ui/"

# Main entry point
copy_with_progress "$SOURCE_ROOT/js/main.js" "$ENGINE_ROOT/app/assets/javascripts/break_escape/main.js"

# 3. Migrate CSS
echo "3. Migrating CSS..."
copy_with_progress "$SOURCE_ROOT/css/" "$ENGINE_ROOT/app/assets/stylesheets/break_escape/"

# 4. Migrate Scenarios (to db/seeds for now)
echo "4. Copying scenarios for later import..."
mkdir -p "$ENGINE_ROOT/db/scenario_seeds"
copy_with_progress "$SOURCE_ROOT/scenarios/" "$ENGINE_ROOT/db/scenario_seeds/"

echo "Asset migration complete!"
echo ""
echo "Next steps:"
echo "  1. Review copied files"
echo "  2. Update asset manifest (app/assets/config/break_escape_manifest.js)"
echo "  3. Run: rails assets:precompile"
```

**Run migration:**

```bash
chmod +x scripts/migrate_assets.sh
./scripts/migrate_assets.sh
```

### Step 2.3: Create Asset Manifests

**Create `app/assets/config/break_escape_manifest.js`:**

```javascript
// BreakEscape Asset Manifest
// Links all JS, CSS, and images for the engine

//= link_tree ../images/break_escape
//= link_directory ../javascripts/break_escape .js
//= link_directory ../stylesheets/break_escape .css
```

**Create `app/assets/javascripts/break_escape/application.js`:**

```javascript
// BreakEscape Game Engine - Main Application Bundle
// This is the entry point for the game engine

// Vendor libraries (Phaser, Ink)
//= require phaser
//= require ink

// Core engine files
//= require_tree ./core

// Game systems
//= require_tree ./systems

// Minigames
//= require_tree ./minigames

// Utils
//= require_tree ./utils

// UI components
//= require_tree ./ui

// Main game initialization
//= require ./main

console.log('BreakEscape Game Engine Loaded');
```

**Create `app/assets/stylesheets/break_escape/application.css`:**

```css
/*
 * BreakEscape Stylesheet Manifest
 *
 *= require_self
 *= require ./main
 *= require ./biometrics-minigame
 *= require ./bluetooth-scanner
 *= require ./container-minigame
 *= require ./dusting
 *= require ./inventory
 *= require ./lockpick-set-minigame
 *= require ./lockpicking
 *= require ./minigames-framework
 *= require ./modals
 *= require ./notes
 *= require ./notifications
 *= require ./npc-barks
 *= require ./panels
 *= require ./password-minigame
 *= require ./phone-chat-minigame
 *= require ./pin
 *= require ./text-file-minigame
 *= require ./utilities
 */
```

---

## Phase 3: Database Schema

### Step 3.1: Create Migrations

**Generate models:**

```bash
cd break_escape

# Scenario
rails g model Scenario \
  name:string \
  description:text \
  brief:text \
  start_room:string \
  difficulty:string \
  estimated_time:integer \
  published:boolean

# GameInstance (one per user per scenario)
rails g model GameInstance \
  user:references \
  scenario:references \
  state:string \
  started_at:datetime \
  completed_at:datetime \
  score:integer \
  time_spent:integer

# Room
rails g model Room \
  scenario:references \
  room_id:string \
  room_type:string \
  connections:jsonb \
  locked:boolean \
  lock_type:string \
  lock_requirement:text \
  key_pins:jsonb \
  difficulty:string

# RoomObject
rails g model RoomObject \
  room:references \
  object_id:string \
  object_type:string \
  name:string \
  takeable:boolean \
  readable:boolean \
  locked:boolean \
  lock_type:string \
  lock_requirement:text \
  observations:text \
  properties:jsonb

# NPC
rails g model NPC \
  scenario:references \
  npc_id:string \
  display_name:string \
  avatar_url:string \
  phone_id:string \
  npc_type:string \
  ink_script:text \
  event_mappings:jsonb \
  timed_messages:jsonb \
  security_level:string

# Conversation (tracks player-NPC dialogue)
rails g model Conversation \
  game_instance:references \
  npc:references \
  history:jsonb \
  story_state:jsonb \
  current_knot:string \
  last_message_at:datetime

# PlayerState (tracks game state per instance)
rails g model PlayerState \
  game_instance:references \
  room_id:string \
  position_x:float \
  position_y:float \
  unlocked_rooms:jsonb \
  unlocked_objects:jsonb \
  collected_items:jsonb \
  completed_objectives:jsonb \
  custom_state:jsonb

# InventoryItem
rails g model InventoryItem \
  game_instance:references \
  object_type:string \
  name:string \
  source_room:string \
  source_object:string \
  acquired_at:datetime \
  used:boolean
```

### Step 3.2: Customize Migrations

**Edit `db/migrate/XXXXXX_create_break_escape_game_instances.rb`:**

```ruby
class CreateBreakEscapeGameInstances < ActiveRecord::Migration[7.0]
  def change
    create_table :break_escape_game_instances do |t|
      # Foreign key to host app's users table (or local user table)
      t.references :user, null: false, foreign_key: false # Don't force FK to allow mounting
      t.references :scenario, null: false, foreign_key: { to_table: :break_escape_scenarios }
      
      t.string :state, default: 'not_started' # not_started, in_progress, completed, abandoned
      t.datetime :started_at
      t.datetime :completed_at
      t.integer :score, default: 0
      t.integer :time_spent, default: 0 # seconds
      
      t.timestamps
      
      t.index [:user_id, :scenario_id], unique: true
      t.index :state
    end
  end
end
```

**Edit `db/migrate/XXXXXX_create_break_escape_rooms.rb`:**

```ruby
class CreateBreakEscapeRooms < ActiveRecord::Migration[7.0]
  def change
    create_table :break_escape_rooms do |t|
      t.references :scenario, null: false, foreign_key: { to_table: :break_escape_scenarios }
      
      t.string :room_id, null: false # e.g. 'reception', 'office1'
      t.string :room_type, null: false # e.g. 'room_reception', 'room_office'
      t.jsonb :connections, default: {} # { north: 'office1', south: 'lobby' }
      
      t.boolean :locked, default: false
      t.string :lock_type # key, pin, password, biometric, bluetooth
      t.text :lock_requirement # encrypted requirement value
      t.jsonb :key_pins # For lockpicking: [0, 50, 100, 150]
      t.string :difficulty # easy, medium, hard
      
      t.timestamps
      
      t.index [:scenario_id, :room_id], unique: true
      t.index :room_type
    end
  end
end
```

**Edit `db/migrate/XXXXXX_create_break_escape_room_objects.rb`:**

```ruby
class CreateBreakEscapeRoomObjects < ActiveRecord::Migration[7.0]
  def change
    create_table :break_escape_room_objects do |t|
      t.references :room, null: false, foreign_key: { to_table: :break_escape_rooms }
      
      t.string :object_id, null: false # Unique identifier
      t.string :object_type, null: false # key, notes, phone, pc, etc.
      t.string :name, null: false
      
      t.boolean :takeable, default: false
      t.boolean :readable, default: false
      t.boolean :locked, default: false
      
      t.string :lock_type
      t.text :lock_requirement # encrypted
      t.text :observations
      
      # Store all other properties as JSON
      t.jsonb :properties, default: {}
      # Properties might include:
      # - text (readable text)
      # - voice (voice message)
      # - contents (array of contained items)
      # - key_id, keyPins
      # - etc.
      
      t.timestamps
      
      t.index [:room_id, :object_id], unique: true
      t.index :object_type
    end
  end
end
```

**Edit `db/migrate/XXXXXX_create_break_escape_npcs.rb`:**

```ruby
class CreateBreakEscapeNPCs < ActiveRecord::Migration[7.0]
  def change
    create_table :break_escape_npcs do |t|
      t.references :scenario, null: false, foreign_key: { to_table: :break_escape_scenarios }
      
      t.string :npc_id, null: false
      t.string :display_name, null: false
      t.string :avatar_url
      t.string :phone_id, default: 'player_phone'
      t.string :npc_type, default: 'phone' # phone, sprite
      
      # Store complete ink script as TEXT (JSON string)
      t.text :ink_script
      
      # Event mappings for reactive dialogue
      t.jsonb :event_mappings, default: []
      # Format: [{ eventPattern, targetKnot, onceOnly, cooldown, condition }]
      
      # Timed messages
      t.jsonb :timed_messages, default: []
      # Format: [{ delay, message, type }]
      
      t.string :security_level, default: 'low' # low, medium, high
      
      t.timestamps
      
      t.index [:scenario_id, :npc_id], unique: true
      t.index :npc_type
      t.index :security_level
    end
  end
end
```

### Step 3.3: Add Indexes and Constraints

**Create additional migration for performance:**

```bash
rails g migration AddBreakEscapeIndexes
```

**Edit migration:**

```ruby
class AddBreakEscapeIndexes < ActiveRecord::Migration[7.0]
  def change
    # Game instance queries
    add_index :break_escape_game_instances, [:user_id, :state]
    add_index :break_escape_game_instances, :started_at
    add_index :break_escape_game_instances, :completed_at
    
    # Room queries
    add_index :break_escape_rooms, :locked
    add_index :break_escape_rooms, :lock_type
    
    # Object queries
    add_index :break_escape_room_objects, :takeable
    add_index :break_escape_room_objects, :locked
    add_index :break_escape_room_objects, :lock_type
    
    # Conversation queries
    add_index :break_escape_conversations, [:game_instance_id, :npc_id], 
              unique: true, 
              name: 'index_break_escape_convos_on_game_and_npc'
    add_index :break_escape_conversations, :last_message_at
    
    # Inventory queries
    add_index :break_escape_inventory_items, [:game_instance_id, :object_type]
    add_index :break_escape_inventory_items, :acquired_at
    add_index :break_escape_inventory_items, :used
    
    # JSONB indexes for fast queries
    add_index :break_escape_rooms, :connections, using: :gin
    add_index :break_escape_room_objects, :properties, using: :gin
    add_index :break_escape_conversations, :history, using: :gin
    add_index :break_escape_player_states, :custom_state, using: :gin
  end
end
```

---

## Phase 4: Models and Business Logic

### Step 4.1: Create Models

**`app/models/break_escape/application_record.rb`:**

```ruby
module BreakEscape
  class ApplicationRecord < ActiveRecord::Base
    self.abstract_class = true
  end
end
```

**`app/models/break_escape/scenario.rb`:**

```ruby
module BreakEscape
  class Scenario < ApplicationRecord
    has_many :rooms, dependent: :destroy
    has_many :npcs, dependent: :destroy
    has_many :game_instances, dependent: :destroy
    
    validates :name, presence: true, uniqueness: true
    validates :start_room, presence: true
    
    scope :published, -> { where(published: true) }
    scope :by_difficulty, ->(diff) { where(difficulty: diff) }
    
    # Get start room data
    def start_room_data
      rooms.find_by(room_id: start_room)
    end
    
    # Export scenario to JSON format (for standalone mode)
    def to_game_json
      {
        scenario_brief: brief,
        startRoom: start_room,
        npcs: npcs.map(&:to_game_json),
        rooms: rooms.index_by(&:room_id).transform_values(&:to_game_json)
      }
    end
  end
end
```

**`app/models/break_escape/game_instance.rb`:**

```ruby
module BreakEscape
  class GameInstance < ApplicationRecord
    belongs_to :user
    belongs_to :scenario
    has_one :player_state, dependent: :destroy
    has_many :conversations, dependent: :destroy
    has_many :inventory_items, dependent: :destroy
    
    enum state: {
      not_started: 'not_started',
      in_progress: 'in_progress',
      completed: 'completed',
      abandoned: 'abandoned'
    }
    
    validates :user_id, uniqueness: { scope: :scenario_id }
    
    after_create :initialize_player_state
    
    # Start the game
    def start!
      update!(
        state: 'in_progress',
        started_at: Time.current
      )
      
      # Initialize starting room
      player_state.unlock_room!(scenario.start_room)
      
      # Add starting inventory items
      scenario.start_items.each do |item|
        add_to_inventory(item)
      end
    end
    
    # Complete the game
    def complete!(final_score)
      update!(
        state: 'completed',
        completed_at: Time.current,
        score: final_score,
        time_spent: (Time.current - started_at).to_i
      )
    end
    
    # Check if room is accessible
    def room_accessible?(room_id)
      player_state.room_unlocked?(room_id)
    end
    
    # Check if object is accessible
    def object_accessible?(object_id)
      player_state.object_unlocked?(object_id)
    end
    
    # Add item to inventory
    def add_to_inventory(item_data)
      inventory_items.create!(
        object_type: item_data[:type],
        name: item_data[:name],
        source_room: item_data[:source_room],
        source_object: item_data[:source_object],
        acquired_at: Time.current
      )
    end
    
    private
    
    def initialize_player_state
      create_player_state!(
        room_id: scenario.start_room,
        position_x: 0,
        position_y: 0,
        unlocked_rooms: [scenario.start_room],
        unlocked_objects: [],
        collected_items: [],
        completed_objectives: []
      )
    end
  end
end
```

**`app/models/break_escape/room.rb`:**

```ruby
module BreakEscape
  class Room < ApplicationRecord
    belongs_to :scenario
    has_many :room_objects, dependent: :destroy
    
    validates :room_id, presence: true, uniqueness: { scope: :scenario_id }
    validates :room_type, presence: true
    
    # Check if room is locked for a specific game instance
    def locked_for?(game_instance)
      return false unless locked
      
      # Check if player has unlocked this room
      !game_instance.room_accessible?(room_id)
    end
    
    # Get accessible objects for a game instance
    def accessible_objects_for(game_instance)
      room_objects.select do |obj|
        game_instance.object_accessible?(obj.object_id) || !obj.locked
      end
    end
    
    # Export to game JSON format
    def to_game_json
      {
        type: room_type,
        connections: connections,
        locked: locked,
        lockType: lock_type,
        requires: lock_requirement,
        keyPins: key_pins,
        difficulty: difficulty,
        objects: room_objects.map(&:to_game_json)
      }
    end
  end
end
```

**`app/models/break_escape/room_object.rb`:**

```ruby
module BreakEscape
  class RoomObject < ApplicationRecord
    belongs_to :room
    
    validates :object_id, presence: true, uniqueness: { scope: :room_id }
    validates :object_type, presence: true
    validates :name, presence: true
    
    # Check if object is locked for a specific game instance
    def locked_for?(game_instance)
      return false unless locked
      
      !game_instance.object_accessible?(object_id)
    end
    
    # Get object contents (for containers)
    def contents
      properties['contents'] || []
    end
    
    # Check if object has contents
    def container?
      contents.any?
    end
    
    # Export to game JSON format
    def to_game_json
      base = {
        type: object_type,
        name: name,
        takeable: takeable,
        readable: readable,
        locked: locked,
        lockType: lock_type,
        observations: observations
      }
      
      # Merge additional properties
      base.merge(properties.symbolize_keys)
    end
  end
end
```

**`app/models/break_escape/npc.rb`:**

```ruby
module BreakEscape
  class NPC < ApplicationRecord
    belongs_to :scenario
    has_many :conversations
    
    validates :npc_id, presence: true, uniqueness: { scope: :scenario_id }
    validates :display_name, presence: true
    
    # Get dialogue for a player
    def get_dialogue(game_instance, player_choice = nil)
      conversation = conversations.find_or_create_by(game_instance: game_instance)
      
      # Server-side ink engine would go here
      # For now, return minimal response
      {
        text: "Dialogue system not yet implemented",
        choices: []
      }
    end
    
    # Check if NPC can perform an action
    def can_perform_action?(game_instance, action, context = {})
      case action
      when 'unlock_door'
        # Check permissions, trust level, etc.
        true # Placeholder
      when 'give_item'
        true # Placeholder
      else
        false
      end
    end
    
    # Check if NPC is unlocked for a game instance
    def unlocked_for?(game_instance)
      # NPCs might be gated by progression
      true # For now, all NPCs available
    end
    
    # Export to game JSON format
    def to_game_json
      {
        id: npc_id,
        displayName: display_name,
        avatar: avatar_url,
        phoneId: phone_id,
        npcType: npc_type,
        storyJSON: ink_script.present? ? JSON.parse(ink_script) : nil,
        eventMappings: event_mappings,
        timedMessages: timed_messages,
        currentKnot: 'start'
      }
    end
  end
end
```

**`app/models/break_escape/player_state.rb`:**

```ruby
module BreakEscape
  class PlayerState < ApplicationRecord
    belongs_to :game_instance
    
    # Unlock a room
    def unlock_room!(room_id)
      unlocked = unlocked_rooms || []
      unlocked << room_id unless unlocked.include?(room_id)
      update!(unlocked_rooms: unlocked)
    end
    
    # Check if room is unlocked
    def room_unlocked?(room_id)
      (unlocked_rooms || []).include?(room_id)
    end
    
    # Unlock an object
    def unlock_object!(object_id)
      unlocked = unlocked_objects || []
      unlocked << object_id unless unlocked.include?(object_id)
      update!(unlocked_objects: unlocked)
    end
    
    # Check if object is unlocked
    def object_unlocked?(object_id)
      (unlocked_objects || []).include?(object_id)
    end
    
    # Update player position
    def update_position!(x, y, room_id)
      update!(
        position_x: x,
        position_y: y,
        room_id: room_id
      )
    end
    
    # Complete an objective
    def complete_objective!(objective_id)
      objectives = completed_objectives || []
      objectives << objective_id unless objectives.include?(objective_id)
      update!(completed_objectives: objectives)
    end
  end
end
```

---

## Phase 5: Controllers and API

### Step 5.1: Application Controller

**`app/controllers/break_escape/application_controller.rb`:**

```ruby
module BreakEscape
  class ApplicationController < ActionController::Base
    include Pundit::Authorization
    
    protect_from_forgery with: :exception
    
    before_action :authenticate_user!
    
    rescue_from Pundit::NotAuthorizedError, with: :user_not_authorized
    
    private
    
    def authenticate_user!
      # If mounted in host app with Devise, use their current_user
      # If standalone, implement own authentication
      unless defined?(super) && super
        redirect_to main_app.root_path, alert: 'Please sign in to play'
      end
    end
    
    def current_user
      # Use host app's current_user if available
      if defined?(super)
        super
      else
        # Standalone mode - implement own user handling
        @current_user ||= User.first # Placeholder
      end
    end
    
    def user_not_authorized
      respond_to do |format|
        format.json { render json: { error: 'Unauthorized' }, status: :forbidden }
        format.html { redirect_to root_path, alert: 'You are not authorized to perform this action.' }
      end
    end
  end
end
```

### Step 5.2: Game Controllers

**`app/controllers/break_escape/games_controller.rb`:**

```ruby
module BreakEscape
  class GamesController < ApplicationController
    before_action :set_game_instance, only: [:show, :bootstrap]
    
    def index
      @scenarios = Scenario.published
    end
    
    def show
      authorize @game_instance
      # Main game view - renders the Phaser game
    end
    
    def create
      @scenario = Scenario.find(params[:scenario_id])
      @game_instance = GameInstance.find_or_initialize_by(
        user: current_user,
        scenario: @scenario
      )
      
      if @game_instance.new_record?
        @game_instance.save!
        @game_instance.start!
      end
      
      redirect_to game_path(@game_instance)
    end
    
    def bootstrap
      authorize @game_instance
      
      # Return minimal data to start the game
      render json: {
        startRoom: @game_instance.scenario.start_room,
        scenarioName: @game_instance.scenario.name,
        scenarioBrief: @game_instance.scenario.brief,
        playerState: {
          currentRoom: @game_instance.player_state.room_id,
          position: {
            x: @game_instance.player_state.position_x,
            y: @game_instance.player_state.position_y
          },
          unlockedRooms: @game_instance.player_state.unlocked_rooms
        },
        inventory: @game_instance.inventory_items.map do |item|
          {
            type: item.object_type,
            name: item.name
          }
        end
      }
    end
    
    private
    
    def set_game_instance
      @game_instance = GameInstance.find(params[:id])
    end
  end
end
```

**`app/controllers/break_escape/api/rooms_controller.rb`:**

```ruby
module BreakEscape
  module Api
    class RoomsController < ApplicationController
      skip_forgery_protection # API endpoint
      before_action :set_game_instance
      before_action :set_room
      
      def show
        authorize @game_instance
        
        # Check if player has access to this room
        unless @game_instance.room_accessible?(@room.room_id)
          render json: { error: 'Room not unlocked' }, status: :forbidden
          return
        end
        
        # Return room data
        render json: RoomSerializer.new(@room, @game_instance).as_json
      end
      
      private
      
      def set_game_instance
        @game_instance = GameInstance.find(params[:game_instance_id])
      end
      
      def set_room
        @room = @game_instance.scenario.rooms.find_by!(room_id: params[:id])
      end
    end
  end
end
```

**`app/controllers/break_escape/api/unlock_controller.rb`:**

```ruby
module BreakEscape
  module Api
    class UnlockController < ApplicationController
      skip_forgery_protection
      before_action :set_game_instance
      
      def create
        authorize @game_instance
        
        target_type = params[:target_type] # 'door' or 'object'
        target_id = params[:target_id]
        attempt = params[:attempt]
        method = params[:method] # key, pin, password, lockpick, biometric, bluetooth
        
        result = UnlockValidator.new(@game_instance, target_type, target_id, attempt, method).validate
        
        if result[:success]
          # Unlock was successful
          case target_type
          when 'door'
            room = @game_instance.scenario.rooms.find_by!(room_id: target_id)
            @game_instance.player_state.unlock_room!(target_id)
            
            render json: {
              success: true,
              message: 'Door unlocked',
              roomId: target_id,
              roomData: RoomSerializer.new(room, @game_instance).as_json
            }
            
          when 'object'
            object = RoomObject.find_by!(object_id: target_id)
            @game_instance.player_state.unlock_object!(target_id)
            
            response = {
              success: true,
              message: 'Object unlocked'
            }
            
            # If object is a container, return contents
            if object.container?
              response[:contents] = object.contents
            end
            
            render json: response
          end
        else
          render json: {
            success: false,
            message: result[:message] || 'Unlock failed'
          }, status: :unprocessable_entity
        end
      end
      
      private
      
      def set_game_instance
        @game_instance = GameInstance.find(params[:game_instance_id])
      end
    end
  end
end
```

**`app/controllers/break_escape/api/inventory_controller.rb`:**

```ruby
module BreakEscape
  module Api
    class InventoryController < ApplicationController
      skip_forgery_protection
      before_action :set_game_instance
      
      def index
        authorize @game_instance
        
        render json: @game_instance.inventory_items.map { |item|
          {
            id: item.id,
            type: item.object_type,
            name: item.name,
            acquiredAt: item.acquired_at
          }
        }
      end
      
      def create
        authorize @game_instance
        
        # Validate that player can actually acquire this item
        # (e.g., they're in the right room, item exists, not already taken)
        
        item = @game_instance.add_to_inventory(
          type: params[:item][:type],
          name: params[:item][:name],
          source_room: params[:item][:source_room],
          source_object: params[:item][:source_object]
        )
        
        render json: { success: true, itemId: item.id }, status: :created
      end
      
      def use
        authorize @game_instance
        
        item = @game_instance.inventory_items.find(params[:item_id])
        target_id = params[:target_id]
        
        # Validate item use
        # (e.g., using key on door, using lockpick on lock)
        
        result = ItemUseValidator.new(@game_instance, item, target_id).validate
        
        render json: result
      end
      
      private
      
      def set_game_instance
        @game_instance = GameInstance.find(params[:game_instance_id])
      end
    end
  end
end
```

---

## Phase 6: Policies (Pundit)

**`app/policies/break_escape/game_instance_policy.rb`:**

```ruby
module BreakEscape
  class GameInstancePolicy < ApplicationPolicy
    def show?
      record.user_id == user.id
    end
    
    def create?
      true # Any authenticated user can create games
    end
    
    def bootstrap?
      show?
    end
    
    class Scope < Scope
      def resolve
        scope.where(user: user)
      end
    end
  end
end
```

**`app/policies/break_escape/api/base_policy.rb`:**

```ruby
module BreakEscape
  module Api
    class BasePolicy < ApplicationPolicy
      # All API actions require user to own the game instance
      def create?
        record.user_id == user.id
      end
      
      def show?
        record.user_id == user.id
      end
      
      def update?
        record.user_id == user.id
      end
      
      def destroy?
        record.user_id == user.id
      end
    end
  end
end
```

---

## Phase 7: Routes

**`config/routes.rb`:**

```ruby
BreakEscape::Engine.routes.draw do
  root to: 'games#index'
  
  # Game management
  resources :games, only: [:index, :show, :create] do
    member do
      get :bootstrap
    end
    
    # API endpoints for game interactions
    namespace :api do
      resources :rooms, only: [:show]
      resources :containers, only: [:show] do
        member do
          post :take
        end
      end
      
      resource :inventory, only: [:create] do
        collection do
          get :index
          post :use
        end
      end
      
      resources :npcs, only: [:index] do
        member do
          get :story
          post :message
          post :validate_action
          post :sync_history
        end
      end
      
      post 'unlock/:target_type/:target_id', to: 'unlock#create', as: :unlock
    end
  end
  
  # Scenario browser
  resources :scenarios, only: [:index, :show]
end
```

---

## Phase 8: Mounting in Host App

### Step 8.1: Install Engine in Hacktivity

**In Hacktivity's `Gemfile`:**

```ruby
# BreakEscape game engine
gem 'break_escape', path: '../break_escape'
# Or from git:
# gem 'break_escape', git: 'https://github.com/yourorg/break_escape'
```

**Run:**

```bash
cd /path/to/hacktivity
bundle install
```

### Step 8.2: Mount Engine

**In Hacktivity's `config/routes.rb`:**

```ruby
Rails.application.routes.draw do
  devise_for :users
  
  # ... other routes ...
  
  # Mount BreakEscape engine
  mount BreakEscape::Engine, at: '/break_escape'
  
  # Engine is now available at:
  # http://localhost:3000/break_escape
end
```

### Step 8.3: Run Migrations

```bash
cd /path/to/hacktivity

# Copy engine migrations to host app
rails break_escape:install:migrations

# Run migrations
rails db:migrate
```

### Step 8.4: Configure Shared User Model

**In Hacktivity's `config/initializers/break_escape.rb`:**

```ruby
# Configure BreakEscape to use Hacktivity's User model
BreakEscape.configure do |config|
  config.user_class = 'User'
  config.current_user_method = :current_user
end
```

**In Engine's `lib/break_escape.rb`:**

```ruby
module BreakEscape
  mattr_accessor :user_class
  mattr_accessor :current_user_method
  
  def self.configure
    yield self
  end
  
  def self.user_class_name
    user_class || 'BreakEscape::User'
  end
end
```

---

## Phase 9: Data Import

### Step 9.1: Create Import Rake Tasks

**`lib/tasks/break_escape_tasks.rake`:**

```ruby
namespace :break_escape do
  desc "Import scenario from JSON file"
  task :import_scenario, [:file] => :environment do |t, args|
    require 'json'
    
    json_file = args[:file] || Rails.root.join('db', 'scenario_seeds', 'ceo_exfil.json')
    json = JSON.parse(File.read(json_file))
    
    scenario_name = File.basename(json_file, '.json').titleize
    
    BreakEscape::Scenario.transaction do
      # Create scenario
      scenario = BreakEscape::Scenario.create!(
        name: scenario_name,
        description: json['scenario_brief'],
        brief: json['scenario_brief'],
        start_room: json['startRoom'],
        published: true
      )
      
      puts "Created scenario: #{scenario.name}"
      
      # Import NPCs
      json['npcs']&.each do |npc_data|
        ink_script = nil
        
        if npc_data['storyPath']
          ink_path = Rails.root.join('db', 'scenario_seeds', npc_data['storyPath'])
          if File.exist?(ink_path)
            ink_script = File.read(ink_path)
          end
        end
        
        npc = scenario.npcs.create!(
          npc_id: npc_data['id'],
          display_name: npc_data['displayName'],
          avatar_url: npc_data['avatar'],
          phone_id: npc_data['phoneId'],
          npc_type: npc_data['npcType'] || 'phone',
          ink_script: ink_script,
          event_mappings: npc_data['eventMappings'] || [],
          timed_messages: npc_data['timedMessages'] || []
        )
        
        puts "  Created NPC: #{npc.display_name}"
      end
      
      # Import rooms
      json['rooms'].each do |room_id, room_data|
        room = scenario.rooms.create!(
          room_id: room_id,
          room_type: room_data['type'],
          connections: room_data['connections'] || {},
          locked: room_data['locked'] || false,
          lock_type: room_data['lockType'],
          lock_requirement: room_data['requires']&.to_s,
          key_pins: room_data['keyPins'],
          difficulty: room_data['difficulty']
        )
        
        puts "  Created room: #{room_id}"
        
        # Import objects
        room_data['objects']&.each do |obj_data|
          # Remove lock requirement from properties (stored separately)
          properties = obj_data.except('locked', 'lockType', 'requires', 'type', 'name', 'takeable', 'readable', 'observations')
          
          room.room_objects.create!(
            object_id: "#{room_id}_#{obj_data['type']}_#{SecureRandom.hex(4)}",
            object_type: obj_data['type'],
            name: obj_data['name'],
            takeable: obj_data['takeable'] || false,
            readable: obj_data['readable'] || false,
            locked: obj_data['locked'] || false,
            lock_type: obj_data['lockType'],
            lock_requirement: obj_data['requires']&.to_s,
            observations: obj_data['observations'],
            properties: properties
          )
        end
      end
      
      puts "Scenario import complete!"
    end
  end
  
  desc "Import all scenarios from db/scenario_seeds"
  task :import_all_scenarios => :environment do
    scenario_dir = Rails.root.join('db', 'scenario_seeds')
    
    Dir.glob(scenario_dir.join('*.json')).each do |file|
      puts "\nImporting: #{file}"
      Rake::Task['break_escape:import_scenario'].execute(file: file)
    end
  end
end
```

**Run import:**

```bash
cd break_escape

# Import single scenario
rails break_escape:import_scenario['db/scenario_seeds/ceo_exfil.json']

# Import all scenarios
rails break_escape:import_all_scenarios
```

---

## Phase 10: Views

**`app/views/break_escape/layouts/application.html.erb`:**

```erb
<!DOCTYPE html>
<html>
<head>
  <title>BreakEscape</title>
  <%= csrf_meta_tags %>
  <%= csp_meta_tag %>

  <%= stylesheet_link_tag "break_escape/application", media: "all" %>
  <%= javascript_include_tag "break_escape/application" %>
</head>

<body>
  <% if notice %>
    <div class="alert alert-info"><%= notice %></div>
  <% end %>
  <% if alert %>
    <div class="alert alert-danger"><%= alert %></div>
  <% end %>

  <%= yield %>
</body>
</html>
```

**`app/views/break_escape/games/index.html.erb`:**

```erb
<div class="scenario-selector">
  <h1>Choose Your Mission</h1>
  
  <div class="scenarios-grid">
    <% @scenarios.each do |scenario| %>
      <div class="scenario-card">
        <h2><%= scenario.name %></h2>
        <p><%= scenario.brief %></p>
        
        <div class="scenario-meta">
          <span class="difficulty"><%= scenario.difficulty %></span>
          <span class="time"><%= scenario.estimated_time %> min</span>
        </div>
        
        <%= form_with url: games_path, method: :post do |f| %>
          <%= f.hidden_field :scenario_id, value: scenario.id %>
          <%= f.submit "Start Mission", class: "btn btn-primary" %>
        <% end %>
      </div>
    <% end %>
  </div>
</div>
```

**`app/views/break_escape/games/show.html.erb`:**

```erb
<div id="game-container">
  <!-- Phaser game will mount here -->
</div>

<script>
  // Initialize game with engine data
  window.gameInstanceId = <%= @game_instance.id %>;
  window.apiBasePath = '<%= api_games_path(@game_instance) %>';
  
  // Bootstrap game data
  fetch('<%= bootstrap_game_path(@game_instance) %>', {
    headers: {
      'Authorization': 'Bearer <%= session[:auth_token] %>',
      'Accept': 'application/json'
    }
  })
  .then(response => response.json())
  .then(data => {
    // Initialize Phaser game with server data
    window.initializeBreakEscape(data);
  })
  .catch(error => {
    console.error('Failed to bootstrap game:', error);
    alert('Failed to load game data. Please refresh the page.');
  });
</script>

<style>
  #game-container {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }
</style>
```

---

## Phase 11: Testing

### Step 11.1: Setup Test Environment

**`test/test_helper.rb`:**

```ruby
# Configure Rails Environment
ENV["RAILS_ENV"] = "test"

require_relative "../test/dummy/config/environment"
require "rails/test_help"
require "minitest/reporters"

Minitest::Reporters.use!

module BreakEscape
  class TestCase < ActiveSupport::TestCase
    fixtures :all
    
    def setup
      @user = users(:player_one)
      @scenario = break_escape_scenarios(:ceo_exfil)
    end
  end
end
```

### Step 11.2: Model Tests

**`test/models/break_escape/game_instance_test.rb`:**

```ruby
require 'test_helper'

module BreakEscape
  class GameInstanceTest < TestCase
    test "should create game instance" do
      game = GameInstance.create!(
        user: @user,
        scenario: @scenario
      )
      
      assert game.persisted?
      assert_equal 'not_started', game.state
    end
    
    test "should initialize player state on creation" do
      game = GameInstance.create!(user: @user, scenario: @scenario)
      
      assert game.player_state.present?
      assert_equal @scenario.start_room, game.player_state.room_id
    end
    
    test "should start game" do
      game = GameInstance.create!(user: @user, scenario: @scenario)
      game.start!
      
      assert_equal 'in_progress', game.state
      assert game.started_at.present?
    end
  end
end
```

### Step 11.3: Controller Tests

**`test/controllers/break_escape/api/rooms_controller_test.rb`:**

```ruby
require 'test_helper'

module BreakEscape
  module Api
    class RoomsControllerTest < ActionDispatch::IntegrationTest
      setup do
        @user = users(:player_one)
        @game_instance = break_escape_game_instances(:active_game)
        @room = break_escape_rooms(:reception)
        
        sign_in @user
      end
      
      test "should get room data when unlocked" do
        @game_instance.player_state.unlock_room!(@room.room_id)
        
        get api_game_room_url(@game_instance, @room.room_id)
        
        assert_response :success
        json = JSON.parse(response.body)
        assert_equal @room.room_type, json['type']
      end
      
      test "should deny access to locked room" do
        locked_room = break_escape_rooms(:ceo_office)
        
        get api_game_room_url(@game_instance, locked_room.room_id)
        
        assert_response :forbidden
      end
    end
  end
end
```

### Step 11.4: Integration Tests

**`test/integration/game_flow_test.rb`:**

```ruby
require 'test_helper'

module BreakEscape
  class GameFlowTest < ActionDispatch::IntegrationTest
    test "complete game flow" do
      user = users(:player_one)
      scenario = break_escape_scenarios(:ceo_exfil)
      
      sign_in user
      
      # Create game
      post games_url, params: { scenario_id: scenario.id }
      assert_response :redirect
      
      game = GameInstance.last
      assert_equal user, game.user
      assert_equal 'in_progress', game.state
      
      # Access starting room
      get api_game_room_url(game, scenario.start_room)
      assert_response :success
      
      # Try to access locked room (should fail)
      locked_room = scenario.rooms.find_by(locked: true)
      get api_game_room_url(game, locked_room.room_id)
      assert_response :forbidden
      
      # Unlock room
      post api_game_unlock_url(game, 'door', locked_room.room_id), 
           params: { attempt: locked_room.lock_requirement, method: 'pin' }
      assert_response :success
      
      # Access newly unlocked room
      get api_game_room_url(game, locked_room.room_id)
      assert_response :success
    end
  end
end
```

---

## Phase 12: Deployment Checklist

### Step 12.1: Production Configuration

**In `config/environments/production.rb`:**

```ruby
BreakEscape::Engine.configure do
  config.cache_classes = true
  config.eager_load = true
  
  # Asset compilation
  config.assets.compile = false
  config.assets.digest = true
  
  # Serve assets from CDN if available
  # config.asset_host = 'https://cdn.example.com'
end
```

### Step 12.2: Asset Precompilation

```bash
# In host app (Hacktivity)
cd /path/to/hacktivity

# Precompile all assets including engine assets
RAILS_ENV=production rails assets:precompile

# Verify engine assets are included
ls public/assets/break_escape/
```

### Step 12.3: Database Setup

```bash
# In production
RAILS_ENV=production rails db:migrate
RAILS_ENV=production rails break_escape:import_all_scenarios
```

---

## Complete Migration Timeline

### Week 1-2: Setup & Structure
- [ ] Create Rails engine skeleton
- [ ] Configure engine (routes, assets, etc.)
- [ ] Create database migrations
- [ ] Setup test framework

### Week 3-4: Asset Migration
- [ ] Move JavaScript files to engine
- [ ] Move CSS files to engine
- [ ] Move images/sounds to engine
- [ ] Configure asset pipeline
- [ ] Test asset loading

### Week 5-6: Models & Business Logic
- [ ] Create all models
- [ ] Implement business logic
- [ ] Write model tests
- [ ] Create serializers

### Week 7-8: Controllers & API
- [ ] Create game controllers
- [ ] Create API controllers
- [ ] Implement unlock validation
- [ ] Implement inventory system
- [ ] Write controller tests

### Week 9-10: NPC System
- [ ] Implement NPC models
- [ ] Create NPC API endpoints
- [ ] Integrate ink engine (choose approach)
- [ ] Test NPC interactions

### Week 11-12: Views & UI
- [ ] Create game launcher views
- [ ] Create scenario selector
- [ ] Create main game view
- [ ] Style UI components

### Week 13-14: Integration & Testing
- [ ] Mount engine in Hacktivity
- [ ] Test user authentication integration
- [ ] Write integration tests
- [ ] Performance testing

### Week 15-16: Data Migration
- [ ] Import all scenarios
- [ ] Import all NPCs
- [ ] Verify data integrity
- [ ] Seed demo accounts

### Week 17-18: Polish & Deploy
- [ ] Fix bugs
- [ ] Optimize performance
- [ ] Security audit
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

**Total Time: 18-20 weeks (4-5 months)**

---

## Conclusion

This comprehensive plan provides:
1. ✅ Clear Rails Engine structure
2. ✅ Database schema for all game data
3. ✅ API endpoints for client-server communication
4. ✅ Migration strategy from standalone to engine
5. ✅ Integration with Hacktivity (Devise users)
6. ✅ Test coverage at all levels
7. ✅ Deployment checklist

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 (create engine skeleton)
3. Follow phases sequentially
4. Test thoroughly at each stage

The architecture supports both standalone operation and mounting in host applications, making it flexible and maintainable.




