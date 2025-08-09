// Sky Hop — endless runner with Wind Dash (double-tap) + orb meter
// Fixes:
// - Pillars reliably spawn (immediate spawn on start + steady timer)
// - Correct gap sizing (clamped) so player can pass
// - Death & Game Over panel restored
// - Flags are score-only (no death collision)

class PlayScene extends Phaser.Scene {
  constructor(){ super('play'); }

  init(){
    // Core tuning
    this.gravity = 1150;
    this.jumpVel = -420;
    this.baseSpeed = 240;
    this.speed = this.baseSpeed;

    this.spawnEvery = 1100;      // ms between spawns
    this.startImmediate = true;  // spawn a pair as soon as run starts

    this.gapStart = 200;         // starting gap
    this.gapMin = 140;           // minimum gap (player radius ~18 => leave buffer)
    this.pipeWidth = 60;

    this.score = 0;
    this.best = Number(localStorage.getItem('skyhop_best') || 0);

    this.state = 'ready';        // ready | playing | paused | dead

    // Wind Dash
    this.orbs = 0;
    this.orbsMax = 3;
    this.invincible = false;
    this.lastTap = 0;
  }

  create(){
    const { width:w, height:h } = this.scale;

    // Background gradient
    this.drawGradient(0x1b2a4a, 0x0b0f1a);

    // Parallax clouds
    this.clouds = this.add.group();
    for (let i=0;i<6;i++) this.addCloud(true);
    this.time.addEvent({ delay: 2200, loop: true, callback: () => this.addCloud(false) });

    // Ground hint
    this.add.rectangle(w/2, h-26, w, 4, 0x1e2b47, 0.9).setDepth(2);

    // Player (glider)
    this.makeGliderTexture();
    const player = this.add.image(140, h*0.52, 'glider').setDepth(8);
    player.setOrigin(0.2, 0.5);
    this.player = this.physics.add.existing(player).body.gameObject;
    this.player.body.setCircle(18, 2, 2);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setGravityY(this.gravity);
    this.player.body.setAllowGravity(false);

    // Physics groups
    this.killers = this.physics.add.group();   // pillars (death)
    this.flags  = this.physics.add.group();    // score lines
    this.pickups = this.physics.add.group();   // wind orbs

    // UI
    this.scoreText = this.add.text(w/2, 52, '0', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '48px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(20);

    this.bestText = this.add.text(w - 12, 12, `Best: ${this.best}`, {
      fontFamily: 'system-ui', fontSize: '16px', color: '#bfc7ff'
    }).setOrigin(1,0).setDepth(20);

    this.msg = this.add.text(w/2, h*0.5, 'Tap to Start', {
      fontFamily: 'system-ui', fontSize: '28px', color: '#bfc7ff'
    }).setOrigin(0.5).setDepth(20);

    // Orb meter (3 dots)
    this.meterDots = [];
    for(let i=0;i<this.orbsMax;i++){
      const dot = this.add.circle(20 + i*14, 20, 5, 0x6ea8ff, 0.9).setDepth(20);
      this.meterDots.push(dot);
    }
    this.updateMeter();

    // Inputs
    this.input.keyboard.on('keydown-SPACE', () => this.onTap());
    this.input.on('pointerdown', () => this.onTap());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.onclick = () => this.togglePause();

    // Colliders
    this.physics.add.overlap(this.player, this.killers, () => this.hitObstacle());
    this.physics.add.overlap(this.player, this.pickups, (_p, orb) => this.collectOrb(orb));
    // Flags: score-only

    // Spawner (start paused; we’ll unpause on start)
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnEvery,
      loop: true,
      paused: true,
      callback: () => this.spawnObstaclePair()
    });
  }

  // ===== Helpers =====
  drawGradient(topHex, bottomHex){
    const { width:w, height:h } = this.scale;
    const bg = this.add.graphics();
    for (let y=0;y<h;y++){
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(topHex),
        Phaser.Display.Color.ValueToColor(bottomHex),
        h, y
      );
      bg.fillStyle(Phaser.Display.Color.GetColor(c.r,c.g,c.b)).fillRect(0,y,w,1);
    }
  }

  addCloud(initial=false){
    const { width:w, height:h } = this.scale;
    const y = Phaser.Math.Between(40, h-160);
    const r = Phaser.Math.Between(18, 42);
    const layer = Phaser.Math.Between(0,1); // 0 back, 1 front
    const alpha = layer ? 0.25 : 0.15;
    const speed = layer ? -30 : -18;

    const c = this.add.ellipse(initial ? Phaser.Math.Between(0,w) : w+50, y, r*2.2, r*1.4, 0xffffff, alpha);
    this.physics.add.existing(c);
    c.body.setVelocityX(speed);
    c.setDepth(layer?1:0);
    this.clouds.add(c);
  }

  makeGliderTexture(){
    const g = this.add.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffd166, 1);
    g.fillTriangle(0, 18, 40, 0, 0, -18);
    g.lineStyle(2, 0x2c2f48, 0.6).strokeTriangle(0, 18, 40, 0, 0, -18);
    g.generateTexture('glider', 48, 40); g.destroy();
  }

  // ===== Input =====
  onTap(){
    const now = this.time.now;
    const dt = now - this.lastTap;
    this.lastTap = now;

    if (this.state === 'ready') this.start();
    if (this.state !== 'playing') return;

    // Double-tap within 250ms triggers Wind Dash if charged
    if (dt < 250 && this.orbs >= this.orbsMax && !this.invincible){
      this.windDash(); return;
    }

    // Normal jump
    this.player.body.setVelocityY(this.jumpVel);
    this.player.setRotation(Phaser.Math.DegToRad(-12));
    this.tweens.add({ targets: this.player, rotation: 0, duration: 240, ease: 'Sine.Out' });
    this.cameras.main.shake(28, 0.002);
  }

  togglePause(){
    if (this.state === 'playing'){
      this.state = 'paused';
      this.physics.world.pause();
      this.spawnTimer.paused = true;
      const btn = document.getElementById('pauseBtn'); if (btn) btn.textContent = '▶ Resume';
      this.msg.setText('Paused (press P)');
    } else if (this.state === 'paused'){
      this.state = 'playing';
      this.physics.world.resume();
      this.spawnTimer.paused = false;
      const btn = document.getElementById('pauseBtn'); if (btn) btn.textContent = '⏸ Pause';
      this.msg.setText('');
    }
  }

  // ===== State =====
  start(){
    if (this.state!=='ready') return;
    this.state = 'playing';
    this.msg.setText('');
    this.player.body.setAllowGravity(true);
    this.runStartTime = this.time.now;

    // Immediate first pillars so the run has a challenge right away
    if (this.startImmediate) this.spawnObstaclePair();
    this.spawnTimer.paused = false;
  }

  windDash(){
    this.player.body.setVelocityY(-760);
    this.invincible = true;
    this.player.setAlpha(0.6).setTint(0x9ad0ff);
    this.orbs = 0; this.updateMeter();
    this.time.delayedCall(800, ()=>{
      this.invincible = false;
      this.player.setAlpha(1).clearTint();
    });
    this.cameras.main.flash(120, 154, 197, 255);
  }

  collectOrb(orb){
    if (!orb.active) return;
    orb.destroy();
    this.orbs = Math.min(this.orbsMax, this.orbs + 1);
    this.updateMeter();
    this.tweens.add({ targets: this.player, scale: 1.08, yoyo: true, duration: 120, ease: 'Quad.Out' });
  }

  updateMeter(){
    for(let i=0;i<this.meterDots.length;i++){
      this.meterDots[i].setFillStyle(i < this.orbs ? 0x9ad0ff : 0x3b4a78, i < this.orbs ? 1 : 0.9);
      this.meterDots[i].setScale(i < this.orbs ? 1.2 : 1.0);
    }
  }

  // ===== Spawning =====
  spawnObstaclePair(){
    const { width:w, height:h } = this.scale;

    // Difficulty ramp: increase speed & shrink gap over time
    const elapsed = (this.time.now - this.runStartTime) / 1000;
    this.speed = this.baseSpeed + elapsed * 6;                   // gradual speed up
    const gapTarget = Math.max(this.gapMin, this.gapStart - elapsed * 2);
    const gap = Phaser.Math.Clamp(Phaser.Math.Between(gapTarget-16, gapTarget+16), this.gapMin, this.gapStart);

    // Choose a center ensuring both pipes >= 40px tall
    const minSection = 40;
    const margin = minSection + 20;
    const center = Phaser.Math.Between(margin + gap/2, h - (margin + gap/2));

    const topH = Math.floor(center - gap/2);
    const botY = Math.floor(center + gap/2);
    const botH = Math.floor(h - botY);

    const color = 0x8ecae6;
    const wPipe = this.pipeWidth;

    // Top & bottom pillars
    const top = this.add.rectangle(w + 40, topH/2, wPipe, topH, color).setDepth(6);
    const bot = this.add.rectangle(w + 40, botY + botH/2, wPipe, botH, color).setDepth(6);
    this.physics.add.existing(top);  this.physics.add.existing(bot);
    top.body.setImmovable(true);     bot.body.setImmovable(true);
    top.body.setVelocityX(-this.speed); bot.body.setVelocityX(-this.speed);

    // Add to killers group (death)
    this.killers.addMultiple([top, bot]);

    // Score flag (thin invisible line after pillars)
    const flag = this.add.rectangle(w + 40 + wPipe/2 + 2, 0, 2, h, 0x000000, 0).setDepth(1);
    this.physics.add.existing(flag);
    flag.body.setImmovable(true);
    flag.body.setVelocityX(-this.speed);
    flag.passed = false;
    this.flags.add(flag);

    // 40% chance to spawn Wind Orb inside gap
    if (Phaser.Math.FloatBetween(0,1) < 0.4){
      const orbY = Phaser.Math.Clamp(center + Phaser.Math.Between(-gap/3, gap/3), 40, h-60);
      const orb = this.add.circle(w + 40 + wPipe + 40, orbY, 10, 0x9ad0ff, 1).setDepth(7);
      this.physics.add.existing(orb);
      orb.body.setImmovable(true);
      orb.body.setVelocityX(-this.speed);
      this.pickups.add(orb);
    }
  }

  // ===== Per-frame =====
  update(time, dt){
    if (this.state!=='playing') return;

    // Cleanup & scoring
    this.killers.getChildren().forEach(obj => { if (obj.x < -120) obj.destroy(); });
    this.flags.getChildren().forEach(flag => {
      if (flag.x < -120) flag.destroy();
      if (!flag.passed && flag.x < this.player.x){
        flag.passed = true;
        this.score++;
        this.scoreText.setText(this.score);
      }
    });
    this.pickups.getChildren().forEach(o => { if (o.x < -120) o.destroy(); });

    // Fail if outside
    if (this.player.y > this.scale.height - 6 || this.player.y < 0) this.onDie();
  }

  hitObstacle(){
    if (this.invincible || this.state!=='playing') return;
    this.onDie();
  }

  onDie(){
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.spawnTimer.paused = true;

    // stop things
    [...this.killers.getChildren(), ...this.flags.getChildren(), ...this.pickups.getChildren()]
      .forEach(o => o.body?.setVelocityX?.(0));
    this.player.body.setVelocity(0);

    // best
    if (this.score > this.best){
      this.best = this.score;
      localStorage.setItem('skyhop_best', String(this.best));
    }
    this.bestText.setText(`Best: ${this.best}`);

    // UI
    const { width:w, height:h } = this.scale;
    const panel = this.add.rectangle(w/2, h/2, Math.min(380, w*0.9), 190, 0x141a2f, 0.96).setDepth(30);
    this.add.text(panel.x, panel.y - 48, 'Game Over', {
      fontFamily: 'system-ui', fontSize: '28px', color: '#ffffff'
    }).setOrigin(0.5).setDepth(31);
    this.add.text(panel.x, panel.y - 12, `Score: ${this.score}`, {
      fontFamily: 'system-ui', fontSize: '22px', color: '#bfc7ff'
    }).setOrigin(0.5).setDepth(31);

    const msg = (this.orbs >= this.orbsMax) ? 'Double‑tap to Wind Dash!' : 'Collect 3 orbs for Dash';
    this.add.text(panel.x, panel.y + 14, msg, {
      fontFamily: 'system-ui', fontSize: '16px', color: '#9bb3ff'
    }).setOrigin(0.5).setDepth(31);

    const btn = this.add.text(panel.x, panel.y + 52, 'Play Again', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#ffffff',
      backgroundColor: '#5865f2', padding: {left:16,right:16,top:8,bottom:8}
    }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor:true });

    btn.on('pointerdown', () => this.scene.restart());
    this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    this.input.once('pointerdown', () => this.scene.restart());
  }
}

// ===== Game bootstrap =====
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f1a',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 480, height: 800 },
  physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
  scene: [PlayScene]
};

new Phaser.Game(config);
