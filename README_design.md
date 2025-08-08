# BreakEscape Game Design Documentation

This document provides a comprehensive overview of the BreakEscape codebase architecture, file organization, and component systems. It serves as a guide for developers who want to understand, modify, or extend the game.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Layout](#file-layout)
3. [Core Components](#core-components)
4. [Game Systems](#game-systems)
5. [Asset Organization](#asset-organization)
6. [Implementing New Mini-Games](#implementing-new-mini-games)
7. [CSS Architecture](#css-architecture)
8. [Development Workflow](#development-workflow)

## Architecture Overview

BreakEscape is built using modern web technologies with a modular architecture:

- **Game Engine**: Phaser.js 3.x for 2D game rendering and physics
- **Module System**: ES6 modules with explicit imports/exports
- **Architecture Pattern**: Component-based with clear separation of concerns
- **Asset Loading**: JSON-based scenario configuration with dynamic asset loading
- **UI Framework**: Custom HTML/CSS overlay system integrated with game canvas

### Key Design Principles

1. **Modularity**: Each system is self-contained with clear interfaces
2. **Extensibility**: New mini-games, rooms, and scenarios can be added easily
3. **Maintainability**: Clean separation between game logic, UI, and data
4. **Performance**: Efficient asset loading and memory management

## File Layout

```
BreakEscape/
├── index.html              # Main game entry point
├── index_new.html          # Updated main entry point with modern UI
├── scenario_select.html    # Scenario selection interface
├── 
├── css/                    # Styling and UI components
│   ├── main.css           # Core game styles
│   ├── panels.css         # Side panel layouts
│   ├── modals.css         # Modal dialog styles
│   ├── inventory.css      # Inventory system styles
│   ├── minigames.css      # Mini-game UI styles
│   ├── notifications.css  # Notification system styles
│   └── utilities.css      # Utility classes and helpers
│
├── js/                     # JavaScript source code
│   ├── main.js            # Application entry point, init, and game state variables
│   │
│   ├── core/              # Core game engine components
│   │   ├── game.js        # Main game scene (preload, create, update)
│   │   ├── player.js      # Player character logic and movement
│   │   ├── rooms.js       # Room management and layout system
│   │   └── pathfinding.js # A* pathfinding for player movement
│   │
│   ├── systems/           # Game systems and mechanics
│   │   ├── inventory.js   # Inventory management
│   │   ├── interactions.js # Object interaction and collision detection
│   │   ├── notifications.js # In-game notification system
│   │   ├── notes.js       # Notes panel for clues and information
│   │   ├── biometrics.js  # Fingerprint collection and matching
│   │   ├── bluetooth.js   # Bluetooth device scanning
│   │   └── debug.js       # Debug tools and development helpers
│   │
│   ├── ui/                # User interface components
│   │   ├── panels.js      # Side panels (biometrics, bluetooth, notes)
│   │   └── modals.js      # Modal dialogs and popup windows
│   │
│   ├── utils/             # Utility functions and helpers
│   │   ├── constants.js   # Game configuration and constants
│   │   ├── helpers.js     # General utility functions
│   │   └── crypto-workstation.js # CyberChef integration
│   │
│   └── minigames/         # Mini-game framework and implementations
│       ├── index.js       # Mini-game registry and exports
│       ├── framework/     # Mini-game framework
│       │   ├── base-minigame.js    # Base class for all mini-games
│       │   └── minigame-manager.js # Mini-game lifecycle management
│       ├── lockpicking/   # Lockpicking mini-game
│       │   └── lockpicking-game.js
│       └── dusting/       # Fingerprint dusting mini-game
│           └── dusting-game.js
│
├── assets/                 # Game assets and resources
│   ├── characters/        # Character sprites and animations
│   ├── objects/           # Interactive object sprites
│   ├── rooms/             # Room layouts and images
│   ├── scenarios/         # Scenario configuration files
│   ├── sounds/            # Audio files (sound effects)
│   └── tiles/             # Tileset graphics
│
└── scenarios/             # JSON scenario definitions
    ├── ceo_exfil.json     # CEO data exfiltration scenario
    ├── biometric_breach.json # Biometric security breach scenario
    └── scenario[1-4].json # Additional numbered scenarios
```

## Core Components

### 1. Game Engine (`js/core/`)

#### game.js
- **Purpose**: Main Phaser scene with preload, create, and update lifecycle
- **Key Functions**:
  - `preload()`: Loads all game assets (sprites, maps, scenarios)
  - `create()`: Initializes game world, player, rooms, and systems
  - `update()`: Main game loop for movement, interactions, and system updates
- **Dependencies**: All core systems and utilities

#### player.js
- **Purpose**: Player character movement, animation, and state management
- **Key Features**:
  - Click-to-move with pathfinding integration
  - Sprite animation for movement directions
  - Room transition detection
  - Position tracking and state management

#### rooms.js
- **Purpose**: Room layout calculation, creation, and management
- **Key Features**:
  - Dynamic room positioning based on JSON connections
  - Room revelation system (fog of war)
  - Door validation and collision detection
  - Multi-room layout algorithms for complex scenarios

#### pathfinding.js
- **Purpose**: A* pathfinding implementation for intelligent player movement
- **Key Features**:
  - Obstacle avoidance
  - Efficient path calculation
  - Path smoothing and optimization

### 2. Game Systems (`js/systems/`)

#### inventory.js
- **Purpose**: Item collection, storage, and usage management
- **Key Features**:
  - Drag-and-drop item interaction
  - Item usage on objects and locks
  - Visual inventory display with item icons

#### interactions.js
- **Purpose**: Object interaction detection and processing
- **Key Features**:
  - Click detection on game objects
  - Lock validation and unlocking logic
  - Object state management (opened, unlocked, etc.)
  - Container object support (safes, suitcases)

#### biometrics.js
- **Purpose**: Fingerprint collection, analysis, and matching
- **Key Features**:
  - Fingerprint collection from objects
  - Quality-based matching algorithms
  - Biometric panel UI integration

#### bluetooth.js
- **Purpose**: Bluetooth device simulation and scanning
- **Key Features**:
  - Device discovery based on player proximity
  - MAC address tracking
  - Bluetooth panel UI integration

### 3. UI Framework (`js/ui/`)

#### panels.js
- **Purpose**: Side panel management for game information
- **Key Features**:
  - Collapsible panel system
  - Dynamic content updates
  - Panel state persistence

#### modals.js
- **Purpose**: Modal dialog system for important interactions
- **Key Features**:
  - Scenario introductions
  - Item examination
  - System messages and confirmations

## Game Systems

### Scenario System
- **Configuration**: JSON-based scenario definitions
- **Components**: Rooms, objects, locks, and victory conditions
- **Flexibility**: Complete customization without code changes

### Lock System
- **Types**: Key, PIN, password, biometric, Bluetooth proximity
- **Integration**: Works with rooms, objects, and containers
- **Progression**: Supports complex unlocking sequences

### Asset Management
- **Loading**: Dynamic asset loading based on scenario requirements
- **Caching**: Efficient resource management with Phaser's asset cache
- **Organization**: Logical separation by asset type and purpose

## Asset Organization

### Images (`assets/`)
- **characters/**: Player character sprite sheets
- **objects/**: Interactive object sprites (organized by type)
- **rooms/**: Room background images and tiled map data
- **tiles/**: Individual tile graphics for maps

### Data (`assets/` and `scenarios/`)
- **Room Maps**: Tiled JSON format for room layouts
- **Scenarios**: JSON configuration files defining game content
- **Audio**: Sound effects for mini-games and interactions

## Implementing New Mini-Games

BreakEscape uses a flexible mini-game framework that allows developers to create new interactive challenges. Here's a comprehensive guide:

### 1. Framework Overview

The mini-game framework consists of:
- **Base Class**: `MinigameScene` provides common functionality
- **Manager**: `MinigameFramework` handles lifecycle and registration
- **Integration**: Automatic UI overlay and game state management

### 2. Creating a New Mini-Game

#### Step 1: Create the Mini-Game Class

Create a new file: `js/minigames/[minigame-name]/[minigame-name]-game.js`

```javascript
import { MinigameScene } from '../framework/base-minigame.js';

export class MyMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        // Initialize your game-specific state
        this.gameData = {
            score: 0,
            timeLimit: params.timeLimit || 30000, // 30 seconds default
            difficulty: params.difficulty || 'medium'
        };
    }
    
    init() {
        // Call parent init to set up basic UI structure
        super.init();
        
        // Customize the header
        this.headerElement.innerHTML = `
            <h3>${this.params.title || 'My Mini-Game'}</h3>
            <p>Game instructions go here</p>
        `;
        
        // Set up your game-specific UI
        this.setupGameInterface();
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    setupGameInterface() {
        // Create your game's HTML structure
        this.gameContainer.innerHTML = `
            <div class="my-minigame-area">
                <div class="score">Score: <span id="score-display">0</span></div>
                <div class="game-area" id="game-area">
                    <!-- Your game content here -->
                </div>
                <div class="timer">Time: <span id="timer-display">30</span>s</div>
            </div>
        `;
        
        // Get references to important elements
        this.gameArea = document.getElementById('game-area');
        this.scoreDisplay = document.getElementById('score-display');
        this.timerDisplay = document.getElementById('timer-display');
    }
    
    setupEventListeners() {
        // Add your game-specific event listeners using this.addEventListener
        // This ensures proper cleanup when the mini-game ends
        
        this.addEventListener(this.gameArea, 'click', (event) => {
            this.handleGameClick(event);
        });
        
        this.addEventListener(document, 'keydown', (event) => {
            this.handleKeyPress(event);
        });
    }
    
    start() {
        // Call parent start
        super.start();
        
        // Start your game logic
        this.startTimer();
        this.initializeGameContent();
        
        console.log("My mini-game started");
    }
    
    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const remaining = Math.max(0, this.gameData.timeLimit - elapsed);
            const seconds = Math.ceil(remaining / 1000);
            
            this.timerDisplay.textContent = seconds;
            
            if (remaining <= 0) {
                this.timeUp();
            }
        }, 100);
    }
    
    handleGameClick(event) {
        if (!this.gameState.isActive) return;
        
        // Handle clicks in your game area
        // Update score, check win conditions, etc.
        
        this.updateScore(10);
        this.checkWinCondition();
    }
    
    handleKeyPress(event) {
        if (!this.gameState.isActive) return;
        
        // Handle keyboard input if needed
        switch(event.key) {
            case 'Space':
                event.preventDefault();
                // Handle space key
                break;
        }
    }
    
    updateScore(points) {
        this.gameData.score += points;
        this.scoreDisplay.textContent = this.gameData.score;
    }
    
    checkWinCondition() {
        // Check if the player has won
        if (this.gameData.score >= 100) {
            this.gameWon();
        }
    }
    
    gameWon() {
        this.cleanup();
        this.showSuccess("Congratulations! You won!", true, 3000);
        
        // Set game result for the callback
        this.gameResult = {
            success: true,
            score: this.gameData.score,
            timeRemaining: this.gameData.timeLimit - (Date.now() - this.startTime)
        };
    }
    
    timeUp() {
        this.cleanup();
        this.showFailure("Time's up! Try again.", true, 3000);
        
        this.gameResult = {
            success: false,
            score: this.gameData.score,
            reason: 'timeout'
        };
    }
    
    initializeGameContent() {
        // Set up your specific game content
        // This might involve creating DOM elements, starting animations, etc.
    }
    
    cleanup() {
        // Clean up timers and intervals
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Call parent cleanup (handles event listeners)
        super.cleanup();
    }
}
```

#### Step 2: Add Styles

Add CSS to `css/minigames.css`:

```css
/* My Mini-Game Specific Styles */
.my-minigame-area {
    display: flex;
    flex-direction: column;
    height: 400px;
    padding: 20px;
}

.my-minigame-area .score,
.my-minigame-area .timer {
    background: rgba(0, 255, 0, 0.1);
    padding: 10px;
    margin: 5px 0;
    border-radius: 5px;
    text-align: center;
    font-weight: bold;
}

.my-minigame-area .game-area {
    flex: 1;
    background: #1a1a1a;
    border: 2px solid #00ff00;
    border-radius: 10px;
    margin: 10px 0;
    cursor: crosshair;
    position: relative;
    overflow: hidden;
}

/* Add any additional styles your mini-game needs */
```

#### Step 3: Register the Mini-Game

Add your mini-game to `js/minigames/index.js`:

```javascript
// Add this import
export { MyMinigame } from './my-minigame/my-minigame-game.js';

// Add this at the bottom with other registrations
import { MyMinigame } from './my-minigame/my-minigame-game.js';
MinigameFramework.registerScene('my-minigame', MyMinigame);
```

#### Step 4: Integrate with Game Objects

To trigger your mini-game from an object interaction, modify the object in your scenario JSON:

```json
{
    "type": "special_device",
    "name": "Puzzle Device",
    "takeable": false,
    "observations": "A strange device with buttons and lights.",
    "requiresMinigame": "my-minigame",
    "minigameParams": {
        "title": "Decode the Pattern",
        "difficulty": "hard",
        "timeLimit": 45000
    }
}
```

Or trigger it programmatically in the interactions system:

```javascript
// In interactions.js or a custom system
window.MinigameFramework.startMinigame('my-minigame', {
    title: 'My Custom Challenge',
    difficulty: 'medium',
    onComplete: (success, result) => {
        if (success) {
            console.log('Mini-game completed successfully!', result);
            // Unlock something, add item to inventory, etc.
        } else {
            console.log('Mini-game failed', result);
        }
    }
});
```

### 3. Mini-Game Best Practices

#### UI Guidelines
- Use the framework's built-in message system (`showSuccess`, `showFailure`)
- Maintain consistent styling with the game's retro-cyber theme
- Provide clear instructions in the header
- Use progress indicators when appropriate

#### Performance
- Clean up timers and intervals in the `cleanup()` method
- Use `this.addEventListener()` for proper event listener management
- Avoid creating too many DOM elements for complex animations

#### Integration
- Return meaningful results in `this.gameResult` for scenario progression
- Support different difficulty levels through parameters
- Provide visual feedback for player actions

#### Accessibility
- Include keyboard controls when possible
- Use clear visual indicators for interactive elements
- Provide audio feedback through the game's sound system

### 4. Advanced Mini-Game Features

#### Canvas-based Games
For more complex graphics, you can create a canvas within your mini-game:

```javascript
setupGameInterface() {
    this.gameContainer.innerHTML = `
        <canvas id="minigame-canvas" width="600" height="400"></canvas>
    `;
    
    this.canvas = document.getElementById('minigame-canvas');
    this.ctx = this.canvas.getContext('2d');
}
```

#### Animation Integration
Use requestAnimationFrame for smooth animations:

```javascript
start() {
    super.start();
    this.animate();
}

animate() {
    if (!this.gameState.isActive) return;
    
    // Update game state
    this.updateGame();
    
    // Render frame
    this.renderGame();
    
    requestAnimationFrame(() => this.animate());
}
```

#### Sound Integration
Add sound effects using the main game's audio system:

```javascript
// In your mini-game
playSound(soundName) {
    if (window.game && window.game.sound) {
        window.game.sound.play(soundName);
    }
}
```

## CSS Architecture

### File Organization
- **main.css**: Core game styles and layout
- **panels.css**: Side panel layouts and responsive design
- **modals.css**: Modal dialog styling
- **inventory.css**: Inventory system and item display
- **minigames.css**: Mini-game overlay and component styles
- **notifications.css**: In-game notification system
- **utilities.css**: Utility classes and responsive helpers

### Design System
- **Color Scheme**: Retro cyber theme with green (#00ff00) accents
- **Typography**: Monospace fonts for technical elements
- **Spacing**: Consistent padding and margin scale
- **Responsive**: Mobile-friendly with flexible layouts

## Development Workflow

### Adding New Features
1. Create feature branch
2. Implement in appropriate module
3. Add necessary styles to CSS files
4. Update scenario JSON if needed
5. Test with multiple scenarios
6. Document changes

### Testing Mini-Games
1. Create test scenario with your mini-game object
2. Test success and failure paths
3. Verify cleanup and state management
4. Test on different screen sizes
5. Ensure integration with main game systems

### Performance Considerations
- Use efficient asset loading
- Implement proper cleanup in all systems
- Monitor memory usage with browser dev tools
- Optimize for mobile devices

This documentation provides a comprehensive foundation for understanding and extending the BreakEscape codebase. For specific implementation questions, refer to the existing code examples in the repository. 