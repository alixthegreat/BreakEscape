// Sprite selection UI:
// - Grid of static headshot images (HTML)
// - 160x160 Phaser canvas showing breathing-idle of selected sprite

const PREVIEW_SIZE = 160;

// Map UI sprite key to actual atlas filename (must match files in characters/)
// woman_bow -> woman_blowse (filename in assets); others use same name
const SPRITE_ATLAS_FILENAME = {
  'woman_bow': 'woman_blowse'
};
function atlasFilename(spriteKey) {
  return SPRITE_ATLAS_FILENAME[spriteKey] || spriteKey;
}

let phaserGame = null;
let currentPreviewSprite = null;
let initialSelectedSprite = null;

export function initializeSpritePreview(sprites, selectedSprite) {
  console.log('🎨 Initializing sprite preview...', { sprites: sprites.length, selectedSprite });
  initialSelectedSprite = selectedSprite || null;

  class PreviewScene extends Phaser.Scene {
    constructor() {
      super({ key: 'Preview' });
    }

    create() {
      if (initialSelectedSprite) {
        loadAndShowSprite(this, initialSelectedSprite);
      }
      // Listen for radio changes
      const form = document.getElementById('preference-form');
      if (form) {
        const radios = form.querySelectorAll('input[type="radio"][name*="selected_sprite"]');
        radios.forEach(radio => {
          radio.addEventListener('change', (e) => {
            const sprite = e.target.value;
            loadAndShowSprite(this, sprite);
          });
        });
      }
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'sprite-preview-canvas-container',
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    transparent: true,
    scale: {
      mode: Phaser.Scale.NONE
    },
    scene: [PreviewScene]
  };

  phaserGame = new Phaser.Game(config);
}

function loadAndShowSprite(scene, spriteKey) {
  const filename = atlasFilename(spriteKey);
  const atlasPath = `/break_escape/assets/characters/${filename}.png`;
  const jsonPath = `/break_escape/assets/characters/${filename}.json`;

  // Remove previous preview sprite
  if (currentPreviewSprite) {
    currentPreviewSprite.destroy();
    currentPreviewSprite = null;
  }

  if (scene.textures.exists(spriteKey)) {
    showSpriteInPreview(scene, spriteKey);
    return;
  }

  scene.load.atlas(spriteKey, atlasPath, jsonPath);
  scene.load.once('complete', () => {
    showSpriteInPreview(scene, spriteKey);
  });
  scene.load.start();
}

function showSpriteInPreview(scene, spriteKey) {
  if (currentPreviewSprite) {
    currentPreviewSprite.destroy();
  }

  const x = PREVIEW_SIZE / 2;
  const y = PREVIEW_SIZE / 2;

  currentPreviewSprite = scene.add.sprite(x, y, spriteKey);
  currentPreviewSprite.setDisplaySize(PREVIEW_SIZE, PREVIEW_SIZE);

  const animKey = `${spriteKey}-preview-south`;
  if (!scene.anims.exists(animKey)) {
    const texture = scene.textures.get(spriteKey);
    const frameNames = texture.getFrameNames();

    // Prefer breathing-idle_south; fallback to walk_south (e.g. male_office_worker has no breathing-idle)
    const prefixes = ['breathing-idle_south_frame_', 'walk_south_frame_'];
    let frames = [];
    for (const prefix of prefixes) {
      frames = frameNames.filter(f => f.startsWith(prefix));
      if (frames.length > 0) break;
    }

    if (frames.length > 0) {
      frames.sort((a, b) => {
        const aNum = parseInt(a.match(/frame_(\d+)/)?.[1] || '0');
        const bNum = parseInt(b.match(/frame_(\d+)/)?.[1] || '0');
        return aNum - bNum;
      });

      scene.anims.create({
        key: animKey,
        frames: frames.map(frameName => ({ key: spriteKey, frame: frameName })),
        frameRate: 8,
        repeat: -1
      });

      currentPreviewSprite.play(animKey);
    } else {
      // No south animation (e.g. some atlases use different naming) – show first frame
      const firstFrame = frameNames[0];
      if (firstFrame) currentPreviewSprite.setFrame(firstFrame);
    }
  } else {
    currentPreviewSprite.play(animKey);
  }

  console.log('✓ Preview updated:', spriteKey);
}
