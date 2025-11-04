/**
 * PersonChatPortraits - Portrait Rendering System
 * 
 * Renders character portraits using Phaser sprite frames at 4x zoom.
 * - Player portraits face right
 * - NPC portraits face left
 * 
 * @module person-chat-portraits
 */

export default class PersonChatPortraits {
    /**
     * Create portrait renderer
     * @param {Phaser.Game} game - Phaser game instance
     * @param {Object} npc - NPC data with sprite information
     * @param {HTMLElement} portraitContainer - Container for portrait canvas
     */
    constructor(game, npc, portraitContainer) {
        this.game = game;
        this.npc = npc;
        this.portraitContainer = portraitContainer;
        
        // Portrait settings
        this.spriteSize = 64; // Base sprite size
        this.zoomLevel = 4; // 4x zoom
        this.portraitWidth = this.spriteSize * this.zoomLevel; // 256px
        this.portraitHeight = this.spriteSize * this.zoomLevel; // 256px
        
        // Canvas and context
        this.canvas = null;
        this.ctx = null;
        
        // Sprite info
        this.spriteSheet = null;
        this.frameIndex = null;
        this.spriteTalkImage = null; // Single frame talk image (alternative to spriteSheet)
        this.useSpriteTalk = false; // Whether to use spriteTalk instead of spriteSheet
        this.flipped = false; // Whether to flip the sprite horizontally
        this.facingDirection = npc.id === 'player' ? 'right' : 'left';
        
        console.log(`🖼️ Portrait renderer created for NPC: ${npc.id}`);
    }
    
    /**
     * Initialize portrait display in container
     * Creates canvas and renders sprite frame
     */
    init() {
        if (!this.portraitContainer) {
            console.warn('❌ Portrait container not found');
            return false;
        }
        
        try {
            // Create canvas
            this.canvas = document.createElement('canvas');
            
            // Set canvas to use full available screen size
            this.updateCanvasSize();
            
            this.canvas.className = 'person-chat-portrait';
            this.canvas.id = `portrait-${this.npc.id}`;
            this.ctx = this.canvas.getContext('2d');
            
            // Style canvas for pixel-art rendering
            this.canvas.style.imageRendering = 'pixelated';
            this.canvas.style.imageRendering = '-moz-crisp-edges';
            this.canvas.style.imageRendering = 'crisp-edges';
            this.canvas.style.display = 'block';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            
            // Add to container
            this.portraitContainer.innerHTML = '';
            this.portraitContainer.appendChild(this.canvas);
            
            // Get sprite sheet and frame
            this.setupSpriteInfo();
            
            // Render portrait
            this.render();
            
            // Handle window resize
            window.addEventListener('resize', () => this.handleResize());
            
            console.log(`✅ Portrait initialized for ${this.npc.id} (${this.canvas.width}x${this.canvas.height})`);
            return true;
        } catch (error) {
            console.error('❌ Error initializing portrait:', error);
            return false;
        }
    }
    
