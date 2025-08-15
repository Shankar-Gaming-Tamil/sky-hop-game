// === skins.js — all visuals only (no gameplay/physics) ===

// ---------- GLIDER (unchanged, tiny bug fixed) ----------

export function attachGlider(scene, player) {
  ensureGliderTexture(scene);

  const sprite = scene.add
    .image(player.x, player.y, "glider")

    .setDepth(6)

    .setOrigin(0.5);

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
    // follow

    sprite.x = player.x;

    sprite.y = player.y;

    // tilt with velocity

    const vy = player.body?.velocity?.y || 0;

    const tilt = Phaser.Math.Clamp(
      Phaser.Math.RadToDeg(Math.atan2(vy, 300)),
      -30,
      35
    );

    sprite.setRotation(Phaser.Math.DegToRad(tilt));

    // gentle idle bob

    if (Math.abs(vy) < 30) {
      t += dt / 1000;

      sprite.y += Math.sin(t * 4) * 0.25; // <= fixed * operators
    }
  }

  return { sprite, update, onJump };
}

function ensureGliderTexture(scene) {
  if (scene.textures.exists("glider")) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xffd166, 1);

  g.fillTriangle(0, 16, 44, 0, 0, -16);

  g.lineStyle(2, 0x2b2f4a, 0.8).strokeTriangle(0, 16, 44, 0, 0, -16);

  g.lineStyle(2, 0xffffff, 0.15)

    .beginPath()
    .moveTo(10, -10)
    .lineTo(36, 0)
    .lineTo(10, 10)
    .strokePath();

  g.generateTexture("glider", 50, 38);

  g.destroy();
}

// ---------- PILLAR SKINS ----------

function ensurePillarTextures(scene) {
  if (scene.textures.exists("pillar_body")) return;

  // Body: 50x200 base, later stretched by setDisplaySize

  let g = scene.make.graphics({ x: 0, y: 0, add: false });

  const W = 50,
    H = 200,
    R = 10;

  for (let y = 0; y < H; y++) {
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x9fd6ff),

      Phaser.Display.Color.ValueToColor(0x5a88b6),

      H,
      y
    );

    g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);

    g.fillRoundedRect(0, y, W, 1, R);
  }

  g.lineStyle(2, 0xffffff, 0.06)
    .beginPath()

    .moveTo(W * 0.35, 8)
    .lineTo(W * 0.35, H - 8)
    .strokePath();

  g.generateTexture("pillar_body", W, H);

  g.destroy();

  // Cap ellipse for the gap

  g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xffffff, 0.18).fillEllipse(27, 11, 54, 22);

  g.lineStyle(2, 0xffffff, 0.12).strokeEllipse(27, 11, 50, 18);

  g.generateTexture("pillar_cap", 54, 22);

  g.destroy();
}

/**

 * Create pretty skins for two physics rectangles (top & bottom).

 * Attaches {skin, cap} onto each rect so we can sync & destroy later.

 */

export function skinPillars(
  scene,
  topRect,
  botRect,
  topH,
  botH,
  gapTopY,
  gapBotY
) {
  ensurePillarTextures(scene);

  // body sprites

  const topSkin = scene.add
    .image(topRect.x, topRect.y, "pillar_body")

    .setDepth(3.8)
    .setOrigin(0.5)
    .setDisplaySize(50, Math.max(20, topH));

  const botSkin = scene.add
    .image(botRect.x, botRect.y, "pillar_body")

    .setDepth(3.8)
    .setOrigin(0.5)
    .setDisplaySize(50, Math.max(20, botH));

  // caps at gap borders (flipY for the top)

  const topCap = scene.add
    .image(topRect.x, gapTopY, "pillar_cap")

    .setDepth(3.9)
    .setOrigin(0.5, 1)
    .setFlipY(true);

  const botCap = scene.add
    .image(botRect.x, gapBotY, "pillar_cap")

    .setDepth(3.9)
    .setOrigin(0.5, 0);

  // attach for syncing

  topRect.skin = topSkin;
  topRect.cap = topCap;

  botRect.skin = botSkin;
  botRect.cap = botCap;
}

/** Sync skins to bodies and clean up when offscreen. Call every update(). */

export function syncPillarSkins(group) {
  group?.getChildren()?.forEach((p) => {
    if (p.skin) {
      p.skin.x = p.x;
      p.skin.y = p.y;
    }

    if (p.cap) {
      p.cap.x = p.x;
    }

    if (p.x < -80) {
      p.skin?.destroy();
      p.cap?.destroy();
      p.destroy();
    }
  });
}

// ---------- SUN / MOON DISCS ----------

function ensureSkyDiscTexture(scene) {
  if (scene.textures.exists("skydisc")) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  const R = 32;

  for (let r = R; r > 0; r--) {
    const a = Phaser.Math.Linear(0.0, 1.0, r / R) * 0.9;

    g.fillStyle(0xffffff, a).fillCircle(R, R, r);
  }

  g.generateTexture("skydisc", R * 2, R * 2);

  g.destroy();
}

/** Creates sun/moon and animates them to match your day/night tween. */

export function setupSkyDiscs(scene) {
  ensureSkyDiscTexture(scene);

  const { width, height } = scene.scale;

  const sun = scene.add
    .image(width * 0.15, height * 0.18, "skydisc")

    .setTint(0xfff2a8)
    .setScale(0.65)
    .setDepth(0.95)
    .setAlpha(0.95);

  const moon = scene.add
    .image(width * 0.85, height * 0.22, "skydisc")

    .setTint(0xaad3ff)
    .setScale(0.55)
    .setDepth(0.95)
    .setAlpha(0.0);

  scene.tweens.add({
    targets: sun,
    x: width * 0.85,
    y: height * 0.18,
    duration: 18000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });

  scene.tweens.add({
    targets: moon,
    x: width * 0.15,
    y: height * 0.22,
    duration: 18000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });

  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 18000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",

    onUpdate: (tw) => {
      const a = tw.getValue();

      sun.setAlpha(0.95 * (1 - a));

      moon.setAlpha(0.9 * a);
    },
  });

  return { sun, moon };
}
