/**
 * Title Screen Customization Examples
 * 
 * The title screen can be easily customized without modifying the core minigame.
 * Here are some examples of how to extend and customize it.
 */

// ============================================================================
// EXAMPLE 1: Simple Scenario Configuration (Recommended)
// ============================================================================

// In your scenario JSON, just set:
// {
//     "showTitleScreen": true,
//     "scenario_brief": "Your mission..."
// }

// Default behavior:
// - Shows "BreakEscape" title
// - Shows "Educational Security Game" subtitle
// - Auto-closes after 3 seconds or when next minigame starts


// ============================================================================
// EXAMPLE 2: Customizing via Window Function (Advanced)
// ============================================================================

// Call from anywhere in your code:
window.startTitleScreenMinigame({
    autoCloseTimeout: 5000,  // Wait 5 seconds instead of 3
    // Add custom parameters - the minigame can read params.customField
});


// ============================================================================
// EXAMPLE 3: Extending the Title Screen Class (For Developers)
// ============================================================================

// If you want to create a specialized title screen, extend the base class:

import { MinigameScene } from '../framework/base-minigame.js';

export class CustomTitleScreenMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        this.theme = params?.theme || 'default';
    }
    
    init() {
        this.container.innerHTML = `
            <div class="title-screen-container ${this.theme}">
                <div class="title-screen-title">BreakEscape</div>
                <div class="title-screen-subtitle">Educational Security Game</div>
                ${this.theme === 'dark' ? '<div class="title-screen-loading">Loading</div>' : ''}
            </div>
        `;
    }
}

// Then register it:
// MinigameFramework.registerScene('custom-title', CustomTitleScreenMinigame);


// ============================================================================
// EXAMPLE 4: CSS Variations
// ============================================================================

/* Add to css/title-screen.css for theme variations */

/* Dark theme */
.title-screen-container.dark .title-screen-title {
    color: #ff0080;  /* Magenta instead of green */
    text-shadow: 0 0 20px rgba(255, 0, 128, 0.5);
}

/* Cyberpunk theme */
.title-screen-container.cyberpunk {
    background: linear-gradient(45deg, #0a0a0a, #1a0a1a);
}

.title-screen-container.cyberpunk .title-screen-title {
    color: #00ff00;
    font-size: 72px;
    letter-spacing: 8px;
    text-transform: uppercase;
}


// ============================================================================
// EXAMPLE 5: Enhanced Title Screen with Progress
// ============================================================================

// This shows how you could add loading progress

class ProgressTitleScreenMinigame extends MinigameScene {
    init() {
        this.container.innerHTML = `
            <div class="title-screen-container">
                <div class="title-screen-title">BreakEscape</div>
                <div class="title-screen-subtitle">Educational Security Game</div>
                <div class="title-screen-progress">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">Loading assets...</div>
                </div>
            </div>
        `;
        
        this.progressFill = this.container.querySelector('.progress-fill');
        this.progressText = this.container.querySelector('.progress-text');
    }
    
    start() {
        super.start();
        
        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 100) progress = 100;
            
            this.progressFill.style.width = progress + '%';
            
            if (progress === 100) {
                this.progressText.textContent = 'Ready!';
                clearInterval(interval);
            }
        }, 200);
    }
}


// ============================================================================
// EXAMPLE 6: Interactive Title Screen (Advanced)
// ============================================================================

// A title screen that waits for user input

class InteractiveTitleScreenMinigame extends MinigameScene {
    init() {
        this.container.innerHTML = `
            <div class="title-screen-container">
                <div class="title-screen-title">BreakEscape</div>
                <div class="title-screen-subtitle">Educational Security Game</div>
                <button id="title-start-button" class="title-screen-button">
                    Press to Continue
                </button>
            </div>
        `;
        
        // Add event listener to button
        const button = document.getElementById('title-start-button');
        button.addEventListener('click', () => {
            console.log('User clicked start');
            this.complete(true);  // Close the title screen
        });
    }
}

// CSS for the button:
/*
.title-screen-button {
    background: #00ff00;
    border: 2px solid #00ff00;
    color: #000;
    padding: 10px 30px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    letter-spacing: 2px;
    transition: all 0.3s ease;
}

.title-screen-button:hover {
    background: #000;
    color: #00ff00;
    text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
}
*/


// ============================================================================
// EXAMPLE 7: Story-Based Title Screen
// ============================================================================

// Title screen that introduces the story

class StoryTitleScreenMinigame extends MinigameScene {
    init() {
        const scenario = window.gameScenario || {};
        const storyIntro = scenario.storyIntro || 'Welcome to BreakEscape';
        
        this.container.innerHTML = `
            <div class="title-screen-container story-theme">
                <div class="title-screen-title">BreakEscape</div>
                <div class="story-intro-text">${storyIntro}</div>
                <div class="title-screen-loading">Preparing mission...</div>
            </div>
        `;
    }
}

// In scenario JSON:
// {
//     "showTitleScreen": true,
//     "storyIntro": "You have 24 hours to uncover the truth...",
//     ...
// }


// ============================================================================
// IMPLEMENTATION TIPS
// ============================================================================

/*
1. The title screen receives params from startTitleScreenMinigame()
   - Use params to customize behavior
   - params.theme, params.title, params.customField, etc.

2. Access the scenario via window.gameScenario
   - This is loaded by the time the title screen starts
   - Use it to customize based on scenario data

3. Call this.complete(success) to close the title screen
   - true = completed successfully
   - false = cancelled/closed

4. The MinigameFramework handles:
   - Hiding the canvas
   - Disabling game input
   - Auto-closing when next minigame starts
   - Showing canvas when transitioning to next minigame

5. CSS should follow the existing pattern:
   - .title-screen-container (wrapper)
   - .title-screen-title (main title)
   - .title-screen-subtitle (secondary text)
   - .title-screen-loading (loading indicator)

6. For full-featured custom screens:
   - Create your own class extending MinigameScene
   - Register it with MinigameFramework.registerScene()
   - Reference it in scenario config or call directly
*/
