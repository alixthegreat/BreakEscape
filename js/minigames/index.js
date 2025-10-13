// Export minigame framework
export { MinigameFramework } from './framework/minigame-manager.js';
export { MinigameScene } from './framework/base-minigame.js';

// Export minigame implementations
export { LockpickingMinigamePhaser } from './lockpicking/lockpicking-game-phaser.js';
export { DustingMinigame } from './dusting/dusting-game.js';
export { NotesMinigame, startNotesMinigame, showMissionBrief } from './notes/notes-minigame.js';
export { BluetoothScannerMinigame, startBluetoothScannerMinigame } from './bluetooth/bluetooth-scanner-minigame.js';
export { BiometricsMinigame, startBiometricsMinigame } from './biometrics/biometrics-minigame.js';
export { LockpickSetMinigame, startLockpickSetMinigame } from './lockpick/lockpick-set-minigame.js';
export { ContainerMinigame, startContainerMinigame, returnToContainerAfterNotes } from './container/container-minigame.js';
export { PhoneMessagesMinigame, returnToPhoneAfterNotes } from './phone/phone-messages-minigame.js';
export { PinMinigame, startPinMinigame } from './pin/pin-minigame.js';

// Initialize the global minigame framework for backward compatibility
import { MinigameFramework } from './framework/minigame-manager.js';
import { LockpickingMinigamePhaser } from './lockpicking/lockpicking-game-phaser.js';

// Make the framework available globally 
window.MinigameFramework = MinigameFramework;

// Add global helper functions for debugging
window.restartMinigame = () => {
    if (window.MinigameFramework) {
        window.MinigameFramework.restartCurrentMinigame();
    } else {
        console.log('MinigameFramework not available');
    }
};

window.closeMinigame = () => {
    if (window.MinigameFramework) {
        window.MinigameFramework.forceCloseMinigame();
    } else {
        console.log('MinigameFramework not available');
    }
};

// Import the dusting minigame
import { DustingMinigame } from './dusting/dusting-game.js';

// Import the notes minigame
import { NotesMinigame, startNotesMinigame, showMissionBrief } from './notes/notes-minigame.js';

// Import the bluetooth scanner minigame
import { BluetoothScannerMinigame, startBluetoothScannerMinigame } from './bluetooth/bluetooth-scanner-minigame.js';

// Import the biometrics minigame
import { BiometricsMinigame, startBiometricsMinigame } from './biometrics/biometrics-minigame.js';

// Import the lockpick set minigame
import { LockpickSetMinigame, startLockpickSetMinigame } from './lockpick/lockpick-set-minigame.js';

// Import the container minigame
import { ContainerMinigame, startContainerMinigame, returnToContainerAfterNotes } from './container/container-minigame.js';

// Import the phone messages minigame
import { PhoneMessagesMinigame, returnToPhoneAfterNotes } from './phone/phone-messages-minigame.js';

// Import the PIN minigame
import { PinMinigame, startPinMinigame } from './pin/pin-minigame.js';

// Register minigames
MinigameFramework.registerScene('lockpicking', LockpickingMinigamePhaser); // Use Phaser version as default
MinigameFramework.registerScene('lockpicking-phaser', LockpickingMinigamePhaser); // Keep explicit phaser name
MinigameFramework.registerScene('dusting', DustingMinigame);
MinigameFramework.registerScene('notes', NotesMinigame);
MinigameFramework.registerScene('bluetooth-scanner', BluetoothScannerMinigame);
MinigameFramework.registerScene('biometrics', BiometricsMinigame);
MinigameFramework.registerScene('lockpick-set', LockpickSetMinigame);
MinigameFramework.registerScene('container', ContainerMinigame);
MinigameFramework.registerScene('phone-messages', PhoneMessagesMinigame);
MinigameFramework.registerScene('pin', PinMinigame);

// Make minigame functions available globally
window.startNotesMinigame = startNotesMinigame;
window.showMissionBrief = showMissionBrief;
window.startBluetoothScannerMinigame = startBluetoothScannerMinigame;
window.startBiometricsMinigame = startBiometricsMinigame;
window.startLockpickSetMinigame = startLockpickSetMinigame;
window.startContainerMinigame = startContainerMinigame;
window.returnToContainerAfterNotes = returnToContainerAfterNotes;
window.returnToPhoneAfterNotes = returnToPhoneAfterNotes;
window.startPinMinigame = startPinMinigame; 