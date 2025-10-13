import { initializeRooms, calculateWorldBounds, calculateRoomPositions, createRoom, revealRoom, updatePlayerRoom, rooms } from './rooms.js?v=16';
import { createPlayer, updatePlayerMovement, movePlayerToPoint, player } from './player.js?v=7';
import { initializePathfinder } from './pathfinding.js?v=7';
import { initializeInventory, processInitialInventoryItems } from '../systems/inventory.js?v=8';
import { checkObjectInteractions, setGameInstance } from '../systems/interactions.js?v=23';
import { introduceScenario } from '../utils/helpers.js?v=19';
import '../minigames/index.js?v=2';

// Global variables that will be set by main.js
let gameScenario;

// Preload function - loads all game assets
export function preload() {
    // Show loading text
    document.getElementById('loading').style.display = 'block';

    // Load tilemap files and regular tilesets first
    this.load.tilemapTiledJSON('room_reception', 'assets/rooms/room_reception2.json');
    this.load.tilemapTiledJSON('room_office', 'assets/rooms/room_office2.json');
    this.load.tilemapTiledJSON('room_ceo', 'assets/rooms/room_ceo2.json');
    this.load.tilemapTiledJSON('room_closet', 'assets/rooms/room_closet2.json');
    this.load.tilemapTiledJSON('room_servers', 'assets/rooms/room_servers2.json');

    // Load room images (now using smaller 32px scale images)
    this.load.image('room_reception', 'assets/tiles/rooms/room1.png');
    this.load.image('room18', 'assets/tiles/rooms/room18.png');
    this.load.image('room6', 'assets/tiles/rooms/room6.png');
    this.load.image('room14', 'assets/tiles/rooms/room14.png');
    this.load.image('room19', 'assets/tiles/rooms/room19.png');
    this.load.image('door_32', 'assets/tiles/door_32.png');
    this.load.spritesheet('door_sheet', 'assets/tiles/door_sheet_32.png', {
        frameWidth: 32,
        frameHeight: 64
    });

    // Load tileset images referenced by the new Tiled map
    this.load.image('office-updated', 'assets/tiles/rooms/room1.png');
    this.load.image('door_sheet_32', 'assets/tiles/door_sheet_32.png');
    this.load.image('door_side_sheet_32', 'assets/tiles/door_side_sheet_32.png');
    
    // Load table tileset images
    this.load.image('desk-ceo1', 'assets/tables/desk-ceo1.png');
    this.load.image('desk-ceo2', 'assets/tables/desk-ceo2.png');
    this.load.image('desk1', 'assets/tables/desk1.png');
    this.load.image('smalldesk1', 'assets/tables/smalldesk1.png');
    this.load.image('smalldesk2', 'assets/tables/smalldesk2.png');
    this.load.image('reception_table1', 'assets/tables/reception_table1.png');

    // Load object sprites - keeping existing ones for backward compatibility
    this.load.image('pc', 'assets/objects/pc1.png');
    this.load.image('key', 'assets/objects/key.png');
    this.load.image('notes', 'assets/objects/notes1.png');
    this.load.image('phone', 'assets/objects/phone1.png');
    this.load.image('suitcase', 'assets/objects/suitcase-1.png');
    this.load.image('smartscreen', 'assets/objects/smartscreen.png');
    this.load.image('photo', 'assets/objects/picture1.png');
    this.load.image('safe', 'assets/objects/safe1.png');
    this.load.image('book', 'assets/objects/book1.png');
    this.load.image('workstation', 'assets/objects/workstation.png');
    this.load.image('bluetooth_scanner', 'assets/objects/bluetooth_scanner.png');
    this.load.image('bluetooth', 'assets/objects/bluetooth.png');
    this.load.image('tablet', 'assets/objects/tablet.png');
    this.load.image('fingerprint', 'assets/objects/fingerprint_small.png');
    this.load.image('lockpick', 'assets/objects/lockpick.png');
    this.load.image('spoofing_kit', 'assets/objects/office-misc-headphones.png');

    // Load new object sprites from Tiled map tileset
    // These are the key objects that appear in the new room_reception2.json
    this.load.image('fingerprint_kit', 'assets/objects/fingerprint_kit.png');
    this.load.image('pin-cracker', 'assets/objects/pin-cracker.png');
    this.load.image('bin11', 'assets/objects/bin11.png');
    this.load.image('bin10', 'assets/objects/bin10.png');
    this.load.image('bin9', 'assets/objects/bin9.png');
    this.load.image('bin8', 'assets/objects/bin8.png');
    this.load.image('bin7', 'assets/objects/bin7.png');
    this.load.image('bin6', 'assets/objects/bin6.png');
    this.load.image('bin5', 'assets/objects/bin5.png');
    this.load.image('bin4', 'assets/objects/bin4.png');
    this.load.image('bin3', 'assets/objects/bin3.png');
    this.load.image('bin2', 'assets/objects/bin2.png');
    this.load.image('bin1', 'assets/objects/bin1.png');
    
    // Suitcases
    this.load.image('suitcase21', 'assets/objects/suitcase21.png');
    this.load.image('suitcase20', 'assets/objects/suitcase20.png');
    this.load.image('suitcase19', 'assets/objects/suitcase19.png');
    this.load.image('suitcase18', 'assets/objects/suitcase18.png');
    this.load.image('suitcase17', 'assets/objects/suitcase17.png');
    this.load.image('suitcase16', 'assets/objects/suitcase16.png');
    this.load.image('suitcase15', 'assets/objects/suitcase15.png');
    this.load.image('suitcase14', 'assets/objects/suitcase14.png');
    this.load.image('suitcase13', 'assets/objects/suitcase13.png');
    this.load.image('suitcase12', 'assets/objects/suitcase12.png');
    this.load.image('suitcase11', 'assets/objects/suitcase11.png');
    this.load.image('suitcase10', 'assets/objects/suitcase10.png');
    this.load.image('suitcase9', 'assets/objects/suitcase9.png');
    this.load.image('suitcase8', 'assets/objects/suitcase8.png');
    this.load.image('suitcase7', 'assets/objects/suitcase7.png');
    this.load.image('suitcase6', 'assets/objects/suitcase6.png');
    this.load.image('suitcase5', 'assets/objects/suitcase5.png');
    this.load.image('suitcase4', 'assets/objects/suitcase4.png');
    this.load.image('suitcase3', 'assets/objects/suitcase3.png');
    this.load.image('suitcase2', 'assets/objects/suitcase2.png');
    this.load.image('suitcase-1', 'assets/objects/suitcase-1.png');
    
    // Plants
    this.load.image('plant-flat-pot7', 'assets/objects/plant-flat-pot7.png');
    this.load.image('plant-flat-pot6', 'assets/objects/plant-flat-pot6.png');
    this.load.image('plant-flat-pot5', 'assets/objects/plant-flat-pot5.png');
    this.load.image('plant-flat-pot4', 'assets/objects/plant-flat-pot4.png');
    this.load.image('plant-flat-pot3', 'assets/objects/plant-flat-pot3.png');
    this.load.image('plant-flat-pot2', 'assets/objects/plant-flat-pot2.png');
    this.load.image('plant-flat-pot1', 'assets/objects/plant-flat-pot1.png');
    
    // Office furniture
    this.load.image('outdoor-lamp4', 'assets/objects/outdoor-lamp4.png');
    this.load.image('outdoor-lamp3', 'assets/objects/outdoor-lamp3.png');
    this.load.image('outdoor-lamp2', 'assets/objects/outdoor-lamp2.png');
    this.load.image('outdoor-lamp1', 'assets/objects/outdoor-lamp1.png');
    this.load.image('plant-large10', 'assets/objects/plant-large10.png');
    this.load.image('lamp-stand5', 'assets/objects/lamp-stand5.png');
    this.load.image('plant-large9', 'assets/objects/plant-large9.png');
    this.load.image('plant-large8', 'assets/objects/plant-large8.png');
    this.load.image('plant-large7', 'assets/objects/plant-large7.png');
    this.load.image('plant-large6', 'assets/objects/plant-large6.png');
    this.load.image('lamp-stand4', 'assets/objects/lamp-stand4.png');
    this.load.image('plant-large5', 'assets/objects/plant-large5.png');
    this.load.image('plant-large4', 'assets/objects/plant-large4.png');
    this.load.image('plant-large3', 'assets/objects/plant-large3.png');
    this.load.image('plant-large2', 'assets/objects/plant-large2.png');
    this.load.image('lamp-stand3', 'assets/objects/lamp-stand3.png');
    this.load.image('plant-large1', 'assets/objects/plant-large1.png');
    this.load.image('lamp-stand2', 'assets/objects/lamp-stand2.png');
    this.load.image('lamp-stand1', 'assets/objects/lamp-stand1.png');
    
    // Pictures
    this.load.image('picture14', 'assets/objects/picture14.png');
    this.load.image('picture13', 'assets/objects/picture13.png');
    this.load.image('picture12', 'assets/objects/picture12.png');
    this.load.image('picture11', 'assets/objects/picture11.png');
    this.load.image('picture10', 'assets/objects/picture10.png');
    this.load.image('picture9', 'assets/objects/picture9.png');
    this.load.image('picture8', 'assets/objects/picture8.png');
    this.load.image('picture7', 'assets/objects/picture7.png');
    this.load.image('picture6', 'assets/objects/picture6.png');
    this.load.image('picture5', 'assets/objects/picture5.png');
    this.load.image('picture4', 'assets/objects/picture4.png');
    this.load.image('picture3', 'assets/objects/picture3.png');
    this.load.image('picture2', 'assets/objects/picture2.png');
    this.load.image('picture1', 'assets/objects/picture1.png');
    
    // Office misc items
    this.load.image('office-misc-smallplant2', 'assets/objects/office-misc-smallplant2.png');
    this.load.image('office-misc-smallplant3', 'assets/objects/office-misc-smallplant3.png');
    this.load.image('office-misc-smallplant4', 'assets/objects/office-misc-smallplant4.png');
    this.load.image('office-misc-smallplant5', 'assets/objects/office-misc-smallplant5.png');
    this.load.image('office-misc-box1', 'assets/objects/office-misc-box1.png');
    this.load.image('office-misc-container', 'assets/objects/office-misc-container.png');
    this.load.image('office-misc-lamp3', 'assets/objects/office-misc-lamp3.png');
    this.load.image('office-misc-hdd6', 'assets/objects/office-misc-hdd6.png');
    this.load.image('office-misc-speakers6', 'assets/objects/office-misc-speakers6.png');
    this.load.image('office-misc-pencils6', 'assets/objects/office-misc-pencils6.png');
    this.load.image('office-misc-fan2', 'assets/objects/office-misc-fan2.png');
    this.load.image('office-misc-cup5', 'assets/objects/office-misc-cup5.png');
    this.load.image('office-misc-hdd5', 'assets/objects/office-misc-hdd5.png');
    this.load.image('office-misc-speakers5', 'assets/objects/office-misc-speakers5.png');
    this.load.image('office-misc-cup4', 'assets/objects/office-misc-cup4.png');
    this.load.image('office-misc-speakers4', 'assets/objects/office-misc-speakers4.png');
    this.load.image('office-misc-pencils5', 'assets/objects/office-misc-pencils5.png');

    this.load.image('office-misc-clock', 'assets/objects/office-misc-clock.png');
    this.load.image('office-misc-fan', 'assets/objects/office-misc-fan.png');
    this.load.image('office-misc-speakers3', 'assets/objects/office-misc-speakers3.png');
    this.load.image('office-misc-camera', 'assets/objects/office-misc-camera.png');
    this.load.image('office-misc-headphones', 'assets/objects/office-misc-headphones.png');
    this.load.image('office-misc-hdd4', 'assets/objects/office-misc-hdd4.png');
    this.load.image('office-misc-pencils4', 'assets/objects/office-misc-pencils4.png');
    this.load.image('office-misc-cup3', 'assets/objects/office-misc-cup3.png');
    this.load.image('office-misc-cup2', 'assets/objects/office-misc-cup2.png');
    this.load.image('office-misc-speakers2', 'assets/objects/office-misc-speakers2.png');
    this.load.image('office-misc-stapler', 'assets/objects/office-misc-stapler.png');
    this.load.image('office-misc-hdd3', 'assets/objects/office-misc-hdd3.png');
    this.load.image('office-misc-hdd2', 'assets/objects/office-misc-hdd2.png');
    this.load.image('office-misc-pencils3', 'assets/objects/office-misc-pencils3.png');
    this.load.image('office-misc-pencils2', 'assets/objects/office-misc-pencils2.png');
    this.load.image('office-misc-pens', 'assets/objects/office-misc-pens.png');
    this.load.image('office-misc-lamp2', 'assets/objects/office-misc-lamp2.png');
    this.load.image('office-misc-hdd', 'assets/objects/office-misc-hdd.png');
    this.load.image('office-misc-smallplant', 'assets/objects/office-misc-smallplant.png');
    this.load.image('office-misc-pencils', 'assets/objects/office-misc-pencils.png');
    this.load.image('office-misc-speakers', 'assets/objects/office-misc-speakers.png');
    this.load.image('office-misc-cup', 'assets/objects/office-misc-cup.png');
    this.load.image('office-misc-lamp', 'assets/objects/office-misc-lamp.png');
    this.load.image('phone5', 'assets/objects/phone5.png');
    this.load.image('phone4', 'assets/objects/phone4.png');
    this.load.image('phone3', 'assets/objects/phone3.png');
    this.load.image('phone2', 'assets/objects/phone2.png');
    this.load.image('phone1', 'assets/objects/phone1.png');
    
    // Bags and briefcases
    this.load.image('bag25', 'assets/objects/bag25.png');
    this.load.image('bag24', 'assets/objects/bag24.png');
    this.load.image('bag23', 'assets/objects/bag23.png');
    this.load.image('bag22', 'assets/objects/bag22.png');
    this.load.image('bag21', 'assets/objects/bag21.png');
    this.load.image('bag20', 'assets/objects/bag20.png');
    this.load.image('bag19', 'assets/objects/bag19.png');
    this.load.image('bag18', 'assets/objects/bag18.png');
    this.load.image('bag17', 'assets/objects/bag17.png');
    this.load.image('bag16', 'assets/objects/bag16.png');
    this.load.image('bag15', 'assets/objects/bag15.png');
    this.load.image('bag14', 'assets/objects/bag14.png');
    this.load.image('bag13', 'assets/objects/bag13.png');
    this.load.image('bag12', 'assets/objects/bag12.png');
    this.load.image('bag11', 'assets/objects/bag11.png');
    this.load.image('bag10', 'assets/objects/bag10.png');
    this.load.image('bag9', 'assets/objects/bag9.png');
    this.load.image('bag8', 'assets/objects/bag8.png');
    this.load.image('bag7', 'assets/objects/bag7.png');
    this.load.image('bag6', 'assets/objects/bag6.png');
    this.load.image('bag5', 'assets/objects/bag5.png');
    this.load.image('bag4', 'assets/objects/bag4.png');
    this.load.image('bag3', 'assets/objects/bag3.png');
    this.load.image('bag2', 'assets/objects/bag2.png');
    this.load.image('bag1', 'assets/objects/bag1.png');
    
    // Briefcases
    this.load.image('briefcase-orange-1', 'assets/objects/briefcase-orange-1.png');
    this.load.image('briefcase-yellow-1', 'assets/objects/briefcase-yellow-1.png');
    this.load.image('briefcase13', 'assets/objects/briefcase13.png');
    this.load.image('briefcase-purple-1', 'assets/objects/briefcase-purple-1.png');
    this.load.image('briefcase-green-1', 'assets/objects/briefcase-green-1.png');
    this.load.image('briefcase-blue-1', 'assets/objects/briefcase-blue-1.png');
    this.load.image('briefcase-red-1', 'assets/objects/briefcase-red-1.png');
    this.load.image('briefcase12', 'assets/objects/briefcase12.png');
    this.load.image('briefcase11', 'assets/objects/briefcase11.png');
    this.load.image('briefcase10', 'assets/objects/briefcase10.png');
    this.load.image('briefcase9', 'assets/objects/briefcase9.png');
    this.load.image('briefcase8', 'assets/objects/briefcase8.png');
    this.load.image('briefcase7', 'assets/objects/briefcase7.png');
    this.load.image('briefcase6', 'assets/objects/briefcase6.png');
    this.load.image('briefcase5', 'assets/objects/briefcase5.png');
    this.load.image('briefcase4', 'assets/objects/briefcase4.png');
    this.load.image('briefcase3', 'assets/objects/briefcase3.png');
    this.load.image('briefcase2', 'assets/objects/briefcase2.png');
    this.load.image('briefcase1', 'assets/objects/briefcase1.png');
    
    // Chairs
    this.load.image('chair-grey-4', 'assets/objects/chair-grey-4.png');
    this.load.image('chair-grey-3', 'assets/objects/chair-grey-3.png');
    this.load.image('chair-darkgreen-3', 'assets/objects/chair-darkgreen-3.png');
    this.load.image('chair-grey-2', 'assets/objects/chair-grey-2.png');
    this.load.image('chair-darkgray-1', 'assets/objects/chair-darkgray-1.png');
    this.load.image('chair-darkgreen-2', 'assets/objects/chair-darkgreen-2.png');
    this.load.image('chair-darkgreen-1', 'assets/objects/chair-darkgreen-1.png');
    this.load.image('chair-grey-1', 'assets/objects/chair-grey-1.png');
    this.load.image('chair-red-4', 'assets/objects/chair-red-4.png');
    this.load.image('chair-red-3', 'assets/objects/chair-red-3.png');
    this.load.image('chair-green-2', 'assets/objects/chair-green-2.png');
    this.load.image('chair-green-1', 'assets/objects/chair-green-1.png');
    this.load.image('chair-red-2', 'assets/objects/chair-red-2.png');
    this.load.image('chair-red-1', 'assets/objects/chair-red-1.png');
    this.load.image('chair-white-2', 'assets/objects/chair-white-2.png');
    this.load.image('chair-white-1', 'assets/objects/chair-white-1.png');
    
    // Keyboards
    this.load.image('keyboard8', 'assets/objects/keyboard8.png');
    this.load.image('keyboard7', 'assets/objects/keyboard7.png');
    this.load.image('keyboard6', 'assets/objects/keyboard6.png');
    this.load.image('keyboard5', 'assets/objects/keyboard5.png');
    this.load.image('keyboard4', 'assets/objects/keyboard4.png');
    this.load.image('keyboard3', 'assets/objects/keyboard3.png');
    this.load.image('keyboard2', 'assets/objects/keyboard2.png');
    this.load.image('keyboard1', 'assets/objects/keyboard1.png');
    
    // Safes
    this.load.image('safe5', 'assets/objects/safe5.png');
    this.load.image('safe4', 'assets/objects/safe4.png');
    this.load.image('safe3', 'assets/objects/safe3.png');
    this.load.image('safe2', 'assets/objects/safe2.png');
    this.load.image('safe1', 'assets/objects/safe1.png');
    
    // Notes
    this.load.image('notes1', 'assets/objects/notes1.png');
    this.load.image('notes2', 'assets/objects/notes2.png');
    this.load.image('notes3', 'assets/objects/notes3.png');
    this.load.image('notes4', 'assets/objects/notes4.png');

    
    // Servers and tech
    this.load.image('servers', 'assets/objects/servers.png');
    this.load.image('servers3', 'assets/objects/servers3.png');
    this.load.image('servers2', 'assets/objects/servers2.png');
    this.load.image('sofa1', 'assets/objects/sofa1.png');
    this.load.image('plant-large13', 'assets/objects/plant-large13.png');
    this.load.image('office-misc-lamp4', 'assets/objects/office-misc-lamp4.png');
    this.load.image('chair-waiting-right-1', 'assets/objects/chair-waiting-right-1.png');
    this.load.image('chair-waiting-left-1', 'assets/objects/chair-waiting-left-1.png');
    this.load.image('plant-large12', 'assets/objects/plant-large12.png');
    this.load.image('plant-large11', 'assets/objects/plant-large11.png');
    
    // Load animated plant frames
    this.load.image('plant-large11-top-ani1', 'assets/objects/plant-large11-top-ani1.png');
    this.load.image('plant-large11-top-ani2', 'assets/objects/plant-large11-top-ani2.png');
    this.load.image('plant-large11-top-ani3', 'assets/objects/plant-large11-top-ani3.png');
    this.load.image('plant-large11-top-ani4', 'assets/objects/plant-large11-top-ani4.png');
    
    this.load.image('plant-large12-top-ani1', 'assets/objects/plant-large12-top-ani1.png');
    this.load.image('plant-large12-top-ani2', 'assets/objects/plant-large12-top-ani2.png');
    this.load.image('plant-large12-top-ani3', 'assets/objects/plant-large12-top-ani3.png');
    this.load.image('plant-large12-top-ani4', 'assets/objects/plant-large12-top-ani4.png');
    this.load.image('plant-large12-top-ani5', 'assets/objects/plant-large12-top-ani5.png');
    
    this.load.image('plant-large13-top-ani1', 'assets/objects/plant-large13-top-ani1.png');
    this.load.image('plant-large13-top-ani2', 'assets/objects/plant-large13-top-ani2.png');
    this.load.image('plant-large13-top-ani3', 'assets/objects/plant-large13-top-ani3.png');
    this.load.image('plant-large13-top-ani4', 'assets/objects/plant-large13-top-ani4.png');
    this.load.image('pc1', 'assets/objects/pc1.png');
    this.load.image('pc3', 'assets/objects/pc3.png');
    this.load.image('pc4', 'assets/objects/pc4.png');
    this.load.image('pc5', 'assets/objects/pc5.png');
    this.load.image('pc6', 'assets/objects/pc6.png');
    this.load.image('pc7', 'assets/objects/pc7.png');
    this.load.image('pc8', 'assets/objects/pc8.png');
    this.load.image('pc9', 'assets/objects/pc9.png');
    this.load.image('pc10', 'assets/objects/pc10.png');
    this.load.image('pc11', 'assets/objects/pc11.png');
    this.load.image('pc12', 'assets/objects/pc12.png');
    this.load.image('pc13', 'assets/objects/pc13.png');

    
    // Laptops
    this.load.image('laptop7', 'assets/objects/laptop7.png');
    this.load.image('laptop6', 'assets/objects/laptop6.png');
    this.load.image('laptop5', 'assets/objects/laptop5.png');
    this.load.image('laptop4', 'assets/objects/laptop4.png');
    this.load.image('laptop3', 'assets/objects/laptop3.png');
    this.load.image('laptop2', 'assets/objects/laptop2.png');
    this.load.image('laptop1', 'assets/objects/laptop1.png');
    
    // Chalkboards and bookcases
    this.load.image('chalkboard3', 'assets/objects/chalkboard3.png');
    this.load.image('chalkboard2', 'assets/objects/chalkboard2.png');
    this.load.image('chalkboard', 'assets/objects/chalkboard.png');
    this.load.image('bookcase', 'assets/objects/bookcase.png');
    
    // Spooky basement items
    this.load.image('spooky-splatter', 'assets/objects/spooky-splatter.png');
    this.load.image('spooky-candles2', 'assets/objects/spooky-candles2.png');
    this.load.image('spooky-candles', 'assets/objects/spooky-candles.png');
    this.load.image('torch-left', 'assets/objects/torch-left.png');
    this.load.image('torch-right', 'assets/objects/torch-right.png');
    this.load.image('torch-1', 'assets/objects/torch-1.png');

    // Load character sprite sheet instead of single image
            this.load.spritesheet('hacker', 'assets/characters/hacker.png', {
            frameWidth: 64,
            frameHeight: 64
        });
        
        // Animated plant textures are loaded above
        
        // Load swivel chair rotation images
        this.load.image('chair-exec-rotate1', 'assets/objects/chair-exec-rotate1.png');
        this.load.image('chair-exec-rotate2', 'assets/objects/chair-exec-rotate2.png');
        this.load.image('chair-exec-rotate3', 'assets/objects/chair-exec-rotate3.png');
        this.load.image('chair-exec-rotate4', 'assets/objects/chair-exec-rotate4.png');
        this.load.image('chair-exec-rotate5', 'assets/objects/chair-exec-rotate5.png');
        this.load.image('chair-exec-rotate6', 'assets/objects/chair-exec-rotate6.png');
        this.load.image('chair-exec-rotate7', 'assets/objects/chair-exec-rotate7.png');
        this.load.image('chair-exec-rotate8', 'assets/objects/chair-exec-rotate8.png');
        
        // Load white chair rotation images
        this.load.image('chair-white-1-rotate1', 'assets/objects/chair-white-1-rotate1.png');
        this.load.image('chair-white-1-rotate2', 'assets/objects/chair-white-1-rotate2.png');
        this.load.image('chair-white-1-rotate3', 'assets/objects/chair-white-1-rotate3.png');
        this.load.image('chair-white-1-rotate4', 'assets/objects/chair-white-1-rotate4.png');
        this.load.image('chair-white-1-rotate5', 'assets/objects/chair-white-1-rotate5.png');
        this.load.image('chair-white-1-rotate6', 'assets/objects/chair-white-1-rotate6.png');
        this.load.image('chair-white-1-rotate7', 'assets/objects/chair-white-1-rotate7.png');
        this.load.image('chair-white-1-rotate8', 'assets/objects/chair-white-1-rotate8.png');
        
        this.load.image('chair-white-2-rotate1', 'assets/objects/chair-white-2-rotate1.png');
        this.load.image('chair-white-2-rotate2', 'assets/objects/chair-white-2-rotate2.png');
        this.load.image('chair-white-2-rotate3', 'assets/objects/chair-white-2-rotate3.png');
        this.load.image('chair-white-2-rotate4', 'assets/objects/chair-white-2-rotate4.png');
        this.load.image('chair-white-2-rotate5', 'assets/objects/chair-white-2-rotate5.png');
        this.load.image('chair-white-2-rotate6', 'assets/objects/chair-white-2-rotate6.png');
        this.load.image('chair-white-2-rotate7', 'assets/objects/chair-white-2-rotate7.png');
        this.load.image('chair-white-2-rotate8', 'assets/objects/chair-white-2-rotate8.png');

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
    
    // Create door opening animation
    this.anims.create({
        key: 'door_open',
        frames: this.anims.generateFrameNumbers('door_sheet', { start: 0, end: 4 }),
        frameRate: 8,
        repeat: 0
    });
    
    // Create door top animation (6th frame)
    this.anims.create({
        key: 'door_top',
        frames: [{ key: 'door_sheet', frame: 5 }],
        frameRate: 1,
        repeat: 0
    });
    
    // Create plant bump animations
    this.anims.create({
        key: 'plant-large11-bump',
        frames: [
            { key: 'plant-large11-top-ani1' },
            { key: 'plant-large11-top-ani2' },
            { key: 'plant-large11-top-ani3' },
            { key: 'plant-large11-top-ani4' }
        ],
        frameRate: 8,
        repeat: 0
    });
    
    this.anims.create({
        key: 'plant-large12-bump',
        frames: [
            { key: 'plant-large12-top-ani1' },
            { key: 'plant-large12-top-ani2' },
            { key: 'plant-large12-top-ani3' },
            { key: 'plant-large12-top-ani4' },
            { key: 'plant-large12-top-ani5' }
        ],
        frameRate: 8,
        repeat: 0
    });
    
    this.anims.create({
        key: 'plant-large13-bump',
        frames: [
            { key: 'plant-large13-top-ani1' },
            { key: 'plant-large13-top-ani2' },
            { key: 'plant-large13-top-ani3' },
            { key: 'plant-large13-top-ani4' }
        ],
        frameRate: 8,
        repeat: 0
    });
    
    // Initialize rooms system after player exists
    initializeRooms(this);
    
    // Create only the starting room initially
    const roomPositions = calculateRoomPositions(this);
    const startingRoomData = gameScenario.rooms[gameScenario.startRoom];
    const startingRoomPosition = roomPositions[gameScenario.startRoom];
    
    if (startingRoomData && startingRoomPosition) {
        createRoom(gameScenario.startRoom, startingRoomData, startingRoomPosition);
        revealRoom(gameScenario.startRoom);
    } else {
        console.error('Failed to create starting room');
    }
    
    // Position player in the starting room
    const startingRoom = rooms[gameScenario.startRoom];
    if (startingRoom) {
        const roomCenterX = startingRoom.position.x + 160; // Room width / 2 (320/2)
        const roomCenterY = startingRoom.position.y + 144; // Room height / 2 (288/2)
        player.setPosition(roomCenterX, roomCenterY);
        console.log(`Player positioned at (${roomCenterX}, ${roomCenterY}) in starting room ${gameScenario.startRoom}`);
    }
    
    // Set up camera to follow player
    this.cameras.main.startFollow(player);
    
    // Door interactions are now handled by the door sprites themselves
    
    // Initialize pathfinder
    initializePathfinder(this);
    
    // Set up input handling
    this.input.on('pointerdown', (pointer) => {
        // Check if a minigame is currently running - if so, don't process main game clicks
        if (window.MinigameFramework && window.MinigameFramework.currentMinigame) {
            console.log('Minigame is running, ignoring main game click', {
                currentMinigame: window.MinigameFramework.currentMinigame,
                minigameType: window.MinigameFramework.currentMinigame.constructor.name
            });
            return;
        }
        
        // Convert screen coordinates to world coordinates
        const worldX = this.cameras.main.scrollX + pointer.x;
        const worldY = this.cameras.main.scrollY + pointer.y;
        
        // Check for objects at the clicked position first
        const objectsAtPosition = findObjectsAtPosition(worldX, worldY);
        
        if (objectsAtPosition.length > 0) {
            // Check if any of the objects are interactable and player is in range
            const player = window.player;
            if (player) {
                const INTERACTION_RANGE_SQ = 64 * 64; // 64 pixels squared
                
                for (const obj of objectsAtPosition) {
                    if (obj.interactable) {
                        const dx = player.x - obj.x;
                        const dy = player.y - obj.y;
                        const distanceSq = dx * dx + dy * dy;
                        
                        if (distanceSq <= INTERACTION_RANGE_SQ) {
                            // Player is in range - prevent movement and trigger interaction
                            window.preventPlayerMovement = true;
                            if (window.handleObjectInteraction) {
                                window.handleObjectInteraction(obj);
                            }
                            // Reset flag after a short delay
                            setTimeout(() => {
                                window.preventPlayerMovement = false;
                            }, 100);
                            return; // Exit early after handling the first valid interaction
                        }
                    }
                }
            }
        }
        
        // Check if player movement should be prevented (e.g., clicking on interactable items)
        if (window.preventPlayerMovement) {
            return;
        }
        
        // No interactable objects found or player out of range - allow movement
        movePlayerToPoint(worldX, worldY);
    });
    
    // Initialize inventory
    initializeInventory();
    
    // Process initial inventory items
    processInitialInventoryItems();
    
    // Show introduction
    introduceScenario();
    
    // Initialize physics debug display (visual debug off by default)
    if (window.initializePhysicsDebugDisplay) {
        window.initializePhysicsDebugDisplay();
    }
    
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
    
    // Check for player bump effect when walking over floor items
    if (window.createPlayerBumpEffect) {
        window.createPlayerBumpEffect();
    }
    
    // Check for plant bump effect when player walks near animated plants
    if (window.createPlantBumpEffect) {
        window.createPlantBumpEffect();
    }
    
    // Update swivel chair rotation based on movement
    if (window.updateSwivelChairRotation) {
        window.updateSwivelChairRotation();
    }
    
    // Bluetooth device scanning is now handled by the minigame when active
}

// Bluetooth scanning is now handled by the minigame

// Helper functions

// Find all objects at a given world position
function findObjectsAtPosition(worldX, worldY) {
    const objectsAtPosition = [];
    
    // Check all rooms for objects at the given position
    Object.entries(window.rooms).forEach(([roomId, room]) => {
        if (room.objects) {
            Object.values(room.objects).forEach(obj => {
                if (obj && obj.active && obj.visible) {
                    // Check if the click is within the object's bounds
                    const objLeft = obj.x - obj.width * obj.originX;
                    const objRight = obj.x + obj.width * (1 - obj.originX);
                    const objTop = obj.y - obj.height * obj.originY;
                    const objBottom = obj.y + obj.height * (1 - obj.originY);
                    
                    if (worldX >= objLeft && worldX <= objRight && 
                        worldY >= objTop && worldY <= objBottom) {
                        objectsAtPosition.push(obj);
                    }
                }
            });
        }
    });
    
    // Sort by depth (highest depth first, so topmost objects are checked first)
    objectsAtPosition.sort((a, b) => (b.depth || 0) - (a.depth || 0));
    
    return objectsAtPosition;
}

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

 