import { initializeRooms, validateDoorsByRoomOverlap, calculateWorldBounds, calculateRoomPositions, createRoom, revealRoom, updatePlayerRoom, rooms } from './rooms.js?v=16';
import { createPlayer, updatePlayerMovement, movePlayerToPoint, player } from './player.js?v=7';
import { initializePathfinder } from './pathfinding.js?v=7';
import { initializeInventory, processInitialInventoryItems } from '../systems/inventory.js?v=8';
import { checkObjectInteractions, processAllDoorCollisions, setGameInstance, setupDoorOverlapChecks } from '../systems/interactions.js?v=23';
import { introduceScenario } from '../utils/helpers.js?v=19';
import '../minigames/index.js?v=2';

// Global variables that will be set by main.js
let gameScenario;

// Preload function - loads all game assets
export function preload() {
    // Show loading text
    document.getElementById('loading').style.display = 'block';

    // Load tilemap files and regular tilesets first
    this.load.tilemapTiledJSON('room_reception', 'assets/rooms/room_reception.json');
    this.load.tilemapTiledJSON('room_office', 'assets/rooms/room_office.json');
    this.load.tilemapTiledJSON('room_ceo', 'assets/rooms/room_ceo.json');
    this.load.tilemapTiledJSON('room_closet', 'assets/rooms/room_closet.json');
    this.load.tilemapTiledJSON('room_servers', 'assets/rooms/room_servers.json');

    // Load room images
    this.load.image('room_reception_l', 'assets/rooms/room_reception_l.png');
    this.load.image('room_office_l', 'assets/rooms/room_office_l.png');
    this.load.image('room_server_l', 'assets/rooms/room_server_l.png');
    this.load.image('room_ceo_l', 'assets/rooms/room_ceo_l.png');
    this.load.image('room_spooky_basement_l', 'assets/rooms/room_spooky_basement_l.png');
    this.load.image('door', 'assets/tiles/door.png');

    // Load object sprites
    this.load.image('pc', 'assets/objects/pc.png');
    this.load.image('key', 'assets/objects/key.png');
    this.load.image('notes', 'assets/objects/notes.png');
    this.load.image('phone', 'assets/objects/phone.png');
    this.load.image('suitcase', 'assets/objects/suitcase.png');
    this.load.image('smartscreen', 'assets/objects/smartscreen.png');
    this.load.image('photo', 'assets/objects/photo.png');
    this.load.image('safe', 'assets/objects/safe.png');
    this.load.image('book', 'assets/objects/book.png');
    this.load.image('workstation', 'assets/objects/workstation.png');
    this.load.image('bluetooth_scanner', 'assets/objects/bluetooth_scanner.png');
    this.load.image('tablet', 'assets/objects/tablet.png');
    this.load.image('fingerprint_kit', 'assets/objects/fingerprint_kit.png');
    this.load.image('lockpick', 'assets/objects/lockpick.png');
    this.load.image('spoofing_kit', 'assets/objects/spoofing_kit.png');

    // Load character sprite sheet instead of single image
            this.load.spritesheet('hacker', 'assets/characters/hacker.png', {
            frameWidth: 64,
            frameHeight: 64
        });

    // Get scenario from URL parameter or use default
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioFile = urlParams.get('scenario') || 'scenarios/ceo_exfil.json';
    
    // Load the specified scenario
    this.load.json('gameScenarioJSON', scenarioFile);
}

// Create function - sets up the game world and initializes all systems
export function create() {
    // Hide loading text
    document.getElementById('loading').style.display = 'none';

    // Set game instance for interactions module early
    setGameInstance(this);

    // Ensure gameScenario is loaded before proceeding
    if (!window.gameScenario) {
        window.gameScenario = this.cache.json.get('gameScenarioJSON');
    }
    gameScenario = window.gameScenario;

    // Calculate world bounds after scenario is loaded
    const worldBounds = calculateWorldBounds(this);
    
    // Set the physics world bounds
    this.physics.world.setBounds(
        worldBounds.x, 
        worldBounds.y, 
        worldBounds.width, 
        worldBounds.height
    );

    // Create player first like in original
    createPlayer(this);
    
    // Store player globally for access from other modules
    window.player = player;
    
    // Initialize rooms system after player exists
    initializeRooms(this);
    
    // Calculate room positions
    const roomPositions = calculateRoomPositions(this);
    
    // Create all rooms
    Object.entries(gameScenario.rooms).forEach(([roomId, roomData]) => {
        const position = roomPositions[roomId];
        if (position) {
            createRoom(roomId, roomData, position);
        }
    });
    
    // Validate doors by checking room overlaps
    validateDoorsByRoomOverlap();
    
    // Reveal starting room early like in original  
    revealRoom(gameScenario.startRoom);
    
    // Position player in the starting room
    const startingRoom = rooms[gameScenario.startRoom];
    if (startingRoom) {
        const roomCenterX = startingRoom.position.x + 400; // Room width / 2
        const roomCenterY = startingRoom.position.y + 300; // Room height / 2
        player.setPosition(roomCenterX, roomCenterY);
        console.log(`Player positioned at (${roomCenterX}, ${roomCenterY}) in starting room ${gameScenario.startRoom}`);
    }
    
    // Set up camera to follow player
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1);
    
    // Process door collisions after rooms are revealed
    processAllDoorCollisions();
    
    // Setup door overlap checks
    setupDoorOverlapChecks();
    
    // Initialize pathfinder
    initializePathfinder(this);
    
    // Set up input handling
    this.input.on('pointerdown', (pointer) => {
        // Convert screen coordinates to world coordinates
        const worldX = this.cameras.main.scrollX + pointer.x;
        const worldY = this.cameras.main.scrollY + pointer.y;
        
        movePlayerToPoint(worldX, worldY);
    });
    
    // Initialize inventory
    initializeInventory();
    
    // Process initial inventory items
    processInitialInventoryItems();
    
    // Show introduction
    introduceScenario();
    
    // Store game reference globally
    window.game = this;
}

// Update function - main game loop
export function update() {
    // Safety check: ensure player exists before running updates
    if (!window.player) {
        return;
    }
    
    // Update player movement
    updatePlayerMovement();
    
    // Update player room (check for room transitions)
    updatePlayerRoom();
    
    // Check for object interactions
    checkObjectInteractions.call(this);
    
    // Check for Bluetooth devices
    const currentTime = Date.now();
    if (currentTime - lastBluetoothScan >= 2000) { // 2 second interval
        if (window.checkBluetoothDevices) {
            window.checkBluetoothDevices();
        }
        lastBluetoothScan = currentTime;
    }
}

// Add timing variables at module level
let lastBluetoothScan = 0;

// Helper functions

// Hide a room
function hideRoom(roomId) {
    if (window.rooms[roomId]) {
        const room = window.rooms[roomId];
        
        // Hide all layers
        Object.values(room.layers).forEach(layer => {
            if (layer && layer.setVisible) {
                layer.setVisible(false);
                layer.setAlpha(0);
            }
        });

        // Hide all objects (both active and inactive)
        if (room.objects) {
            Object.values(room.objects).forEach(obj => {
                if (obj && obj.setVisible) {
                    obj.setVisible(false);
                }
            });
        }
    }
}

 