const Vacuum = {
  state: "idle",
  sprite: null,
  track: null,
  svg: null,
  frame: null,
  timers: [],

  settings: {
    holdMs: 5000,
    fadeMs: 1400,
    cooldownMs: 5000,
    startSpeed: 130,
    topSpeed: 500,
    rampSeconds: 1.2,
    digitHeightCompact: 62,
    digitHeightWide: 150,
    shiftX: 0,
    shiftY: 0,
    wheelGapRatio: 0.05,
    wheelWidthRatio: 0.046,
    maxTilt: 7,
    awayMinMs: 3000,
    awayMaxMs: 5000,
    returnPhaseFromRight: 0.47,
    patrolSeconds: 34,
    compactTopOffset: 34
  },

  init() {
    this.sprite = document.getElementById("vacuum-img");
    this.track = document.querySelector(".hills-vacuum-track");
    const menu = document.getElementById("screen-menu");
    if (!this.sprite || !this.track || !menu) return;
    menu.addEventListener("pointerdown", (e) => this.onPointer(e));
  },

  onPointer(e) {
    if (this.state !== "idle" || e.target.closest("button")) return;
    const rect = this.sprite.getBoundingClientRect();
    if (!rect.width || this.sprite.style.display === "none") return;
    const pad = 18;
    const inside = e.clientX >= rect.left - pad && e.clientX <= rect.right + pad &&
      e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad;
    if (inside) this.launch();
  },

  later(callback, delay) {
    this.timers.push(setTimeout(callback, delay));
  },

  unit(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  },

  curve(from, fromDir, to, toDir) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const k = Math.max(50, distance * 0.38);
    const c1 = { x: from.x + fromDir.x * k, y: from.y + fromDir.y * k };
    const c2 = { x: to.x - toDir.x * k, y: to.y - toDir.y * k };
    const f = n => n.toFixed(1);
    return "M" + f(from.x) + " " + f(from.y) + " C" + f(c1.x) + " " + f(c1.y) + " " + f(c2.x) + " " + f(c2.y) + " " + f(to.x) + " " + f(to.y);
  },

  sixPath(ox, oy, w, h) {
    const p = (px, py) => (ox + px * w).toFixed(1) + " " + (oy + py * h).toFixed(1);
    const rx = (0.45 * w).toFixed(1);
    const ry = (0.32 * h).toFixed(1);
    return "M" + p(0.82, 0.04) +
      " C" + p(0.45, -0.02) + " " + p(0.05, 0.28) + " " + p(0.05, 0.68) +
      " A" + rx + " " + ry + " 0 0 0 " + p(0.95, 0.68) +
      " A" + rx + " " + ry + " 0 0 0 " + p(0.05, 0.68);
  },

  sevenPath(ox, oy, w, h) {
    const p = (px, py) => (ox + px * w).toFixed(1) + " " + (oy + py * h).toFixed(1);
    return "M" + p(0.05, 0.04) + " L" + p(0.8, 0.04) + " Q" + p(0.98, 0.04) + " " + p(0.9, 0.2) + " L" + p(0.35, 1.0);
  },

  place(ox, oy, w, h, px, py) {
    return { x: ox + px * w, y: oy + py * h };
  },

  measure() {
    const settings = this.settings;
    const wide = document.body.dataset.layout === "wide";
    const trackRect = this.track.getBoundingClientRect();
    const flori = document.querySelector(".flori-hero-sprite");
    const actions = document.querySelector(".menu-action-zone");
    const floriRect = flori ? flori.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
    const actionsRect = actions ? actions.getBoundingClientRect() : { left: 0, right: 0, top: window.innerHeight, bottom: window.innerHeight };
    let height = wide ? settings.digitHeightWide : settings.digitHeightCompact;
    let centerX;
    let topAbs;

    if (wide) {
      height = Math.min(height, window.innerHeight * 0.17);
      const total = height * 0.62 * 2.5;
      const leftFree = floriRect.left - actionsRect.right;
      const rightFree = window.innerWidth - floriRect.right;
      if (leftFree >= total + 30) centerX = actionsRect.right + leftFree / 2;
      else if (rightFree >= total + 30) centerX = floriRect.right + rightFree / 2;
      else centerX = actionsRect.right + Math.max(0, leftFree) / 2;
      topAbs = window.innerHeight - height - Math.max(60, window.innerHeight * 0.09);
    } else {
      const total = height * 0.62 * 2.5;
      centerX = Math.max(total / 2 + 8, floriRect.left + 8 - total / 2);
      topAbs = trackRect.top + settings.compactTopOffset;
    }

    const w = height * 0.62;
    const gap = w * 0.5;
    const total = w * 2 + gap;
    return {
      h: height,
      w,
      gap,
      left6: centerX - total / 2 - trackRect.left + settings.shiftX,
      top: topAbs - trackRect.top + settings.shiftY,
      width: trackRect.width,
      trackRect
    };
  },

  makeGeometry(d) {
    const ns = "http://www.w3.org/2000/svg";
    const node = document.createElementNS(ns, "path");
    node.setAttribute("d", d);
    node.setAttribute("fill", "none");
    this.svg.appendChild(node);
    return node;
  },

  wheelPaths(center, offset) {
    const total = center.getTotalLength();
    const left = [];
    const right = [];
    for (let at = 0; at <= total; at += 2.5) {
      const a = center.getPointAtLength(at);
      const b = center.getPointAtLength(Math.min(total, at + 0.8));
      const t = this.unit(b.x - a.x, b.y - a.y);
      left.push((a.x - t.y * offset).toFixed(1) + " " + (a.y + t.x * offset).toFixed(1));
      right.push((a.x + t.y * offset).toFixed(1) + " " + (a.y - t.x * offset).toFixed(1));
    }
    return ["M" + left.join(" L"), "M" + right.join(" L")];
  },

  makeDrawn(d, height) {
    const ns = "http://www.w3.org/2000/svg";
    const center = this.makeGeometry(d);
    const length = center.getTotalLength();
    const offset = Math.max(3.4, height * this.settings.wheelGapRatio);
    const wheel = Math.max(2.4, height * this.settings.wheelWidthRatio);
    const nodes = [];

    const band = document.createElementNS(ns, "path");
    band.setAttribute("d", d);
    band.setAttribute("class", "trail-band");
    band.style.strokeWidth = (offset * 2 + wheel) + "px";
    this.svg.appendChild(band);
    nodes.push(band);

    this.wheelPaths(center, offset).forEach(wheelD => {
      const line = document.createElementNS(ns, "path");
      line.setAttribute("d", wheelD);
      line.setAttribute("class", "trail-wheel");
      line.style.strokeWidth = wheel + "px";
      this.svg.appendChild(line);
      nodes.push(line);
    });

    nodes.forEach(node => {
      node.dataset.length = node.getTotalLength();
      node.style.strokeDasharray = node.dataset.length;
      node.style.strokeDashoffset = node.dataset.length;
    });
    return { center, length, draw: true, nodes };
  },

  makeMove(d) {
    const center = this.makeGeometry(d);
    return { center, length: center.getTotalLength(), draw: false, nodes: [] };
  },

  launch() {
    this.state = "running";
    const layout = this.measure();
    const spriteRect = this.sprite.getBoundingClientRect();
    const trackRect = layout.trackRect;
    const offsetX = spriteRect.width / 2;
    const offsetY = spriteRect.height * 0.9;
    this.offset = { x: offsetX, y: offsetY };

    const startDir = this.currentDirection();
    const start = { x: spriteRect.left - trackRect.left + offsetX, y: spriteRect.top - trackRect.top + offsetY };
    const left7 = layout.left6 + layout.w + layout.gap;
    const s6 = this.place(layout.left6, layout.top, layout.w, layout.h, 0.82, 0.04);
    const e6 = this.place(layout.left6, layout.top, layout.w, layout.h, 0.05, 0.68);
    const s7 = this.place(left7, layout.top, layout.w, layout.h, 0.05, 0.04);
    const e7 = this.place(left7, layout.top, layout.w, layout.h, 0.35, 1.0);
    this.exitSide = e7.x > layout.width / 2 ? 1 : -1;
    const exit = { x: this.exitSide > 0 ? layout.width + spriteRect.width + 80 : -spriteRect.width - 80, y: e7.y - layout.h * 0.2 };

    const ns = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(ns, "svg");
    this.svg.setAttribute("class", "vacuum-trail");
    this.track.insertBefore(this.svg, this.track.firstChild);

    const dir6 = this.unit(-0.37 * layout.w, -0.06 * layout.h);
    const dir7 = this.unit(1, 0);
    const out7 = this.unit(-0.55 * layout.w, 0.8 * layout.h);

    this.segments = [
      this.makeMove(this.curve(start, { x: startDir, y: 0 }, s6, dir6)),
      this.makeDrawn(this.sixPath(layout.left6, layout.top, layout.w, layout.h), layout.h),
      this.makeMove(this.curve(e6, { x: 0, y: 1 }, s7, dir7)),
      this.makeDrawn(this.sevenPath(left7, layout.top, layout.w, layout.h), layout.h),
      this.makeMove(this.curve(e7, out7, exit, { x: this.exitSide, y: 0 }))
    ];
    this.total = this.segments.reduce((sum, seg) => sum + seg.length, 0);

    this.sprite.style.animation = "none";
    this.track.style.overflow = "visible";

    this.dist = 0;
    this.elapsed = 0;
    this.dir = startDir;
    this.tilt = 0;
    this.last = performance.now();
    this.prev = start;
    this.frame = requestAnimationFrame((now) => this.step(now));
  },

  currentDirection() {
    try {
      return new DOMMatrix(getComputedStyle(this.sprite).transform).a < 0 ? -1 : 1;
    } catch (e) {
      return 1;
    }
  },

  step(now) {
    const settings = this.settings;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.elapsed += dt;
    const ramp = 1 - Math.exp(-3 * this.elapsed / settings.rampSeconds);
    const speed = settings.startSpeed + (settings.topSpeed - settings.startSpeed) * ramp;
    this.dist = Math.min(this.total, this.dist + speed * dt);

    let passed = 0;
    let index = 0;
    while (index < this.segments.length - 1 && this.dist > passed + this.segments[index].length) {
      passed += this.segments[index].length;
      index++;
    }
    const current = this.segments[index];
    const local = Math.min(this.dist - passed, current.length);
    const point = current.center.getPointAtLength(local);

    this.segments.forEach((seg, i) => {
      if (!seg.draw) return;
      const covered = i < index ? seg.length : (i === index ? local : 0);
      const share = seg.length ? covered / seg.length : 1;
      seg.nodes.forEach(node => {
        const length = Number(node.dataset.length);
        node.style.strokeDashoffset = Math.max(0, length * (1 - share));
      });
    });

    const dx = point.x - this.prev.x;
    const dy = point.y - this.prev.y;
    if (Math.abs(dx) > 0.2) this.dir = dx > 0 ? 1 : -1;
    const target = Math.max(-settings.maxTilt, Math.min(settings.maxTilt, Math.atan2(dy, Math.abs(dx) + 0.001) * 57.3 * 0.25));
    this.tilt += (target - this.tilt) * 0.12;
    this.prev = point;

    const px = point.x - this.offset.x;
    const py = point.y - this.offset.y;
    this.sprite.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0) scaleX(" + this.dir + ") rotate(" + this.tilt.toFixed(1) + "deg)";

    if (this.dist >= this.total) {
      this.finish();
      return;
    }
    this.frame = requestAnimationFrame((t) => this.step(t));
  },

  finish() {
    this.frame = null;
    this.sprite.style.transform = "translate3d(" + (this.exitSide > 0 ? "130vw" : "-130vw") + ",0,0)";
    this.state = "visible";
    const away = this.settings.awayMinMs + Math.random() * (this.settings.awayMaxMs - this.settings.awayMinMs);
    this.later(() => this.comeBack(), away);
    this.later(() => {
      this.state = "fading";
      if (this.svg) this.svg.classList.add("is-fading");
      this.later(() => this.cleanup(), this.settings.fadeMs);
    }, this.settings.holdMs);
  },

  comeBack() {
    const settings = this.settings;
    const delay = this.exitSide > 0 ? -settings.returnPhaseFromRight * settings.patrolSeconds : 0;
    this.sprite.style.transform = "";
    this.sprite.style.animation = "";
    this.sprite.style.animationDelay = delay + "s";
  },

  cleanup() {
    if (this.svg && this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
    this.svg = null;
    this.track.style.overflow = "";
    this.state = "cooldown";
    this.later(() => {
      this.state = "idle";
    }, this.settings.cooldownMs);
  }
};
