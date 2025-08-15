// Sky Hop — Phaser 3 (Arcade)

import { SFX } from "./sfx.js";

import {
  attachGlider,
  skinPillars,
  syncPillarSkins,
  setupSkyDiscs,
} from "./skins.js";

class PlayScene extends Phaser.Scene {
  constructor() {
    super("play");
  }

  init() {
    this.gravity = 1100;

    this.jumpVel = -420;

    this.speedBase = 240;

    this.speed = this.speedBase;

    this.spawnEvery = 1200;

    this.gapBase = 180;

    this.gapSize = this.gapBase;

    this.score = 0;

    this.best = Number(localStorage.getItem("skyhop_best") || 0);

    this.state = "ready"; // ready | playing | paused | dead
  }

  create() {
    const { width, height } = this.scale;

    // BACKGROUND GRADIENT

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

    // STARFIELD

    this.stars = this.add.group();

    for (let i = 0; i < 60; i++) {
      const s = this.add

        .circle(
          Math.random() * width,

          Math.random() * height,

          Math.random() * 1.5 + 0.5,

          0xffffff,

          0.4 + Math.random() * 0.6
        )

        .setDepth(0);

      s.speed = 0.2 + Math.random() * 0.6;

      this.stars.add(s);
    }

    // DAY/NIGHT OVERLAY + CLOUDS

    this.skyOverlay = this.add

      .rectangle(width / 2, height / 2, width, height, 0x0a1230, 0)

      .setDepth(1);

    this.tweens.add({
      targets: this.skyOverlay,

      alpha: 0.5,

      duration: 18000,

      yoyo: true,

      repeat: -1,

      ease: "Sine.inOut",
    });

    setupSkyDiscs(this); // sun & moon

    this.clouds = this.add.group();

    const spawnCloud = (xInit = null) => {
      const y = Phaser.Math.Between(40, height - 180);

      const rx = Phaser.Math.Between(50, 110);

      const ry = Phaser.Math.Between(18, 36);

      const alpha = Phaser.Math.FloatBetween(0.18, 0.32);

      const speed = Phaser.Math.FloatBetween(0.25, 0.6);

      const x = xInit ?? width + rx + 20;

      const c = this.add.ellipse(x, y, rx, ry, 0xffffff, alpha).setDepth(1.1);

      c._speed = speed;

      this.clouds.add(c);
    };

    for (let i = 0; i < 7; i++) spawnCloud(Phaser.Math.Between(0, width));

    this.time.addEvent({
      delay: 3000,

      loop: true,

      callback: () => spawnCloud(),
    });

    // GROUND

    this.add

      .rectangle(width / 2, height - 24, width, 4, 0x2a2e52, 0.8)

      .setDepth(2);

    // PLAYER

    const playerGfx = this.add

      .circle(140, height * 0.5, 18, 0xffd166)

      .setDepth(5);

    this.player = this.physics.add.existing(playerGfx).body.gameObject;

    this.player.body.setCircle(18);

    this.player.body.setCollideWorldBounds(true);

    this.player.body.setGravityY(this.gravity);

    this.player.body.setAllowGravity(false);

    this.view = attachGlider(this, this.player);

    // TRAIL (manual)

    if (!this.textures.exists("trailDot")) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });

      g.fillStyle(0xffd166, 1).fillCircle(4, 4, 4);

      g.generateTexture("trailDot", 8, 8);

      g.destroy();
    }

    this.trailPool = this.add.group({
      classType: Phaser.GameObjects.Image,

      maxSize: 150,

      runChildUpdate: false,
    });

    const spawnTrail = (burst = 3) => {
      for (let i = 0; i < burst; i++) {
        const img = this.trailPool.get();

        if (!img) break;

        img

          .setTexture("trailDot")

          .setDepth(4)

          .setBlendMode(Phaser.BlendModes.ADD)

          .setAlpha(0.95)

          .setScale(Phaser.Math.FloatBetween(0.9, 1.2))

          .setPosition(
            this.player.x - Phaser.Math.Between(6, 12),

            this.player.y + Phaser.Math.Between(-10, 10)
          )

          .setActive(true)

          .setVisible(true);

        this.tweens.add({
          targets: img,

          alpha: 0,

          scale: 0.2,

          duration: 420,

          onComplete: () => {
            img.setActive(false).setVisible(false);

            this.trailPool.killAndHide(img);
          },
        });
      }
    };

    this.trailTimer = this.time.addEvent({
      delay: 26,

      loop: true,

      paused: true,

      callback: () => spawnTrail(3),
    });

    // OBSTACLES GROUP

    this.obstacles = this.add.group();

    // UI

    this.scoreText = this.add

      .text(width / 2, 64, "0", {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",

        fontSize: "48px",

        color: "#ffffff",
      })

      .setOrigin(0.5)

      .setDepth(10);

    this.bestBg = this.add

      .rectangle(0, 0, 62, 28, 0x000000, 0.25)

      .setDepth(9)

      .setOrigin(1, 0);

    this.bestText = this.add

      .text(0, 0, `Best: ${this.best}`, {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#c8d0ff",
      })

      .setOrigin(1, 0)

      .setDepth(10);

    const placeBest = () => {
      const pad = 10,
        x = this.scale.width - pad,
        y = 12;

      this.bestText.setPosition(x, y);

      const b = this.bestText.getBounds();

      this.bestBg.setPosition(x, y - 2).setSize(b.width + 12, b.height + 8);
    };

    placeBest();

    this.time.delayedCall(50, placeBest);

    this.time.delayedCall(250, placeBest);

    this.placeBest = placeBest;

    this.pauseBg = this.add

      .rectangle(width / 2, 10, 40, 30, 0x000000, 0.25)

      .setOrigin(0.5, 0)

      .setDepth(9)

      .setVisible(false);

    this.pauseBtn = this.add

      .text(width / 2, 12, "⏸", {
        fontFamily: "system-ui",

        fontSize: "22px",

        color: "#ffffff",
      })

      .setOrigin(0.5, 0)

      .setDepth(12)

      .setInteractive({ useHandCursor: true })

      .setVisible(false);

    this.pauseBtn.on("pointerdown", (p) => {
      p.event?.stopPropagation?.();

      if (this.state === "playing") this.pauseGame();
      else if (this.state === "paused") this.resumeGame();
    });

    const uiStyle = {
      fontFamily: "system-ui",

      fontSize: "18px",

      color: "#ffffff",
    };

    this.isMuted = localStorage.getItem("skyhop_mute") === "1";

    SFX.setMuted?.(this.isMuted);

    this.muteBtn = this.add

      .text(12, 14, this.isMuted ? "🔇" : "🔊", uiStyle)

      .setDepth(12)

      .setOrigin(0, 0)

      .setInteractive({ useHandCursor: true });

    this.muteBtn.on("pointerdown", (p) => {
      p.event?.stopPropagation?.();

      this.isMuted = !this.isMuted;

      localStorage.setItem("skyhop_mute", this.isMuted ? "1" : "0");

      SFX.setMuted?.(this.isMuted);

      this.muteBtn.setText(this.isMuted ? "🔇" : "🔊");
    });

    this.gearBtn = this.add

      .text(44, 14, "⚙", uiStyle)

      .setDepth(12)

      .setOrigin(0, 0)

      .setInteractive({ useHandCursor: true });

    this.gearBtn.on("pointerdown", (p) => {
      p.event?.stopPropagation?.();

      this.toggleSettings();
    });

    this.msg = this.add

      .text(width / 2, height * 0.5, "Tap to Start", {
        fontFamily: "system-ui",

        fontSize: "28px",

        color: "#bfc7ff",
      })

      .setOrigin(0.5)

      .setDepth(10);

    // INPUT

    this.input.keyboard.on("keydown-SPACE", () => this.handleJump());

    this.input.on("pointerdown", (pointer) => {
      if (this._hit(pointer, this.muteBtn)) return;

      if (this.pauseBtn.visible && this._hit(pointer, this.pauseBtn)) return;

      if (
        this.settingsOpen &&
        this.settingsPanel?.getBounds().contains(pointer.x, pointer.y)
      )
        return;

      this.handleJump();
    });

    this.input.keyboard.on("keydown-P", () => {
      if (this.state === "playing") this.pauseGame();
      else if (this.state === "paused") this.resumeGame();
    });

    this.input.keyboard.on("keydown-M", () => {
      this.muteBtn.emit("pointerdown", { event: { stopPropagation() {} } });
    });

    this.input.keyboard.on("keydown-G", () => {
      this.toggleSettings();
    });

    // SPAWNER

    this.spawnTimer = this.time.addEvent({
      delay: this.spawnEvery,

      loop: true,

      paused: true,

      callback: () => this.spawnObstacle(),
    });

    // COLLISION

    this.physics.add.overlap(
      this.player,

      this.obstacles,

      (_player, obstacle) => {
        if (obstacle.isFlag) return;

        if (obstacle.width === 2) return;

        this.onDie();
      }
    );

    // RESPONSIVE

    this.scale.on("resize", (gameSize) => this.onResize(gameSize));
  }

  _hit(pointer, obj) {
    const r = obj.getBounds();

    return (
      pointer.x >= r.x &&
      pointer.x <= r.right &&
      pointer.y >= r.y &&
      pointer.y <= r.bottom
    );
  }

  toggleSettings() {
    if (this.settingsOpen) {
      this.settingsPanel?.destroy();

      this.settingsPanel = null;

      this.settingsOpen = false;

      if (this._pausedBySettings) {
        this._pausedBySettings = false;

        this.resumeGame();
      }

      return;
    }

    this._pausedBySettings = false;

    if (this.state === "playing") {
      this.pauseGame();

      this._pausedBySettings = true;
    }

    const { width, height } = this.scale;

    const panelW = Math.min(300, width * 0.9),
      panelH = 180;

    const x = width / 2 - panelW / 2,
      y = height / 2 - panelH / 2;

    const bg = this.add

      .rectangle(x, y, panelW, panelH, 0x14162a, 0.96)

      .setOrigin(0, 0)

      .setDepth(30);

    bg.setStrokeStyle(2, 0x5865f2, 1);

    const title = this.add

      .text(x + panelW / 2, y + 16, "Settings", {
        fontFamily: "system-ui",

        fontSize: "20px",

        color: "#ffffff",
      })

      .setOrigin(0.5, 0)

      .setDepth(31);

    const sfxLabel = this.add

      .text(x + 16, y + 54, "SFX Mute (M)", {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#ffffff",
      })

      .setDepth(31);

    const sfxState = this.add

      .text(x + panelW - 16, y + 54, this.isMuted ? "OFF" : "ON", {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#bfc7ff",
      })

      .setOrigin(1, 0)

      .setDepth(31);

    const gfxLabel = this.add

      .text(x + 16, y + 84, "Low Graphics", {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#ffffff",
      })

      .setDepth(31);

    const lowGfx = localStorage.getItem("skyhop_lowgfx") === "1";

    const gfxState = this.add

      .text(x + panelW - 16, y + 84, lowGfx ? "ON" : "OFF", {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#bfc7ff",
      })

      .setOrigin(1, 0)

      .setDepth(31);

    const reset = this.add

      .text(x + 16, y + 114, "Reset Best", {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#ffb4b4",
      })

      .setDepth(31);

    const close = this.add

      .text(x + panelW / 2, y + panelH - 14, "Close (G)", {
        fontFamily: "system-ui",

        fontSize: "16px",

        color: "#ffffff",
      })

      .setOrigin(0.5, 1)

      .setDepth(31);

    sfxLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.isMuted = !this.isMuted;

      localStorage.setItem("skyhop_mute", this.isMuted ? "1" : "0");

      SFX.setMuted?.(this.isMuted);

      this.muteBtn.setText(this.isMuted ? "🔇" : "🔊");

      sfxState.setText(this.isMuted ? "OFF" : "ON");
    });

    gfxLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      const now = !(localStorage.getItem("skyhop_lowgfx") === "1");

      localStorage.setItem("skyhop_lowgfx", now ? "1" : "0");

      gfxState.setText(now ? "ON" : "OFF");

      if (now) {
        const trim = (grp) =>
          grp?.getChildren()?.forEach((o, i) => {
            if (i % 2 === 0) o.setVisible(false);
          });

        trim(this.stars);

        trim(this.clouds);
      } else {
        this.stars?.getChildren()?.forEach((o) => o.setVisible(true));

        this.clouds?.getChildren()?.forEach((o) => o.setVisible(true));
      }
    });

    reset.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.best = 0;

      localStorage.setItem("skyhop_best", "0");

      this.bestText.setText(`Best: ${this.best}`);

      this.placeBest();
    });

    close

      .setInteractive({ useHandCursor: true })

      .on("pointerdown", () => this.toggleSettings());

    this.settingsPanel = this.add

      .container(0, 0, [
        bg,

        title,

        sfxLabel,

        sfxState,

        gfxLabel,

        gfxState,

        reset,

        close,
      ])

      .setDepth(30);

    this.settingsOpen = true;
  }

  pauseGame() {
    if (this.state !== "playing") return;

    this.state = "paused";

    this.physics.world.pause();

    this.spawnTimer.paused = true;

    this.trailTimer.paused = true;

    this.pauseBtn.setText("▶");

    this.msg.setText("Paused");
  }

  resumeGame() {
    if (this.state !== "paused") return;

    this.state = "playing";

    this.physics.world.resume();

    this.spawnTimer.paused = false;

    this.trailTimer.paused = false;

    this.pauseBtn.setText("⏸");

    this.msg.setText("");
  }

  applyDifficulty() {
    const steps = Math.floor(this.score / 5);

    this.speed = this.speedBase + steps * 8;

    this.gapSize = Math.max(150, this.gapBase - steps * 3);
  }

  start() {
    if (this.state !== "ready") return;

    this.state = "playing";

    this.msg.setText("");

    this.player.body.setAllowGravity(true);

    try {
      SFX.start();
    } catch {}

    this.spawnTimer.paused = false;

    this.trailTimer.paused = false;

    this.pauseBtn.setVisible(true);

    this.pauseBg.setVisible(true);

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

    try {
      SFX.jump();
    } catch {}

    this.view?.onJump?.();
  }

  // SPAWN OBSTACLE

  spawnObstacle() {
    const { width, height } = this.scale;

    const margin = 100;

    const gap = this.gapSize;

    const center = Phaser.Math.Between(
      margin + gap / 2,

      height - margin - gap / 2
    );

    const topH = center - gap / 2;

    const botY = center + gap / 2;

    const botH = height - botY;

    const top = this.add

      .rectangle(width + 30, topH / 2, 50, topH, 0xffffff)

      .setDepth(4);

    const bot = this.add

      .rectangle(width + 30, botY + botH / 2, 50, botH, 0xffffff)

      .setDepth(4);

    this.physics.add.existing(top);

    this.physics.add.existing(bot);

    [top, bot].forEach((p) => {
      p.body.setImmovable(true);

      p.body.setAllowGravity(false);

      p.body.setVelocityX(-this.speed);

      p.body.setSize(p.width - 4, p.height, true);
    });

    this.obstacles.addMultiple([top, bot]);

    // attach pillar skins (body + caps)

    skinPillars(this, top, bot, topH, botH, center - gap / 2, center + gap / 2);

    // scoring flag (gap only)

    const flag = this.add.rectangle(
      width + 30 + 25,

      center,

      2,

      gap,

      0x000000,

      0
    );

    this.physics.add.existing(flag);

    flag.body.setImmovable(true);

    flag.body.setAllowGravity(false);

    flag.body.setVelocityX(-this.speed);

    flag.passed = false;

    flag.isFlag = true;

    this.obstacles.add(flag);
  }

  update(time, delta) {
    // ambient

    this.stars?.getChildren()?.forEach((star) => {
      star.x -= star.speed;

      if (star.x < -10) star.x = this.scale.width + 10;
    });

    this.clouds?.getChildren()?.forEach((c) => {
      c.x -= c._speed;

      if (c.x < -120) {
        c.x = this.scale.width + Phaser.Math.Between(30, 120);

        c.y = Phaser.Math.Between(40, this.scale.height - 180);

        c._speed = Phaser.Math.FloatBetween(0.25, 0.6);

        c.setAlpha(Phaser.Math.FloatBetween(0.18, 0.32));
      }
    });

    if (this.state !== "playing") return;

    this.view?.update?.(delta);

    // keep pillar skins synced and cleanup offscreen pillars

    syncPillarSkins(this.obstacles);

    // flag cleanup + scoring

    this.obstacles.getChildren().forEach((obj) => {
      if (obj.isFlag) {
        if (obj.x < -80) {
          obj.destroy();

          return;
        }

        if (!obj.passed && obj.x < this.player.x) {
          obj.passed = true;

          this.score++;

          this.scoreText.setText(this.score);

          this.tweens.add({
            targets: this.scoreText,

            scale: 1.2,

            yoyo: true,

            duration: 100,

            ease: "Quad.easeInOut",
          });

          try {
            SFX.score();
          } catch {}

          this.applyDifficulty();

          obj.destroy();
        }
      }
    });

    if (this.player.y > this.scale.height - 10 || this.player.y < 0)
      this.onDie();
  }

  onDie() {
    if (this.state !== "playing") return;

    this.state = "dead";

    this.spawnTimer.paused = true;

    this.trailTimer.paused = true;

    try {
      SFX.hit();
    } catch {}

    this.obstacles.getChildren().forEach((o) => o.body?.setVelocityX?.(0));

    this.player.body.setVelocity(0);

    if (this.score > this.best) {
      this.best = this.score;

      localStorage.setItem("skyhop_best", String(this.best));
    }

    this.bestText.setText(`Best: ${this.best}`);

    this.placeBest();

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

  onResize(gameSize) {
    const width = gameSize.width,
      height = gameSize.height;

    this.scoreText?.setPosition(width / 2, 64);

    this.msg?.setPosition(width / 2, height * 0.5);

    const pad = 10;

    this.bestText?.setPosition(width - pad, 12);

    if (this.bestBg) {
      this.bestBg.setPosition(width - pad, 10);

      this.bestBg.width = (this.bestText?.width || 100) + 12;

      this.bestBg.height = (this.bestText?.height || 18) + 8;
    }

    this.pauseBtn?.setPosition(width / 2, 12);

    this.pauseBg?.setPosition(width / 2, 10);
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
