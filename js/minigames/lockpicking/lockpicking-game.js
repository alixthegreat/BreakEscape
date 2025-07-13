import { MinigameScene } from '../framework/base-minigame.js';

// Lockpicking Minigame Scene implementation
export class LockpickingMinigame extends MinigameScene {
    constructor(container, params) {
        super(container, params);
        
        this.lockable = params.lockable;
        this.difficulty = params.difficulty || 'medium';
        this.pinCount = this.difficulty === 'easy' ? 3 : this.difficulty === 'medium' ? 4 : 5;
        
        this.pins = [];
        this.lockState = {
            tensionApplied: false,
            pinsSet: 0,
            currentPin: null
        };
    }
    
    init() {
        super.init();
        
        this.headerElement.innerHTML = `
            <h3>Lockpicking</h3>
            <p>Apply tension and hold click on pins to lift them to the shear line</p>
        `;
        
        this.setupLockpickingInterface();
        this.createPins();
        this.updateFeedback("Apply tension first, then click and hold on pins to lift them");
    }
    
    setupLockpickingInterface() {
        this.gameContainer.innerHTML = `
            <div class="instructions">Apply tension first, then click and hold on pins to lift them to the shear line</div>
            <div class="lock-visual">
                <div class="shear-line"></div>
            </div>
            <div class="tension-control">
                <div class="tension-wrench" id="tension-wrench"></div>
                <span>Tension Wrench</span>
            </div>
            <div class="lockpick-feedback">Ready to pick</div>
        `;
        
        this.lockVisual = this.gameContainer.querySelector('.lock-visual');
        this.feedback = this.gameContainer.querySelector('.lockpick-feedback');
        
        // Set up tension wrench
        const tensionWrench = document.getElementById('tension-wrench');
        this.addEventListener(tensionWrench, 'click', () => {
            this.lockState.tensionApplied = !this.lockState.tensionApplied;
            tensionWrench.classList.toggle('active', this.lockState.tensionApplied);
            this.updateBindingPins();
            this.updateFeedback(this.lockState.tensionApplied ? 
                "Tension applied. Now lift pins to the shear line." : 
                "Apply tension first.");
        });
    }
    
    createPins() {
        // Create random binding order
        const bindingOrder = [];
        for (let i = 0; i < this.pinCount; i++) {
            bindingOrder.push(i);
        }
        this.shuffleArray(bindingOrder);
        
        // Create pins
        for (let i = 0; i < this.pinCount; i++) {
            const pin = {
                index: i,
                binding: bindingOrder[i],
                isSet: false,
                currentHeight: 0,
                targetHeight: 30 + Math.random() * 30, // Random cut depth
                elements: {}
            };
            
            // Create pin DOM elements
            const pinElement = document.createElement('div');
            pinElement.className = 'pin';
            pinElement.style.order = i;
            
            const keyPin = document.createElement('div');
            keyPin.className = 'key-pin';
            
            const driverPin = document.createElement('div');
            driverPin.className = 'driver-pin';
            
            const spring = document.createElement('div');
            spring.className = 'spring';
            
            pinElement.appendChild(keyPin);
            pinElement.appendChild(driverPin);
            pinElement.appendChild(spring);
            
            pin.elements = {
                container: pinElement,
                keyPin: keyPin,
                driverPin: driverPin,
                spring: spring
            };
            
            // Add event listeners
            this.addEventListener(pinElement, 'mousedown', (e) => {
                e.preventDefault();
                if (this.lockState.tensionApplied) {
                    this.lockState.currentPin = pin;
                    this.gameState.mouseDown = true;
                    this.liftPin();
                }
            });
            
            this.addEventListener(document, 'mouseup', () => {
                if (this.lockState.currentPin) {
                    this.checkPinSet(this.lockState.currentPin);
                    this.lockState.currentPin = null;
                }
                this.gameState.mouseDown = false;
            });
            
            this.lockVisual.appendChild(pinElement);
            this.pins.push(pin);
        }
    }
    
