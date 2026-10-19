/* ============================================================
   Oct 20 · Welcome to 23 — interactions
   ============================================================ */
(function () {
  "use strict";

  var cfg = window.BIRTHDAY_CONFIG || {};
  var app = document.getElementById("app");
  var cover = document.getElementById("cover");
  var invitation = document.getElementById("invitation");
  var coverHint = document.getElementById("coverHint");
  var musicBtn = document.getElementById("musicToggle");
  var progress = document.getElementById("progress");
  var finale = document.getElementById("finale");
  var blowZone = document.getElementById("blowZone");
  var blowHint = document.getElementById("blowHint");

  var sections = Array.prototype.slice.call(app.querySelectorAll(".scene"));
  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var music = new window.BirthdayMusic();
  var fx = new window.FX(document.getElementById("fx"));

  var opened = false;
  var current = 0;

  /* ---------------- content config ---------------- */

  document.querySelectorAll('[data-name="her"]').forEach(function (el) {
    el.textContent = cfg.herName || "亲爱的你";
  });
  document.querySelectorAll('[data-name="you"]').forEach(function (el) {
    el.textContent = cfg.yourName || "永远爱你的人";
  });
  document.querySelectorAll("[data-birthday]").forEach(function (el) {
    el.textContent = cfg.birthdayLabel || "2026.10.20";
  });

  /* ---------------- photos ---------------- */

  document.querySelectorAll("img[data-photo]").forEach(function (img) {
    var key = img.getAttribute("data-photo");
    var src = cfg.photos && cfg.photos[key];
    if (!src) return;

    img.addEventListener("load", function () {
      img.hidden = false;
      requestAnimationFrame(function () {
        img.classList.add("is-loaded");
      });
    });
    img.addEventListener("error", function () {
      img.hidden = true;
    });
    img.src = src;
  });

  /* ---------------- chapter 3 sparkles ---------------- */

  document.querySelectorAll(".sparkle-field").forEach(function (field) {
    for (var i = 0; i < 9; i++) {
      var s = document.createElement("span");
      s.style.left = (7 + Math.random() * 86).toFixed(1) + "%";
      s.style.top = (5 + Math.random() * 90).toFixed(1) + "%";
      s.style.setProperty("--t", (2.4 + Math.random() * 3.4).toFixed(2) + "s");
      s.style.setProperty("--d", (-Math.random() * 5.5).toFixed(2) + "s");
      field.appendChild(s);
    }
  });

  /* ---------------- progress nav ---------------- */

  var navDots = [];
  sections.forEach(function (sec, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", sec.getAttribute("data-title") || "第 " + (i + 1) + " 页");
    b.addEventListener("click", function () { goTo(i); });
    progress.appendChild(b);
    navDots.push(b);
  });

  var navTimer = null;

  function stopNav() {
    if (navTimer) {
      clearTimeout(navTimer);
      navTimer = null;
    }
    app.classList.remove("is-navigating");
  }

  function goTo(index) {
    var sec = sections[index];
    if (!sec) return;

    var start = app.scrollTop;
    var target = sec.offsetTop;
    var dist = target - start;

    if (navTimer) {
      clearTimeout(navTimer);
      navTimer = null;
    }
    if (Math.abs(dist) < 2) {
      setActive(index);
      return;
    }

    if (reduced) {
      app.scrollTop = target;
      setActive(index);
      return;
    }

    /* 暂时关闭吸附，自绘缓动翻页（100dvh 吸附与原生 smooth 在部分内核会互相打架） */
    app.classList.add("is-navigating");
    var duration = Math.min(980, 460 + Math.abs(dist) * 0.32);
    var t0 = performance.now();

    function ease(t) { return 1 - Math.pow(1 - t, 3); }

    function step() {
      var p = Math.min(1, (performance.now() - t0) / duration);
      app.scrollTop = start + dist * ease(p);
      if (p < 1) {
        navTimer = setTimeout(step, 16);
      } else {
        app.scrollTop = target;
        app.classList.remove("is-navigating");
        navTimer = null;
        setActive(index);
      }
    }
    navTimer = setTimeout(step, 0);
  }

  ["pointerdown", "touchstart", "wheel"].forEach(function (evt) {
    app.addEventListener(evt, stopNav, { passive: true });
  });

  function setActive(index) {
    if (index < 0) return;
    current = index;
    navDots.forEach(function (d, i) {
      d.classList.toggle("is-active", i === index);
      if (i === index) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
    var night = sections[index].getAttribute("data-theme") === "night";
    document.body.classList.toggle("theme-night", night);
    document.body.classList.toggle("is-cover", index === 0);
    fx.setNight(night);
  }

  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        setActive(sections.indexOf(entry.target));
      }
    });
  }, { root: app, threshold: 0.55 });
  sections.forEach(function (sec) { sectionObserver.observe(sec); });
  setActive(0);

  var activeTimer = null;
  app.addEventListener("scroll", function () {
    if (activeTimer) clearTimeout(activeTimer);
    activeTimer = setTimeout(function () {
      var idx = Math.round(app.scrollTop / app.clientHeight);
      if (idx >= 0 && idx < sections.length && idx !== current) setActive(idx);
    }, 90);
  }, { passive: true });

  /* ---------------- reveal ---------------- */

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { root: app, threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ---------------- music ---------------- */

  function setMusicUI(on) {
    musicBtn.classList.toggle("is-on", on);
    musicBtn.setAttribute("aria-pressed", on ? "true" : "false");
    musicBtn.setAttribute("aria-label", on ? "关闭生日音乐" : "开启生日音乐");
  }

  musicBtn.addEventListener("click", function () {
    if (music.playing) {
      music.stop();
      setMusicUI(false);
      music.chime();
    } else {
      music.start().then(function (ok) {
        setMusicUI(ok);
        if (ok) music.chime();
      });
    }
  });

  /* ---------------- cover opening ---------------- */

  app.classList.add("is-locked");

  function openInvite() {
    if (opened) {
      goTo(1);
      return;
    }
    opened = true;
    cover.classList.add("is-opening");
    invitation.classList.add("is-opening");

    music.start().then(function (ok) { setMusicUI(ok); });
    fx.goldRain(86);

    if (navigator.vibrate) {
      try { navigator.vibrate(14); } catch (e) {}
    }

    requestOrientation();

    window.setTimeout(function () {
      app.classList.remove("is-locked");
      goTo(1);
    }, 980);
  }

  invitation.addEventListener("click", openInvite);
  coverHint.addEventListener("click", openInvite);

  /* ---------------- parallaax ---------------- */

  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var parallaxQueued = false;

  function updateParallax() {
    var vh = window.innerHeight;
    parallaxEls.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -vh || rect.top > vh * 2) return;
      var center = rect.top + rect.height / 2;
      var rel = (center - vh / 2) / vh;
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0.05;
      el.style.setProperty("--py", (-rel * speed * 100).toFixed(2) + "px");
    });
    parallaxQueued = false;
  }

  app.addEventListener("scroll", function () {
    if (!parallaxQueued) {
      parallaxQueued = true;
      requestAnimationFrame(updateParallax);
    }
  }, { passive: true });
  window.addEventListener("resize", updateParallax);
  updateParallax();

  /* ---------------- swipers ---------------- */

  function cardCenter(card, swiper) {
    var cr = card.getBoundingClientRect();
    var sr = swiper.getBoundingClientRect();
    return cr.left - sr.left + swiper.scrollLeft + cr.width / 2;
  }

  document.querySelectorAll("[data-swiper]").forEach(function (swiper) {
    var cards = Array.prototype.slice.call(swiper.querySelectorAll(".photo-card"));
    var block = swiper.closest(".swiper-block");
    var dotsWrap = block ? block.querySelector("[data-dots]") : null;
    if (!cards.length) return;

    var buttons = [];
    if (dotsWrap) {
      cards.forEach(function (card, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", "第 " + (i + 1) + " 张照片");
        b.addEventListener("click", function () {
          var target = cardCenter(card, swiper) - swiper.clientWidth / 2;
          swiper.scrollTo({ left: Math.max(0, target), behavior: "auto" });
        });
        dotsWrap.appendChild(b);
        buttons.push(b);
      });
    }

    function update() {
      var center = swiper.scrollLeft + swiper.clientWidth / 2;
      var best = 0;
      var bestDist = Infinity;
      cards.forEach(function (card, i) {
        var d = Math.abs(cardCenter(card, swiper) - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      buttons.forEach(function (b, i) {
        b.classList.toggle("is-active", i === best);
      });
    }

    var queued = false;
    swiper.addEventListener("scroll", function () {
      if (!queued) {
        queued = true;
        requestAnimationFrame(function () { queued = false; update(); });
      }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  /* ---------------- gyroscope / tilt ---------------- */

  var tiltEl = document.querySelector("[data-tilt]");
  var hasGyro = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function onOrient(e) {
    if (!tiltEl) return;
    if (e.gamma == null && e.beta == null) return;
    hasGyro = true;
    var gx = clamp((e.gamma || 0) / 30, -1, 1);
    var gy = clamp(((e.beta || 0) - 42) / 34, -1, 1);
    tiltEl.style.setProperty("--ry", (gx * 7).toFixed(2) + "deg");
    tiltEl.style.setProperty("--rx", (-gy * 5).toFixed(2) + "deg");
  }

  function requestOrientation() {
    var DOE = window.DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then(function (state) {
        if (state === "granted") {
          window.addEventListener("deviceorientation", onOrient, true);
        }
      }).catch(function () {});
    } else {
      window.addEventListener("deviceorientation", onOrient, true);
    }
  }

  window.addEventListener("pointermove", function (e) {
    if (hasGyro || !tiltEl || current !== 1) return;
    var nx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    var ny = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    tiltEl.style.setProperty("--ry", (clamp(nx, -1, 1) * 6).toFixed(2) + "deg");
    tiltEl.style.setProperty("--rx", (clamp(-ny, -1, 1) * 4).toFixed(2) + "deg");
  }, { passive: true });

  /* ---------------- candles ---------------- */

  function blowCandles() {
    if (!finale || finale.classList.contains("is-blown")) return;
    finale.classList.add("is-blown");

    var cake = finale.querySelector(".cake-svg");
    var rect = cake ? cake.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight * 0.4, width: 0, height: 0 };
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height * 0.34;

    fx.celebrate(cx, cy);

    if (navigator.vibrate) {
      try { navigator.vibrate([16, 40, 26]); } catch (e) {}
    }

    window.setTimeout(function () {
      finale.classList.add("is-card");
    }, 1450);
  }

  if (blowZone) blowZone.addEventListener("click", blowCandles);
  if (blowHint) blowHint.addEventListener("click", blowCandles);

  /* ---------------- misc ---------------- */

  document.addEventListener("visibilitychange", function () {
    if (document.hidden && music.ctx && music.ctx.state === "running" && music.playing) {
      /* audio.js already suspends; keep UI in sync */
      setMusicUI(true);
    }
  });

  window.addEventListener("load", updateParallax);

  document.documentElement.classList.add("is-ready");
})();
