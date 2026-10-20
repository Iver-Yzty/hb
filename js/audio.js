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

  function BirthdayMusic(opts) {
    this.volume = opts && typeof opts.volume === "number" ? opts.volume : 0.82;
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
    /* 手机上一路实时合成的并发振荡器越多，音频线程越容易来不及；
       轻量模式少一层泛音，听感差别很小，CPU 却能省下三分之一 */
    this.lite =
      opts && typeof opts.lite === "boolean"
        ? opts.lite
        : /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(
            navigator.userAgent || "",
          );
    this.lookahead = this.lite ? 2.2 : 1.4;
    this.tickMs = this.lite ? 200 : 140;
    this.voices = [];
    this.sends = null;

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

    this._buildReverb();

    /* chime bypasses the music volume so it is audible when toggling off */
    this.chimeBus = ctx.createGain();
    this.chimeBus.gain.value = 0.9;
    this.chimeBus.connect(this.comp);

    this.noiseBuf = this._noise(0.12);
  };

  /* 算法混响：四条带阻尼反馈的短延迟（Schroeder 梳状结构）。
     以前用的是 1.8 秒卷积，听感更“贵”，但卷积会一直占着音频线程，
     手机上正是它把实时合成的余量吃光、导致音乐断断续续；
     换成延迟反馈后尾音依旧柔和，持续开销却几乎可以忽略。 */
  BirthdayMusic.prototype._buildReverb = function () {
    var ctx = this.ctx;

    this.reverb = ctx.createGain(); // 混响输入
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.3;
    this.wet.connect(this.master);

    var combs = [
      { time: 0.0437, fb: 0.74, pan: 0 },
      { time: 0.0571, fb: 0.72, pan: 1 },
      { time: 0.0703, fb: 0.7, pan: 0 },
      { time: 0.0911, fb: 0.68, pan: 1 },
    ];

    var merger = ctx.createChannelMerger(2);
    var sum = ctx.createGain();
    sum.gain.value = 0.85;
    merger.connect(sum);
    sum.connect(this.wet);

    for (var i = 0; i < combs.length; i++) {
      var c = combs[i];
      var delay = ctx.createDelay(0.3);
      delay.delayTime.value = c.time;

      /* 每绕一圈衰减一点高频：尾音越拖越暗，比纯延迟自然 */
      var damp = ctx.createBiquadFilter();
      damp.type = "lowpass";
      damp.frequency.value = 2800 - i * 260;
      damp.Q.value = 0.4;

      var fb = ctx.createGain();
      fb.gain.value = c.fb;

      this.reverb.connect(delay);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);
      damp.connect(merger, 0, c.pan);
    }
  };

  BirthdayMusic.prototype._noise = function (seconds) {
    var rate = this.ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = this.ctx.createBuffer(1, len, rate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  };

  /* 每个音都新建一个混响送出节点太浪费，同一条送出量共用一只即可 */
  BirthdayMusic.prototype._send = function (wet) {
    if (!this.sends) this.sends = {};
    var key = wet.toFixed(2);
    var send = this.sends[key];
    if (!send) {
      send = this.ctx.createGain();
      send.gain.value = wet;
      send.connect(this.reverb);
      this.sends[key] = send;
    }
    return send;
  };

  BirthdayMusic.prototype._route = function (node, wet, dest) {
    node.connect(dest || this.bus);
    if (wet > 0) node.connect(this._send(wet));
  };

  /* 记住正在排队的音源，关掉音乐时能立刻收声，
     也避免重新开启后旧排程与新排程叠在一起 */
  BirthdayMusic.prototype._track = function (node, end) {
    this.voices.push({ node: node, end: end });
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
    o1.connect(filt);

    var stop = t + dur + 0.08;
    o1.start(t);
    o1.stop(stop);
    this._track(o1, stop);

    /* 高八度的那层泛音只负责一点亮色，手机上去掉它省一个振荡器 */
    if (!this.lite) {
      var o2 = ctx.createOscillator();
      o2.type = "sine";
      o2.frequency.value = freq * 2.004;
      var o2g = ctx.createGain();
      o2g.gain.value = 0.22;
      o2.connect(o2g);
      o2g.connect(filt);
      o2.start(t);
      o2.stop(stop);
      this._track(o2, stop);
    }

    filt.connect(g);
    this._route(g, 0.22);
  };

  BirthdayMusic.prototype._bell = function (freq, t, peak, dur, dest) {
    var ctx = this.ctx;
    peak = peak || 0.06;
    dur = dur || 1.5;

    var g = this._env(t, 0.004, dur, peak);
    this._route(g, 0.4, dest);

    /* 第四泛音听感贡献有限；轻量模式下第三泛音也可以省掉，
       每个音符就少一个振荡器 */
    var partials = [
      [1, 1, 1],
      [2.01, 0.26, 0.72],
      [3.02, 0.12, 0.5]
    ];
    if (this.lite) partials.length = 2;

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
      this._track(o, t + dur + 0.12);
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
      this._track(o, t + dur + 1.3);
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
    this._track(src, t + 0.09);
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
    if (!this.playing || !this.ctx) return;

    /* 来电、锁屏、切到别的 app 之后，iOS / 部分安卓浏览器会把上下文
       停在 interrupted / suspended，自己不会回来。页面可见时轻推一下，
       恢复后把排程游标拉回当前时间，音乐就能接着响 */
    if (this.ctx.state !== "running") {
      if (this.ctx.state === "closed" || document.hidden) return;
      var self = this;
      var nowMs = Date.now();
      if (!this._resumeAt || nowMs - this._resumeAt > 1200) {
        this._resumeAt = nowMs;
        this.ctx.resume().then(function () {
          if (self.playing && self.ctx.state === "running") {
            self.nextTime = self.ctx.currentTime + 0.12;
          }
        }).catch(function () {});
      }
      return;
    }

    var now = this.ctx.currentTime;
    /* 自动播放被拦、页面切走或长时间挂起后，nextTime 可能停在很久以前；
       直接追帧会瞬间排出一大串音符，这里把它拉回当前时间 */
    if (this.nextTime < now - 0.2) {
      this.nextTime = now + 0.05;
    }

    /* 清掉已经结束的音源，数组不会越攒越长 */
    if (this.voices.length > 64) {
      var alive = [];
      for (var i = 0; i < this.voices.length; i++) {
        if (this.voices[i].end > now) alive.push(this.voices[i]);
      }
      this.voices = alive;
    }

    /* 排得比主线程最坏的一次卡顿还远：手机上画蛋糕、动画同时跑，
       主线程偶尔几百毫秒不响应也不会漏音符 */
    while (this.nextTime < now + this.lookahead) {
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
    /* iOS 被来电 / 其他 app 打断时会停在 interrupted，也要拉回来 */
    if (this.ctx.state !== "running" && this.ctx.state !== "closed") {
      return this.ctx.resume();
    }
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
      self.master.gain.linearRampToValueAtTime(self.volume, t + 1.6);
      /* 每 tick 排好后面两秒多的音符，间隔放到 200ms，主线程压力更小 */
      self.timer = setInterval(function () { self._tick(); }, self.tickMs);
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

    /* 未来两秒多已经排好的音符一起收掉：
       否则重新开启时，旧排程会和新排程叠在一起响 */
    var cut = t + 0.06;
    for (var i = 0; i < this.voices.length; i++) {
      try {
        this.voices[i].node.stop(cut);
      } catch (err) {}
    }
    this.voices.length = 0;
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
