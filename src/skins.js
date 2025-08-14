// --- SFX & Skin: START ---

// src/skins.js

// Cosmetic player overlay that follows your physics circle.

export function attachGlider(scene, player) {
  ensureGliderTexture(scene);

  const sprite = scene.add.image(player.x, player.y, "glider");

  sprite.setDepth(6).setOrigin(0.5);

  // Subtle idle bob

  let t = 0;

  function onJump() {
    scene.tweens.add({
      targets: sprite,
      scale: 1.08,
      yoyo: true,
      duration: 110,
      ease: "Quad.Out",
    });
  }

  function update(dt = 16) {
    // Follow body

    sprite.x = player.x;

    sprite.y = player.y;

    // Tilt by vertical speed

    const vy = player.body?.velocity?.y || 0;

    const tilt = Phaser.Math.Clamp(
      Phaser.Math.RadToDeg(Math.atan2(vy, 300)),
      -30,
      35
    );

    sprite.setRotation(Phaser.Math.DegToRad(tilt));

    // Gentle bob when near idle

    if (Math.abs(vy) < 30) {
      t += dt / 1000;

      sprite.y += Math.sin(t * 4) * 0.25;
    }
  }

  return { sprite, update, onJump };
}

function ensureGliderTexture(scene) {
  if (scene.textures.exists("glider")) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Body

  g.fillStyle(0xffd166, 1);

  g.fillTriangle(0, 16, 44, 0, 0, -16);

  g.lineStyle(2, 0x2b2f4a, 0.8).strokeTriangle(0, 16, 44, 0, 0, -16);

  // Wing accent

  g.lineStyle(2, 0xffffff, 0.15)
    .beginPath()

    .moveTo(10, -10)
    .lineTo(36, 0)
    .lineTo(10, 10)
    .strokePath();

  g.generateTexture("glider", 50, 38);

  g.destroy();
}

// --- SFX & Skin: END ---
