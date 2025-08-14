// Sky Hop — minimal endless jumper (Phaser 3, Arcade Physics)

// --- SFX & Skin: START ---

import { SFX } from "./sfx.js"; // NEW: tiny WebAudio SFX (no files)

import { attachGlider } from "./skins.js"; // NEW: cosmetic glider sprite

// --- SFX & Skin: END ---

class PlayScene extends Phaser.Scene {
  constructor() {
    super("play");
  }

  init() {
    this.gravity = 1100; // jump feel

    this.jumpVel = -420; // jump strength

    this.speed = 240; // world scroll speed

    this.spawnEvery = 1200; // ms between obstacles

    this.gapSize = 180; // vertical gap

    this.score = 0;

    this.best = Number(localStorage.getItem("skyhop_best") || 0);

    this.state = "ready"; // ready | playing | dead
  }

  create() {
    const { width, height } = this.scale;

    // Background gradient (your original)

    const bg = this.add.graphics();

    const top = 0x1f2342,
      bottom = 0x0e0f13;

    for (let y = 0; y < height; y++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(top),

        Phaser.Display.Color.ValueToColor(bottom),

        height,
        y
      );

      bg.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(
        0,
        y,
        width,
        1
      );
    }

    // --- STARFIELD: START ---

    // Lightweight parallax stars (visual only; no physics)

    this.stars = this.add.group();

    for (let i = 0; i < 60; i++) {
      const x = Math.random() * width;

      const y = Math.random() * height;

      const r = Math.random() * 1.5 + 0.5;

      const a = 0.4 + Math.random() * 0.6;

      const s = this.add.circle(x, y, r, 0xffffff, a).setDepth(0);

      s.speed = 0.2 + Math.random() * 0.6; // px per frame (very slow)

      this.stars.add(s);
    }

    // --- STARFIELD: END ---

    // Ground line (visual only)

    this.add
      .rectangle(width / 2, height - 24, width, 4, 0x2a2e52, 0.8)
      .setDepth(2);

    // Player (circle) — unchanged physics body

    const playerGfx = this.add
      .circle(140, height * 0.5, 18, 0xffd166)
      .setDepth(5);

    this.player = this.physics.add.existing(playerGfx).body.gameObject;

    this.player.body.setCircle(18);

    this.player.body.setCollideWorldBounds(true);

    this.player.body.setGravityY(this.gravity);

    this.player.body.setAllowGravity(false); // until we start

    // --- SFX & Skin: START ---

    // Attach a cosmetic glider sprite that follows the circle

    this.view = attachGlider(this, this.player); // NEW

    // --- SFX & Skin: END ---

    // Obstacle group (pillars + flags)

    this.obstacles = this.add.group();

    // UI

