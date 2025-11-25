require 'test_helper'

module BreakEscape
  class GamesControllerTest < ActionDispatch::IntegrationTest
    include Engine.routes.url_helpers

    setup do
      @mission = break_escape_missions(:ceo_exfil)
      @player = break_escape_demo_users(:test_user)
      @game = Game.create!(
        mission: @mission,
        player: @player,
        scenario_data: {
          "startRoom" => "reception",
          "startItemsInInventory" => [
            {
              "type" => "lockpick",
              "name" => "Lockpick",
              "id" => "lockpick_1",
              "takeable" => true
            }
          ],
          "rooms" => {
            "reception" => {
              "type" => "room_reception",
              "connections" => { "north" => "office" },
              "locked" => false,
              "objects" => []
            },
            "office" => {
              "type" => "office",
              "connections" => { "south" => "reception" },
              "locked" => true,
              "lockType" => "pin",
              "requires" => "1234",
              "objects" => []
            }
          }
        },
        player_state: {
          "currentRoom" => "reception",
          "unlockedRooms" => ["reception"],
          "unlockedObjects" => [],
          "inventory" => [],
          "encounteredNPCs" => [],
          "globalVariables" => {},
          "biometricSamples" => [],
          "biometricUnlocks" => [],
          "bluetoothDevices" => [],
          "notes" => [],
          "health" => 100
        }
      )
    end

    test "should show game" do
      get game_url(@game)
      assert_response :success
    end

    test "show should return HTML with game container" do
      get game_url(@game)
      assert_response :success
      assert_select '#game-container'
      assert_match /window\.breakEscapeConfig/, response.body
    end

    test "show should inject game configuration" do
      get game_url(@game)
      assert_response :success

      # Check that config is in the page
      assert_match /gameId.*#{@game.id}/, response.body
      assert_match /apiBasePath/, response.body
      assert_match /csrfToken/, response.body
    end

    test "scenario endpoint should return JSON" do
      get scenario_game_url(@game)
      assert_response :success
      assert_equal 'application/json', @response.media_type

      json = JSON.parse(@response.body)
      assert json['startRoom']
      assert json['rooms']
    end

    test "sync_state should update player state for current room" do
      put sync_state_game_url(@game), params: {
        currentRoom: 'reception'
      }

      assert_response :success
      json = JSON.parse(@response.body)
      assert json['success']

      @game.reload
      assert_equal 'reception', @game.player_state['currentRoom']
    end

    test "unlock endpoint should reject invalid attempts" do
      post unlock_game_url(@game), params: {
        targetType: 'room',
        targetId: 'office',
        attempt: 'wrong_code',
        method: 'pin'
      }

      assert_response :unprocessable_entity
      json = JSON.parse(@response.body)
      assert_equal false, json['success']
      assert_equal 'Invalid attempt', json['message']
    end

    test "game setup has correct scenario data" do
      # Verify the test setup is correct before running unlock tests
      assert @game.scenario_data['rooms']['office'].present?
      office = @game.scenario_data['rooms']['office']
      assert_equal true, office['locked']
      assert_equal 'pin', office['lockType']
      assert_equal '1234', office['requires']
    end

    test "unlock endpoint should accept correct pin code" do
      # Debug: Check scenario before making request
      assert @game.scenario_data['rooms']['office']['requires'] == '1234',
        "Office room should require PIN 1234, but requires: #{@game.scenario_data['rooms']['office']['requires']}"

      post unlock_game_url(@game), params: {
        targetType: 'door',
        targetId: 'office',
        attempt: '1234',
        method: 'pin'
      }

      assert_response :success,
        "Expected 200, got #{@response.status}. Response: #{response.body}"
      json = JSON.parse(@response.body)
      assert json['success'], "Response success should be true: #{json}"
      assert_equal 'door', json['type']
      assert json['roomData']

      @game.reload
      assert_includes @game.player_state['unlockedRooms'], 'office'
    end

    test "inventory endpoint should add items" do
      # Create a test scenario that doesn't include the lockpick in starting items
      @game.scenario_data['startItemsInInventory'] = []
      @game.scenario_data['rooms']['reception']['objects'] = [
        {
          "id" => "note_1",
          "type" => "note",
          "name" => "Test Note",
          "takeable" => true
        }
      ]
      @game.player_state['inventory'] = []
      @game.save!

      post inventory_game_url(@game), params: {
        action_type: 'add',
        item: { type: 'note', name: 'Test Note', id: 'note_1' }
      }

      assert_response :success
      json = JSON.parse(@response.body)
      assert json['success']
      assert_equal 1, json['inventory'].length

      @game.reload
      assert_equal 1, @game.player_state['inventory'].length
    end

    # Ink endpoint tests
    test "ink endpoint should require npc parameter" do
      get ink_game_url(@game)
      assert_response :bad_request
      json = JSON.parse(response.body)
      assert_includes json['error'], 'npc'
    end

    test "ink endpoint should return 404 for non-existent NPC" do
      get ink_game_url(@game), params: { npc: 'non-existent' }
      assert_response :not_found
    end

    test "ink endpoint should return 404 for NPC without story file" do
      # Game doesn't have NPCs with story files by default
      get ink_game_url(@game), params: { npc: 'missing-npc' }
      assert_response :not_found
    end
  end
end
