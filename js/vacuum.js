const Vacuum = {
  state: "idle",
  sprite: null,
  track: null,
  svg: null,
  frame: null,
  timers: [],

  settings: {
    holdMs: 5000,
    fadeMs: 700,
    cooldownMs: 5000,
    startSpeed: 150,
    topSpeed: 640,
    accel: 780,
    dropFromTrack: 64
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

  point(ox, oy, w, h, px, py) {
    return { x: ox + px * w, y: oy + py * h };
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
    return "M" + p(0.05, 0.04) + " L" + p(0.95, 0.04) + " L" + p(0.35, 1.0);
  },

  line(from, to) {
    return "M" + from.x.toFixed(1) + " " + from.y.toFixed(1) + " L" + to.x.toFixed(1) + " " + to.y.toFixed(1);
  },

  makePath(d, draw) {
    const ns = "http://www.w3.org/2000/svg";
    const entry = { d, draw, length: 0, nodes: [] };
    const classes = draw ? ["trail-glow", "trail-core"] : [""];
    classes.forEach(name => {
      const node = document.createElementNS(ns, "path");
      node.setAttribute("d", d);
      if (name) node.setAttribute("class", name);
      else node.setAttribute("fill", "none");
      this.svg.appendChild(node);
      entry.nodes.push(node);
    });
    entry.length = entry.nodes[0].getTotalLength();
    if (draw) {
      entry.nodes.forEach(node => {
        node.style.strokeDasharray = entry.length;
        node.style.strokeDashoffset = entry.length;
      });
    }
    return entry;
  },

  launch() {
    this.state = "running";
    const trackRect = this.track.getBoundingClientRect();
    const spriteRect = this.sprite.getBoundingClientRect();
    const wide = document.body.dataset.layout === "wide";
    const width = trackRect.width;

    const digitH = Math.round(Math.min(wide ? 230 : 170, Math.max(wide ? 150 : 110, window.innerHeight * (wide ? 0.2 : 0.17))));
    const digitW = digitH * 0.62;
    const gap = digitW * 0.5;
    const center = wide ? width * 0.62 : width * 0.5;
    const left6 = center - (digitW * 2 + gap) / 2;
    const left7 = left6 + digitW + gap;
    const top = this.settings.dropFromTrack + (wide ? 14 : 0);

    const offsetX = spriteRect.width / 2;
    const offsetY = spriteRect.height * 0.9;
    this.offset = { x: offsetX, y: offsetY, w: spriteRect.width, h: spriteRect.height };

    const start = { x: spriteRect.left - trackRect.left + offsetX, y: spriteRect.top - trackRect.top + offsetY };
    const s6 = this.point(left6, top, digitW, digitH, 0.82, 0.04);
    const e6 = this.point(left6, top, digitW, digitH, 0.05, 0.68);
    const s7 = this.point(left7, top, digitW, digitH, 0.05, 0.04);
    const e7 = this.point(left7, top, digitW, digitH, 0.35, 1.0);
    const exit = { x: width + spriteRect.width + 60, y: e7.y - 18 };

    const ns = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(ns, "svg");
    this.svg.setAttribute("class", "vacuum-trail");
    this.track.insertBefore(this.svg, this.track.firstChild);

    this.segments = [
      this.makePath(this.line(start, s6), false),
      this.makePath(this.sixPath(left6, top, digitW, digitH), true),
      this.makePath(this.line(e6, s7), false),
      this.makePath(this.sevenPath(left7, top, digitW, digitH), true),
      this.makePath(this.line(e7, exit), false)
    ];
    this.total = this.segments.reduce((sum, seg) => sum + seg.length, 0);

    this.sprite.style.animation = "none";
    this.track.style.zIndex = "5";
    this.track.style.overflow = "visible";

    this.dist = 0;
    this.speed = this.settings.startSpeed;
    this.dir = this.currentDirection();
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
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.speed = Math.min(this.settings.topSpeed, this.speed + this.settings.accel * dt);
    this.dist = Math.min(this.total, this.dist + this.speed * dt);

    let passed = 0;
    let index = 0;
    while (index < this.segments.length - 1 && this.dist > passed + this.segments[index].length) {
      passed += this.segments[index].length;
      index++;
    }
    const local = this.dist - passed;
    const current = this.segments[index];
    const point = current.nodes[0].getPointAtLength(Math.min(local, current.length));

    this.segments.forEach((seg, i) => {
      if (!seg.draw) return;
      const covered = i < index ? seg.length : (i === index ? local : 0);
      seg.nodes.forEach(node => {
        node.style.strokeDashoffset = Math.max(0, seg.length - covered);
      });
    });

    const dx = point.x - this.prev.x;
    if (Math.abs(dx) > 0.15) this.dir = dx > 0 ? 1 : -1;
    this.prev = point;
    const px = point.x - this.offset.x;
    const py = point.y - this.offset.y;
    this.sprite.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0) scaleX(" + this.dir + ")";

    if (this.dist >= this.total) {
      this.finish();
      return;
    }
    this.frame = requestAnimationFrame((t) => this.step(t));
  },

  finish() {
    this.frame = null;
    this.sprite.style.animation = "";
    this.sprite.style.transform = "";
    this.state = "visible";
    this.later(() => {
      this.state = "fading";
      if (this.svg) this.svg.classList.add("is-fading");
      this.later(() => this.cleanup(), this.settings.fadeMs);
    }, this.settings.holdMs);
  },

  cleanup() {
    if (this.svg && this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
    this.svg = null;
    this.track.style.zIndex = "";
    this.track.style.overflow = "";
    this.state = "cooldown";
    this.later(() => {
      this.state = "idle";
    }, this.settings.cooldownMs);
  }
};
