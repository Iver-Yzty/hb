/* ============================================================
   BirthdayMusic — 纯 Web Audio 合成的轻快生日纯音乐
   手风琴感的暖垫 + 木吉他式拨弦 + 音乐盒旋律 + 轻沙锤
   无需任何音频文件，所有浏览器本地合成。
   ============================================================ */
(function () {
  "use strict";

  var midiToFreq = function (m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  };

  var BPM = 90;
  var BEAT = 60 / BPM;

  /* F — C/E — Dm — Bb — F — C — Bb — C */
  var CHORDS = [
    { bass: 41, tones: [53, 60, 65, 69] },
    { bass: 40, tones: [52, 55, 60, 64] },
    { bass: 38, tones: [50, 57, 62, 65] },
    { bass: 34, tones: [46, 53, 58, 62] },
    { bass: 41, tones: [53, 60, 65, 69] },
    { bass: 36, tones: [48, 55, 60, 64] },
    { bass: 34, tones: [46, 53, 58, 62] },
    { bass: 36, tones: [48, 55, 60, 64] }
  ];

  /* [midi, startBeat, durationBeats] × 16 bars */
  var MELODY = [
    [[69,0,.5],[72,.5,.5],[77,1,1],[76,2,.5],[72,2.5,.5],[69,3,1]],
    [[67,0,.5],[72,.5,.5],[76,1,1],[74,2,.5],[72,2.5,.5],[67,3,1]],
    [[65,0,.5],[69,.5,.5],[74,1,1],[72,2,.5],[69,2.5,.5],[65,3,1]],
    [[70,0,.5],[74,.5,.5],[77,1,1],[76,2,.5],[74,2.5,.5],[70,3,1]],
    [[69,0,.5],[72,.5,.5],[77,1,1],[79,2,.5],[77,2.5,.5],[72,3,1]],
    [[70,0,.5],[72,.5,.5],[76,1,1],[79,2,.5],[76,2.5,.5],[72,3,1]],
    [[74,0,.5],[77,.5,.5],[82,1,1],[81,2,.5],[79,2.5,.5],[76,3,1]],
    [[77,0,1.5],[72,1.5,.5],[69,2,1],[65,3,1]],
    [[72,0,.5],[74,.5,.5],[77,1,1],[79,2,.5],[77,2.5,.5],[72,3,1]],
    [[76,0,.5],[74,.5,.5],[72,1,1],[67,2,.5],[72,2.5,.5],[76,3,1]],
    [[74,0,.5],[72,.5,.5],[69,1,1],[65,2,.5],[69,2.5,.5],[74,3,1]],
    [[70,0,1],[74,1,.5],[77,1.5,.5],[79,2,1],[74,3,1]],
    [[77,0,1],[79,1,.5],[81,1.5,.5],[82,2,1.5],[77,3.5,.5]],
    [[79,0,1],[76,1,.5],[74,1.5,.5],[72,2,1],[67,3,1]],
    [[74,0,.5],[77,.5,.5],[82,1,1],[81,2,.5],[79,2.5,.5],[77,3,1]],
    [[76,0,1],[79,1,1],[84,2,1.5]]
  ];

  function BirthdayMusic() {
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.bus = null;
    this.reverb = null;
    this.wet = null;
    this.chimeBus = null;
    this.noiseBuf = null;
    this.timer = null;
    this.playing = false;
    this.bar = 0;
    this.nextTime = 0;
    this.supported = !!(window.AudioContext || window.webkitAudioContext);

    var self = this;
    document.addEventListener("visibilitychange", function () {
      if (!self.ctx || !self.playing) return;
      if (document.hidden) {
        if (self.ctx.state === "running") self.ctx.suspend().catch(function () {});
      } else {
        if (self.ctx.state === "suspended") self.ctx.resume().catch(function () {});
      }
    });
  }

  BirthdayMusic.prototype._build = function () {
    var ctx = this.ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -20;
    this.comp.knee.value = 26;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.28;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);

    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.master);

    /* reverb */
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.0, 2.6);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4600;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.34;
    this.reverb.connect(lp);
    lp.connect(this.wet);
    this.wet.connect(this.master);

    /* chime bypasses the music volume so it is audible when toggling off */
    this.chimeBus = ctx.createGain();
    this.chimeBus.gain.value = 0.9;
    this.chimeBus.connect(this.comp);

    this.noiseBuf = this._noise(0.12);
  };

  BirthdayMusic.prototype._impulse = function (seconds, decay) {
    var rate = this.ctx.sampleRate;
    var len = Math.floor(rate * seconds);
    var buf = this.ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  };

  BirthdayMusic.prototype._noise = function (seconds) {
    var rate = this.ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = this.ctx.createBuffer(1, len, rate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  };

  BirthdayMusic.prototype._route = function (node, wet, dest) {
    node.connect(dest || this.bus);
    if (wet > 0) {
      var send = this.ctx.createGain();
      send.gain.value = wet;
      node.connect(send);
      send.connect(this.reverb);
    }
  };

  BirthdayMusic.prototype._env = function (t, attack, decay, peak) {
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  };

  BirthdayMusic.prototype._pluck = function (freq, t, peak, dur) {
    var ctx = this.ctx;
    peak = peak || 0.03;
    dur = dur || 1.0;

    var filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.Q.value = 0.8;
    filt.frequency.setValueAtTime(3200, t);
    filt.frequency.exponentialRampToValueAtTime(620, t + dur);

    var g = this._env(t, 0.006, dur, peak);

    var o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = freq;

    var o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.004;
    var o2g = ctx.createGain();
    o2g.gain.value = 0.22;

    o1.connect(filt);
    o2.connect(o2g);
    o2g.connect(filt);
    filt.connect(g);
    this._route(g, 0.22);

    var stop = t + dur + 0.08;
    o1.start(t); o2.start(t);
    o1.stop(stop); o2.stop(stop);
  };

  BirthdayMusic.prototype._bell = function (freq, t, peak, dur, dest) {
    var ctx = this.ctx;
    peak = peak || 0.06;
    dur = dur || 1.5;

    var g = this._env(t, 0.004, dur, peak);
    this._route(g, 0.4, dest);

    var partials = [
      [1, 1, 1],
      [2.01, 0.26, 0.72],
      [3.02, 0.12, 0.5],
      [4.98, 0.05, 0.34]
    ];

    for (var i = 0; i < partials.length; i++) {
      var mult = partials[i][0];
      var amp = partials[i][1];
      var dscale = partials[i][2];
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * mult;
      var pg = ctx.createGain();
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.linearRampToValueAtTime(amp, t + 0.006);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + dur * dscale + 0.05);
      o.connect(pg);
      pg.connect(g);
      o.start(t);
      o.stop(t + dur + 0.12);
    }
  };

  BirthdayMusic.prototype._pad = function (notes, t, dur, peak) {
    var ctx = this.ctx;
    peak = peak || 0.018;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.55);
    g.gain.setValueAtTime(peak, t + Math.max(0.6, dur - 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.15);

    var filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 1250;
    filt.Q.value = 0.35;
    filt.connect(g);
    this._route(g, 0.5);

    for (var i = 0; i < notes.length; i++) {
      var o = ctx.createOscillator();
      o.type = i % 2 === 0 ? "triangle" : "sine";
      o.frequency.value = midiToFreq(notes[i]);
      o.detune.value = (i - 1) * 4;
      var og = ctx.createGain();
      og.gain.value = 1 / notes.length;
      o.connect(og);
      og.connect(filt);
      o.start(t);
      o.stop(t + dur + 1.3);
    }
  };

  BirthdayMusic.prototype._shaker = function (t, peak) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6800;
    var g = this._env(t, 0.002, 0.055, peak || 0.007);
    src.connect(hp);
    hp.connect(g);
    this._route(g, 0.05);
    src.start(t);
    src.stop(t + 0.09);
  };

  BirthdayMusic.prototype._playBar = function (barIndex, t) {
    var chord = CHORDS[barIndex % 8];
    var melody = MELODY[barIndex % MELODY.length];

    this._pluck(midiToFreq(chord.bass), t, 0.05, 1.15);
    this._pluck(midiToFreq(chord.bass + 7), t + 2 * BEAT, 0.028, 0.95);

    var pattern = barIndex % 2 === 0
      ? [0, 2, 1, 3, 2, 1, 2, 3]
      : [0, 1, 2, 3, 2, 1, 0, 1];
    for (var i = 0; i < 8; i++) {
      var idx = pattern[i];
      var note = chord.tones[idx] + (i === 7 && barIndex % 4 === 3 ? 12 : 0);
      this._pluck(midiToFreq(note), t + i * BEAT / 2, 0.027, 0.82);
    }

    this._pad(
      [chord.tones[0] - 12, chord.tones[1], chord.tones[2]],
      t,
      BEAT * 4 - 0.2,
      0.017
    );

    for (var j = 0; j < melody.length; j++) {
      var n = melody[j];
      var d = Math.max(0.9, n[2] * BEAT + 0.75);
      this._bell(midiToFreq(n[0]), t + n[1] * BEAT, 0.065, d);
    }

    if (barIndex % 2 === 1) {
      this._bell(midiToFreq(chord.tones[3] + 12), t + 3.5 * BEAT, 0.018, 1.1);
    }

    this._shaker(t + BEAT, 0.0055);
    this._shaker(t + BEAT * 3, 0.007);
  };

  BirthdayMusic.prototype._tick = function () {
    if (!this.playing || !this.ctx || this.ctx.state !== "running") return;
    while (this.nextTime < this.ctx.currentTime + 0.6) {
      this._playBar(this.bar, this.nextTime);
      this.nextTime += BEAT * 4;
      this.bar = (this.bar + 1) % 16;
    }
  };

  BirthdayMusic.prototype.ensure = function () {
    if (!this.supported) return Promise.reject(new Error("Web Audio unsupported"));
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._build();
    }
    if (this.ctx.state === "suspended") return this.ctx.resume();
    return Promise.resolve();
  };

  BirthdayMusic.prototype.start = function () {
    var self = this;
    if (!this.supported) return Promise.resolve(false);
    return this.ensure().then(function () {
      if (self.playing) return true;
      self.playing = true;
      self.bar = 0;
      self.nextTime = self.ctx.currentTime + 0.18;
      var t = self.ctx.currentTime;
      self.master.gain.cancelScheduledValues(t);
      self.master.gain.setValueAtTime(Math.max(0.0001, self.master.gain.value), t);
      self.master.gain.linearRampToValueAtTime(0.82, t + 1.6);
      self.timer = setInterval(function () { self._tick(); }, 70);
      self._tick();
      return true;
    }).catch(function (err) {
      console.warn("Music start failed:", err);
      return false;
    });
  };

  BirthdayMusic.prototype.stop = function () {
    if (!this.playing || !this.ctx) return;
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    var t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.55);
  };

  BirthdayMusic.prototype.chime = function () {
    var self = this;
    var play = function () {
      var t = self.ctx.currentTime + 0.02;
      self._bell(midiToFreq(84), t, 0.1, 1.35, self.chimeBus);
      self._bell(midiToFreq(91), t + 0.085, 0.075, 1.6, self.chimeBus);
      self._bell(midiToFreq(96), t + 0.17, 0.045, 1.8, self.chimeBus);
    };
    if (!this.ctx) {
      this.ensure().then(play).catch(function () {});
    } else {
      this.ensure().then(play).catch(function () {});
    }
  };

  window.BirthdayMusic = BirthdayMusic;
})();