    this.scoreText = this.add
      .text(width / 2, 48, "0", {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",

        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.bestText = this.add
      .text(width - 12, 12, `Best: ${this.best}`, {
        fontFamily: "system-ui",
        fontSize: "16px",
        color: "#bfc7ff",
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.msg = this.add
      .text(width / 2, height * 0.5, "Tap to Start", {
        fontFamily: "system-ui",
        fontSize: "28px",
        color: "#bfc7ff",
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Input

    this.input.keyboard.on("keydown-SPACE", () => this.handleJump());

    this.input.on("pointerdown", () => this.handleJump());

    // Spawner (paused until start)

    this.spawnTimer = this.time.addEvent({
      delay: this.spawnEvery,
      loop: true,
      paused: true,
      callback: () => this.spawnObstacle(),
    });

    // Collider with obstacles (pillars kill, flags don't)

    this.physics.add.overlap(
      this.player,
      this.obstacles,
      (_player, obstacle) => {
        // Using tag is safer than width check; if missing, fallback to width !== 2

        if (obstacle.isFlag) return; // NEW: ignore score flag

        if (obstacle.width === 2) return; // fallback safety

        this.onDie();
      }
    );
  }

  start() {
    if (this.state !== "ready") return;

    this.state = "playing";

    this.msg.setText("");

    this.player.body.setAllowGravity(true);

    // --- SFX & Skin: START ---

    SFX.start(); // NEW: tiny start beep

    // --- SFX & Skin: END ---

    this.spawnTimer.paused = false;

    this.tweens.add({
      targets: this.player,
      scale: 1.05,
      yoyo: true,
      duration: 250,
      repeat: 2,
    });
  }

  handleJump() {
    if (this.state === "ready") this.start();

    if (this.state !== "playing") return;

    this.player.body.setVelocityY(this.jumpVel);

    this.cameras.main.shake(40, 0.002);

    // --- SFX & Skin: START ---

    SFX.jump(); // NEW: jump blip

    this.view?.onJump?.(); // NEW: tiny scale bounce

    // --- SFX & Skin: END ---
  }

  spawnObstacle() {
    const { width, height } = this.scale;

    // Margin from top and bottom to ensure gap is always achievable

    const margin = 100;

    const gap = this.gapSize; // fixed gap for consistency

    const center = Phaser.Math.Between(
      margin + gap / 2,
      height - margin - gap / 2
    );

    const topH = center - gap / 2;

    const botY = center + gap / 2;

    const botH = height - botY;

    const color = 0x8ecae6;

    // Pillars (lethal)

    const top = this.add
      .rectangle(width + 30, topH / 2, 50, topH, color)
      .setDepth(4);

    const bot = this.add
      .rectangle(width + 30, botY + botH / 2, 50, botH, color)
      .setDepth(4);

    this.physics.add.existing(top);
    this.physics.add.existing(bot);

    top.body.setImmovable(true);
    bot.body.setImmovable(true);

    top.body.setVelocityX(-this.speed);
    bot.body.setVelocityX(-this.speed);

    this.obstacles.addMultiple([top, bot]);

    // Score flag (non-lethal) — tagged

    const flag = this.add.rectangle(
      width + 30 + 25,
      0,
      2,
      this.scale.height,
      0x000000,
      0
    );

    this.physics.add.existing(flag);

    flag.body.setImmovable(true);

    flag.body.setVelocityX(-this.speed);

    flag.passed = false;

    flag.isFlag = true; // NEW: explicit tag

    this.obstacles.add(flag);
  }

  update(time, delta) {
    // --- STARFIELD: START ---

    // Scroll stars even on the title screen for ambience

    if (this.stars) {
      this.stars.getChildren().forEach((star) => {
        star.x -= star.speed;

        if (star.x < -10) star.x = this.scale.width + 10;
      });
    }

    // --- STARFIELD: END ---

    if (this.state !== "playing") return;

    // Keep the cosmetic sprite synced + tilted

    // --- SFX & Skin: START ---

    this.view?.update?.(delta); // NEW

    // --- SFX & Skin: END ---

    // Remove offscreen + score on flag pass

    this.obstacles.getChildren().forEach((obj) => {
      if (obj.x < -80) {
        obj.destroy();
        return;
      }

      if (!obj.passed && obj.isFlag && obj.x < this.player.x) {
        obj.passed = true;

        this.score++;

        this.scoreText.setText(this.score);

        // --- SCORE POP: START ---

        this.tweens.add({
          targets: this.scoreText,
          scale: 1.2,
          yoyo: true,

          duration: 100,
          ease: "Quad.easeInOut",
        });

        // --- SCORE POP: END ---

        // --- SFX & Skin: START ---

        SFX.score(); // NEW: two-note ding

        // --- SFX & Skin: END ---

        obj.destroy(); // optional cleanup
      }
    });

    // OOB death (keep your original rule)

    if (this.player.y > this.scale.height - 10 || this.player.y < 0)
      this.onDie();
  }

  onDie() {
    if (this.state !== "playing") return;

    this.state = "dead";

    this.spawnTimer.paused = true;

    // --- SFX & Skin: START ---

    SFX.hit(); // NEW: hit thud/noise

    // --- SFX & Skin: END ---

    // Freeze everything

    this.obstacles.getChildren().forEach((o) => o.body?.setVelocityX?.(0));

    this.player.body.setVelocity(0);

    // Best handling

    if (this.score > this.best) {
      this.best = this.score;

      localStorage.setItem("skyhop_best", String(this.best));
    }

    this.bestText.setText(`Best: ${this.best}`);

    // Game over UI (unchanged)

    const { width, height } = this.scale;

    const panel = this.add

      .rectangle(
        width / 2,
        height / 2,
        Math.min(360, width * 0.9),
        180,
        0x14162a,
        0.95
      )

      .setDepth(20);

    this.add
      .text(panel.x, panel.y - 40, "Game Over", {
        fontFamily: "system-ui",
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.add
      .text(panel.x, panel.y, `Score: ${this.score}`, {
        fontFamily: "system-ui",
        fontSize: "22px",
        color: "#bfc7ff",
      })
      .setOrigin(0.5)
      .setDepth(21);

    const btn = this.add
      .text(panel.x, panel.y + 42, "Play Again", {
        fontFamily: "system-ui",
        fontSize: "20px",
        color: "#ffffff",

        backgroundColor: "#5865f2",
        padding: { left: 16, right: 16, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });

    btn.on("pointerdown", () => this.scene.restart());

    this.input.keyboard.once("keydown-SPACE", () => this.scene.restart());

    this.input.once("pointerdown", () => this.scene.restart());
  }
}

const config = {
  type: Phaser.AUTO,

  parent: "game",

  backgroundColor: "#0e0f13",

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 480,
    height: 800,
  },

  physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },

  scene: [PlayScene],
};

new Phaser.Game(config);
