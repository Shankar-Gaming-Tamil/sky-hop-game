// --- SFX & Skin: START ---

// src/sfx.js

// Ultra light SFX using WebAudio (no audio files). Call SFX.start(), SFX.jump(), SFX.score(), SFX.hit().

export const SFX = {
  _ctx: null,

  _master: null,

  _defaultGain: 0.2, // NEW: remember default gain

  _init() {
    if (this._ctx) return;

    const AC = window.AudioContext || window.webkitAudioContext;

    this._ctx = new AC();

    this._master = this._ctx.createGain();

    this._master.gain.value = this._defaultGain;

    this._master.connect(this._ctx.destination);
  },

  async _resume() {
    this._init();

    if (this._ctx.state !== "running") {
      try {
        await this._ctx.resume();
      } catch {}
    }
  },

  // NEW: simple mute toggle that persists master volume

  setMuted(muted) {
    this._init();

    this._master.gain.value = muted ? 0 : this._defaultGain;
  },

  _beep({ freq = 880, dur = 0.08, type = "sine", gain = 0.25, slide = 0 }) {
    this._init();

    const t0 = this._ctx.currentTime;

    const osc = this._ctx.createOscillator();

    const g = this._ctx.createGain();

    osc.type = type;

    osc.frequency.setValueAtTime(freq, t0);

    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);

    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);

    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(this._master);

    osc.start(t0);

    osc.stop(t0 + dur + 0.02);
  },

  _noise({ dur = 0.12, gain = 0.2 }) {
    this._init();

    const len = Math.floor(44100 * dur);

    const buf = this._ctx.createBuffer(1, len, 44100);

    const data = buf.getChannelData(0);

    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = this._ctx.createBufferSource();

    src.buffer = buf;

    const g = this._ctx.createGain();

    const t0 = this._ctx.currentTime;

    g.gain.setValueAtTime(gain, t0);

    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(g).connect(this._master);

    src.start();
  },

  async start() {
    await this._resume();

    this._beep({
      freq: 520,
      dur: 0.06,
      type: "triangle",
      gain: 0.18,
      slide: 60,
    });
  },

  jump() {
    this._resume();

    this._beep({ freq: 740, dur: 0.06, type: "square", gain: 0.18, slide: 60 });
  },

  score() {
    this._resume();

    this._beep({ freq: 900, dur: 0.05, type: "sine", gain: 0.2 });

    setTimeout(
      () => this._beep({ freq: 1200, dur: 0.05, type: "sine", gain: 0.18 }),
      45
    );
  },

  hit() {
    this._resume();

    this._noise({ dur: 0.12, gain: 0.22 });

    this._beep({
      freq: 220,
      dur: 0.12,
      type: "sawtooth",
      gain: 0.22,
      slide: -80,
    });
  },
};

// --- SFX & Skin: END ---
