/* ============================================================
   FX — canvas 金色微尘 / 金箔雨 / 手绘烟花
   ============================================================ */
(function () {
  "use strict";

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var GOLD = ["#FFD166", "#FFE7AD", "#FFF7E3", "#F3E8FF", "#E6C280", "#FFC078"];
  var TAU = Math.PI * 2;

  function FX(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0;
    this.h = 0;
    this.parts = [];
    this.night = false;
    this.last = performance.now();
    this.acc = 0;
    this.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.sprite = this._sprite();
    this._resize = this._resize.bind(this);
    this._loop = this._loop.bind(this);
    window.addEventListener("resize", this._resize);
    this._resize();
    requestAnimationFrame(this._loop);
  }

  FX.prototype._sprite = function () {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.28, "rgba(255,246,220,.85)");
    grad.addColorStop(0.6, "rgba(255,220,150,.28)");
    grad.addColorStop(1, "rgba(255,210,120,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  };

  FX.prototype._resize = function () {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + "px";
    this.canvas.style.height = this.h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  FX.prototype.setNight = function (night) {
    this.night = !!night;
  };

  /* ---------------- particles ---------------- */

  FX.prototype._addDust = function (opts) {
    opts = opts || {};
    var night = this.night;
    this.parts.push({
      type: "dust",
      x: opts.x != null ? opts.x : rand(0, this.w),
      y: opts.y != null ? opts.y : this.h + rand(0, 20),
      vx: opts.vx != null ? opts.vx : rand(-0.08, 0.08),
      vy: opts.vy != null ? opts.vy : (night ? rand(-18, -5) : rand(-24, -8)),
      size: opts.size != null ? opts.size : (night ? rand(0.8, 2.6) : rand(0.8, 2.1)),
      life: 0,
      max: opts.max != null ? opts.max : rand(9, 18),
      phase: rand(0, TAU),
      twinkle: rand(1.1, 2.4),
      wob: rand(4, 16),
      alpha: opts.alpha != null ? opts.alpha : (night ? rand(0.45, 0.95) : rand(0.22, 0.5))
    });
    if (this.parts.length > 520) this.parts.splice(0, this.parts.length - 520);
  };

  FX.prototype.goldRain = function (count) {
    count = count || 70;
    var night = this.night;
    for (var i = 0; i < count; i++) {
      var flake = Math.random() < 0.34;
      this.parts.push({
        type: flake ? "flake" : "dust",
        x: rand(-20, this.w + 20),
        y: rand(-this.h * 0.9, -10),
        vx: rand(-12, 12),
        vy: flake ? rand(38, 100) : rand(10, 32),
        size: flake ? rand(1.4, 3.4) : rand(0.8, 2.4),
        rot: rand(0, TAU),
        vr: rand(-1.4, 1.4),
        life: 0,
        max: rand(5, 11),
        phase: rand(0, TAU),
        twinkle: rand(1, 2.2),
        wob: rand(4, 18),
        alpha: night ? rand(0.5, 0.95) : rand(0.35, 0.7)
      });
    }
  };

  FX.prototype._burst = function (x, y, count, power) {
    count = count || 70;
    power = power || 1;

    this.parts.push({
      type: "flash",
      x: x, y: y,
      size: 46 * power,
      life: 0,
      max: 0.42
    });

    for (var i = 0; i < count; i++) {
      var ang = rand(0, TAU);
      var sp = rand(46, 250) * power;
      this.parts.push({
        type: "spark",
        x: x, y: y,
        px: x, py: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0,
        max: rand(0.75, 1.65),
        color: pick(GOLD),
        width: rand(0.9, 2.2),
        grav: rand(55, 105),
        drag: rand(0.972, 0.988)
      });
    }

    for (var j = 0; j < Math.round(count * 0.22); j++) {
      var a2 = rand(0, TAU);
      var s2 = rand(18, 90) * power;
      this.parts.push({
        type: "twinkle",
        x: x, y: y,
        vx: Math.cos(a2) * s2,
        vy: Math.sin(a2) * s2,
        life: 0,
        max: rand(1.2, 2.4),
        size: rand(1.2, 2.8),
        color: pick(GOLD),
        grav: 22,
        drag: 0.985
      });
    }
  };

  FX.prototype.firework = function (x, y, power) {
    this._burst(x, y, Math.round(rand(65, 95)), power || 1);
  };

  FX.prototype.starShower = function (count) {
    count = count || 40;
    for (var i = 0; i < count; i++) {
      this.parts.push({
        type: "star",
        x: rand(0, this.w),
        y: rand(-this.h * 0.55, -16),
        vx: rand(-16, 16),
        vy: rand(40, 120),
        size: rand(1.8, 4.2),
        rot: rand(0, TAU),
        vr: rand(-2.2, 2.2),
        life: 0,
        max: rand(4, 8),
        color: pick(GOLD)
      });
    }
  };

  FX.prototype.celebrate = function (x, y) {
    var self = this;
    var cx = x != null ? x : this.w / 2;
    var cy = y != null ? y : this.h * 0.42;

    this._burst(cx, cy, 95, 1.15);
    this.starShower(46);

    setTimeout(function () {
      self._burst(self.w * 0.24, self.h * 0.3, 70, 0.95);
    }, 260);
    setTimeout(function () {
      self._burst(self.w * 0.77, self.h * 0.26, 78, 1.0);
    }, 520);
    setTimeout(function () {
      self._burst(self.w * 0.5, self.h * 0.2, 60, 0.85);
    }, 800);
    setTimeout(function () {
      self._burst(self.w * 0.35, self.h * 0.36, 46, 0.75);
      self._burst(self.w * 0.68, self.h * 0.4, 46, 0.75);
    }, 1250);
    setTimeout(function () {
      self.starShower(28);
    }, 1750);
  };

  /* ---------------- render ---------------- */

  FX.prototype._drawStar = function (ctx, x, y, r, rot, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var rr = i % 2 === 0 ? r : r * 0.34;
      var a = i * Math.PI / 4 - Math.PI / 2;
      var px = Math.cos(a) * rr;
      var py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  FX.prototype._loop = function (now) {
    var dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    var ctx = this.ctx;
    var night = this.night;
    var reduced = this.reduced;

    ctx.clearRect(0, 0, this.w, this.h);

    if (!reduced) {
      this.acc += dt;
      if (this.acc >= 0.16) {
        this.acc = 0;
        if (this.parts.length < 320) this._addDust();
      }
    }

    /* dust & flakes (day: normal; night: additive) */
    ctx.globalCompositeOperation = night ? "lighter" : "source-over";

    var i, p;

    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts.splice(i, 1); continue; }

      if (p.type === "dust") {
        p.x += (p.vx * 60 + Math.sin(p.life * 0.8 + p.phase) * p.wob * dt);
        p.y += p.vy * dt;
        var tw = 0.55 + 0.45 * Math.sin(p.life * p.twinkle + p.phase);
        var fade = clamp(p.life / 0.8, 0, 1) * clamp((p.max - p.life) / 1.2, 0, 1);
        var a = p.alpha * tw * fade;
        var col = night ? "255,226,170" : "198,152,76";
        ctx.fillStyle = "rgba(" + col + "," + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
        if (p.size > 1.7) {
          ctx.globalAlpha = a * 0.5;
          ctx.drawImage(this.sprite, p.x - p.size * 5, p.y - p.size * 5, p.size * 10, p.size * 10);
          ctx.globalAlpha = 1;
        }
      } else if (p.type === "flake") {
        p.x += (p.vx + Math.sin(p.life * 1.4 + p.phase) * 22) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        var fa = p.alpha * clamp(p.life / 0.5, 0, 1) * clamp((p.max - p.life) / 1.4, 0, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = fa;
        ctx.fillStyle = night ? "#FFE3A6" : "#C99B54";
        ctx.fillRect(-p.size * 0.5, -p.size * 1.1, p.size, p.size * 2.2);
        ctx.restore();
      } else if (p.type === "spark") {
        p.px = p.x;
        p.py = p.y;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        var sa = clamp(1 - p.life / p.max, 0, 1);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = sa;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * (0.4 + sa * 0.8);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.type === "twinkle") {
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        var ta = clamp(1 - p.life / p.max, 0, 1);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = ta * (0.6 + 0.4 * Math.sin(p.life * 14));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.type === "star") {
        p.x += (p.vx + Math.sin(p.life * 2 + p.rot) * 14) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        var sta = clamp(p.life / 0.3, 0, 1) * clamp((p.max - p.life) / 1.2, 0, 1);
        ctx.globalCompositeOperation = "lighter";
        this._drawStar(ctx, p.x, p.y, p.size, p.rot, p.color, sta);
      } else if (p.type === "flash") {
        var fa2 = 1 - p.life / p.max;
        var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, "rgba(255,246,220," + (fa2 * 0.9).toFixed(3) + ")");
        grad.addColorStop(0.4, "rgba(255,214,140," + (fa2 * 0.4).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(255,200,110,0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(this._loop);
  };

  window.FX = FX;
})();