    liftPin() {
        if (!this.lockState.currentPin || !this.gameState.mouseDown) return;
        
        const pin = this.lockState.currentPin;
        pin.currentHeight = Math.min(pin.currentHeight + 2, 80);
        
        // Update visual
        pin.elements.keyPin.style.height = `${pin.currentHeight}px`;
        pin.elements.driverPin.style.bottom = `${60 + pin.currentHeight}px`;
        
        // Check if close to shear line
        const distanceToShearLine = Math.abs(pin.currentHeight - 60);
        if (distanceToShearLine < 5) {
            pin.elements.container.style.boxShadow = "0 0 5px #ffffff";
        } else {
            pin.elements.container.style.boxShadow = "";
        }
        
        if (this.gameState.mouseDown) {
            requestAnimationFrame(() => this.liftPin());
        }
    }
    
    checkPinSet(pin) {
        const distanceToShearLine = Math.abs(pin.currentHeight - 60);
        const shouldBind = this.shouldPinBind(pin);
        
        if (distanceToShearLine < 8 && shouldBind) {
            // Pin set successfully
            pin.isSet = true;
            pin.elements.container.classList.add('set');
            this.lockState.pinsSet++;
            
            this.updateFeedback(`Pin ${pin.index + 1} set! (${this.lockState.pinsSet}/${this.pinCount})`);
            this.updateBindingPins();
            
            if (this.lockState.pinsSet === this.pinCount) {
                this.lockPickingSuccess();
            }
        } else if (this.lockState.tensionApplied && !shouldBind) {
            // Wrong pin - reset all pins
            this.resetAllPins();
            this.updateFeedback("Wrong pin! All pins reset.");
        } else {
            // Pin falls back down
            pin.currentHeight = 0;
            pin.elements.keyPin.style.height = '0px';
            pin.elements.driverPin.style.bottom = '60px';
            pin.elements.container.style.boxShadow = "";
        }
    }
    
    shouldPinBind(pin) {
        if (!this.lockState.tensionApplied) return false;
        
        // Find the next unset pin in binding order
        for (let order = 0; order < this.pinCount; order++) {
            const nextPin = this.pins.find(p => p.binding === order && !p.isSet);
            if (nextPin) {
                return pin.index === nextPin.index;
            }
        }
        return false;
    }
    
    updateBindingPins() {
        if (!this.lockState.tensionApplied) {
            this.pins.forEach(pin => {
                pin.elements.container.classList.remove('binding');
            });
            return;
        }
        
        // Find the next unset pin in binding order
        for (let order = 0; order < this.pinCount; order++) {
            const nextPin = this.pins.find(p => p.binding === order && !p.isSet);
            if (nextPin) {
                this.pins.forEach(pin => {
                    pin.elements.container.classList.toggle('binding', pin.index === nextPin.index);
                });
                return;
            }
        }
        
        // All pins set
        this.pins.forEach(pin => {
            pin.elements.container.classList.remove('binding');
        });
    }
    
    resetAllPins() {
        this.pins.forEach(pin => {
            if (!pin.isSet) {
                pin.currentHeight = 0;
                pin.elements.keyPin.style.height = '0px';
                pin.elements.driverPin.style.bottom = '60px';
                pin.elements.container.style.boxShadow = "";
            }
        });
    }
    
    updateFeedback(message) {
        this.feedback.textContent = message;
    }
    
    lockPickingSuccess() {
        this.gameState.isActive = false;
        this.updateFeedback("Lock picked successfully!");
        
        const successHTML = `
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 10px;">Lock picked successfully!</div>
            <div style="font-size: 14px; margin-bottom: 15px;">All pins set at the shear line</div>
            <div style="font-size: 12px; color: #aaa;">
                Difficulty: ${this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1)}<br>
                Pins: ${this.pinCount}
            </div>
        `;
        
        this.showSuccess(successHTML, true, 2000);
        this.gameResult = { lockable: this.lockable };
    }
    
    start() {
        super.start();
        this.gameState.isActive = true;
        this.lockState.tensionApplied = false;
        this.lockState.pinsSet = 0;
        this.updateProgress(0, this.pinCount);
    }
    
    complete(success) {
        super.complete(success, this.gameResult);
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
} 