    /**
     * Update canvas size to match available screen space
     */
    updateCanvasSize() {
        if (!this.canvas) return;
        
        // Use full viewport size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    /**
     * Handle canvas resize on window resize
     */
    handleResize() {
        if (!this.canvas) return;
        
        try {
            this.updateCanvasSize();
            this.render();
        } catch (error) {
            console.error('❌ Error resizing portrait:', error);
        }
    }
    
    /**
     * Set up sprite sheet and frame information
     */
    setupSpriteInfo() {
        console.log(`🔍 setupSpriteInfo - this.npc.id: ${this.npc.id}, this.npc.spriteTalk: ${this.npc.spriteTalk}`);
        console.log(`🔍 setupSpriteInfo - full NPC object:`, this.npc);
        
        // Check if NPC has a spriteTalk image (single frame portrait)
        if (this.npc.spriteTalk) {
            console.log(`📸 Using spriteTalk image: ${this.npc.spriteTalk}`);
            this.useSpriteTalk = true;
            this.spriteTalkImage = null; // Will be loaded in render
            // For NPCs with spriteTalk, flip the image to face right
            this.flipped = this.npc.id !== 'player';
            return;
        }
        
        // Otherwise use spriteSheet with frame
        console.log(`🔍 No spriteTalk found, using spriteSheet`);
        this.useSpriteTalk = false;
        
        if (this.npc.id === 'player') {
            // Player uses their sprite
            this.spriteSheet = 'hacker'; // Default player sprite
            // Use diagonal down-right frame (facing right/down)
            this.frameIndex = 20; // Diagonal down-right idle frame
            this.flipped = false; // Player not flipped
        } else {
            // NPC uses their configured sprite
            this.spriteSheet = this.npc.spriteSheet || 'hacker';
            // Use diagonal down-left frame (same frame as player's down-right, but flipped)
            this.frameIndex = 20; // Diagonal down idle frame
            this.flipped = true; // NPC is flipped to face left
        }
    }
    
    /**
     * Render the portrait using Phaser texture or spriteTalk image, scaled to fill canvas
     */
    render() {
        if (!this.canvas || !this.ctx) return;
        
        try {
            console.log(`🎨 render() called - useSpriteTalk: ${this.useSpriteTalk}, spriteSheet: ${this.spriteSheet}`);
            
            // Clear canvas
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // If using spriteTalk image, render that instead
            if (this.useSpriteTalk) {
                console.log(`🎨 Rendering spriteTalk image path`);
                this.renderSpriteTalkImage();
                return;
            }
            
            console.log(`🎨 Rendering spriteSheet path - spriteSheet: ${this.spriteSheet}, frame: ${this.frameIndex}`);
            
            // Get Phaser texture
            const texture = this.game.textures.get(this.spriteSheet);
            if (!texture || texture.key === '__MISSING') {
                console.warn(`⚠️ Texture not found: ${this.spriteSheet}`);
                this.renderPlaceholder();
                return;
            }
            
            // Get the frame
            const frame = texture.get(this.frameIndex);
            if (!frame) {
                console.warn(`⚠️ Frame ${this.frameIndex} not found in ${this.spriteSheet}`);
                this.renderPlaceholder();
                return;
            }
            
            // Get the source image
            const source = frame.source.image;
            
            // Calculate scaling to fill canvas while maintaining aspect ratio
            const spriteWidth = frame.cutWidth;
            const spriteHeight = frame.cutHeight;
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;
            
            let scaleX = canvasWidth / spriteWidth;
            let scaleY = canvasHeight / spriteHeight;
            let scale = Math.max(scaleX, scaleY); // Fit cover style
            
            // Calculate position to center the sprite
            const scaledWidth = spriteWidth * scale;
            const scaledHeight = spriteHeight * scale;
            const x = (canvasWidth - scaledWidth) / 2;
            const y = (canvasHeight - scaledHeight) / 2;
            
            // Draw the sprite frame scaled to fill canvas with optional flip
            this.ctx.imageSmoothingEnabled = false;
            
            if (this.flipped) {
                // Save current state, flip horizontally, draw, restore
                this.ctx.save();
                this.ctx.translate(canvasWidth / 2, 0);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(
                    source,
                    frame.cutX, frame.cutY, // Source position
                    frame.cutWidth, frame.cutHeight, // Source size
                    x - canvasWidth / 2, y, // Destination position
                    scaledWidth, scaledHeight // Destination size (scaled)
                );
                this.ctx.restore();
            } else {
                // Draw normally
                this.ctx.drawImage(
                    source,
                    frame.cutX, frame.cutY, // Source position
                    frame.cutWidth, frame.cutHeight, // Source size
                    x, y, // Destination position
                    scaledWidth, scaledHeight // Destination size (scaled)
                );
            }
            
        } catch (error) {
            console.error('❌ Error rendering portrait:', error);
            this.renderPlaceholder();
        }
    }
    
    /**
     * Render the spriteTalk image (single frame portrait)
     * Loads the image from the NPC's spriteTalk property
     */
    renderSpriteTalkImage() {
        if (!this.ctx || !this.canvas) return;
        
        try {
            // Load image if not already loaded
            if (!this.spriteTalkImage) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    // Store loaded image
                    this.spriteTalkImage = img;
                    this.drawSpriteTalkImage(img);
                };
                
                img.onerror = () => {
                    console.error(`❌ Failed to load spriteTalk image: ${this.npc.spriteTalk}`);
                    this.renderPlaceholder();
                };
                
                // Start loading image
                img.src = this.npc.spriteTalk;
            } else {
                // Already loaded, draw it
                this.drawSpriteTalkImage(this.spriteTalkImage);
            }
        } catch (error) {
            console.error('❌ Error rendering spriteTalk image:', error);
            this.renderPlaceholder();
        }
    }
    
    /**
     * Draw the spriteTalk image scaled to fill canvas
     * @param {Image} img - The loaded image element
     */
    drawSpriteTalkImage(img) {
        if (!this.ctx || !this.canvas) return;
        
        try {
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;
            const imgWidth = img.width;
            const imgHeight = img.height;
            
            // Calculate scaling to fill canvas while maintaining aspect ratio
            let scaleX = canvasWidth / imgWidth;
            let scaleY = canvasHeight / imgHeight;
            let scale = Math.max(scaleX, scaleY); // Fit cover style
            
            // Calculate position to center the image
            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;
            const x = (canvasWidth - scaledWidth) / 2;
            const y = (canvasHeight - scaledHeight) / 2;
            
            // Draw image scaled to fill canvas with optional flip
            this.ctx.imageSmoothingEnabled = false;
            
            if (this.flipped) {
                // Save current state, flip horizontally, draw, restore
                this.ctx.save();
                this.ctx.translate(canvasWidth / 2, 0);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(
                    img,
                    x - canvasWidth / 2, y, // Destination position
                    scaledWidth, scaledHeight // Destination size (scaled)
                );
                this.ctx.restore();
            } else {
                // Draw normally
                this.ctx.drawImage(
                    img,
                    x, y, // Destination position
                    scaledWidth, scaledHeight // Destination size (scaled)
                );
            }
        } catch (error) {
            console.error('❌ Error drawing spriteTalk image:', error);
            this.renderPlaceholder();
        }
    }
    
    /**
     * Render a placeholder when sprite unavailable
     */
    renderPlaceholder() {
        if (!this.ctx || !this.canvas) return;
        
        // Draw colored rectangle
        this.ctx.fillStyle = this.npc.id === 'player' ? '#2d5a8f' : '#8f2d2d';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
            this.npc.displayName || this.npc.id,
            this.canvas.width / 2,
            this.canvas.height / 2
        );
    }
    
    /**
     * Destroy portrait and cleanup
     */
    destroy() {
        // No timers to clear in this version
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
        console.log(`✅ Portrait destroyed for ${this.npc.id}`);
    }
}
