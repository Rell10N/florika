const Loader = {
  blobs: {},
  images: [],
  groups: [],
  shown: 0,
  criticalDone: false,
  allDone: false,
  skipped: false,
  entered: false,
  frame: null,

  layoutKey() {
    return document.body.dataset.layout === "wide" ? "wide" : "compact";
  },

  url(src) {
    return this.blobs[src] || src;
  },

  buildPlan() {
    const assets = GameConfig.assets;
    const layout = this.layoutKey();
    const other = layout === "wide" ? "compact" : "wide";
    const image = (src, weight) => ({ kind: "image", src, weight: weight || 1 });
    const track = src => ({ kind: "blob", src, weight: 6 });

    const menu = assets.menu.shared.concat(assets.menu[layout]).map((src, i) => image(src, i < 2 ? 3 : 1));
    const story = assets.story.map(src => image(src));
    const sound = [{ kind: "voice", weight: 1 }]
      .concat(GameConfig.audio.sfxNames.map(name => ({ kind: "sfx", name, weight: 0.5 })))
      .concat([track(assets.music[0])]);
    const rest = assets.menu[other].concat(assets.rest).map(src => image(src, 2));
    const late = assets.music.slice(1).map(track);

    this.groups = [
      { text: GameData.loading.menu, critical: true, items: menu },
      { text: GameData.loading.story, items: story },
      { text: GameData.loading.sound, items: sound },
      { text: GameData.loading.rest, items: rest.concat(late) }
    ];
    this.groups.forEach(group => {
      group.items.forEach(item => {
        item.progress = 0;
      });
    });
    this.groups.push({ text: GameData.loading.rest, items: [], icons: true });
  },

  run() {
    this.buildPlan();
    this.tick();
    this.next(0);
  },

  next(index) {
    if (index >= this.groups.length) {
      this.allDone = true;
      return;
    }
    const group = this.groups[index];
    if (group.icons) {
      this.appendIcons().then(() => this.next(index + 1));
      return;
    }
    this.setStatus(group.text);
    this.pool(group.items, 4).then(() => {
      if (group.critical) {
        this.criticalDone = true;
        if (this.skipped) this.enter();
      }
      this.next(index + 1);
    });
  },

  appendIcons() {
    if (!GameConfig.assets.useComboIcons) return Promise.resolve();
    const ready = App.combosReady || Promise.resolve();
    return ready.then(() => {
      const items = App.combos.map((combo, i) => {
        const icon = combo.icon;
        const src = icon ? (/[\/.]/.test(icon) ? icon : "assets/ico/" + icon + "." + GameConfig.imageExt) : "assets/ico/ico" + (i + 1) + "." + GameConfig.imageExt;
        return { kind: "image", src, weight: 0.5, progress: 0 };
      });
      this.groups[this.groups.length - 1].items = items;
      return this.pool(items, 4);
    }).catch(() => {});
  },

  pool(items, limit) {
    return new Promise(resolve => {
      if (!items.length) {
        resolve();
        return;
      }
      let cursor = 0;
      let active = 0;
      let finished = 0;
      const launch = () => {
        while (active < limit && cursor < items.length) {
          const item = items[cursor++];
          active++;
          this.runItem(item).then(() => {
            item.progress = 1;
            active--;
            finished++;
            if (finished === items.length) resolve();
            else launch();
          });
        }
      };
      launch();
    });
  },

  runItem(item) {
    const work = this.execute(item).catch(() => {});
    const timeout = new Promise(resolve => setTimeout(resolve, 25000));
    return Promise.race([work, timeout]);
  },

  execute(item) {
    if (item.kind === "image") return this.loadImage(item.src);
    if (item.kind === "blob") return this.loadBlob(item);
    if (item.kind === "voice") return App.loadVoiceAudio();
    if (item.kind === "sfx") return App.loadSfxOne(item.name);
    return Promise.resolve();
  },

  loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
        decoded.then(resolve);
      };
      img.onerror = resolve;
      img.src = src;
      this.images.push(img);
    });
  },

  loadBlob(item) {
    return fetch(item.src).then(response => {
      if (!response.ok) throw new Error("missing");
      const total = Number(response.headers.get("content-length")) || 0;
      if (!response.body || !total) return response.blob();
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      const pump = () => reader.read().then(result => {
        if (result.done) return new Blob(chunks, { type: "audio/mpeg" });
        chunks.push(result.value);
        received += result.value.length;
        item.progress = Math.min(0.98, received / total);
        return pump();
      });
      return pump();
    }).then(blob => {
      this.blobs[item.src] = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "audio/mpeg" }));
    });
  },

  ratio() {
    let weight = 0;
    let done = 0;
    this.groups.forEach(group => {
      group.items.forEach(item => {
        weight += item.weight;
        done += item.weight * item.progress;
      });
    });
    if (!weight) return 0;
    const pending = this.groups[this.groups.length - 1].items.length === 0 && !this.allDone ? 0.02 : 0;
    return Math.min(1, done / (weight + pending));
  },

  tick() {
    const target = this.allDone ? 100 : Math.min(99, this.ratio() * 100);
    const gap = target - this.shown;
    this.shown += gap > 0 ? Math.max(0.35, gap * 0.12) : 0;
    if (this.shown > target) this.shown = target;
    this.paint();
    if (this.allDone && this.shown >= 99.9) {
      this.shown = 100;
      this.paint();
      this.finish();
      return;
    }
    this.frame = requestAnimationFrame(() => this.tick());
  },

  paint() {
    const fill = document.getElementById("loader-fill");
    const percent = document.getElementById("loader-percent");
    if (fill) fill.style.transform = "scaleX(" + (this.shown / 100) + ")";
    if (percent) percent.textContent = Math.floor(this.shown) + "%";
  },

  setStatus(text) {
    const el = document.getElementById("loader-status");
    if (el && !this.skipped) el.textContent = text;
  },

  finish() {
    const start = document.getElementById("btn-loader-start");
    const skip = document.getElementById("btn-loader-skip");
    const panel = document.getElementById("loader-panel");
    const status = document.getElementById("loader-status");
    if (status) status.textContent = GameData.loading.done;
    if (skip) skip.classList.add("is-hidden");
    if (panel) panel.classList.add("is-ready");
    if (start) {
      start.classList.remove("is-hidden");
      start.focus({ preventScroll: true });
    }
    if (this.skipped) this.enter();
  },

  skip() {
    if (this.skipped || this.entered) return;
    this.skipped = true;
    const skip = document.getElementById("btn-loader-skip");
    if (this.criticalDone) {
      this.enter();
      return;
    }
    if (skip) skip.disabled = true;
    const status = document.getElementById("loader-status");
    if (status) status.textContent = GameData.loading.skipWait;
  },

  start() {
    this.enter();
  },

  enter() {
    if (this.entered) return;
    this.entered = true;
    const intro = document.getElementById("studio-intro");
    App.resumeAudio();
    App.startMusic();
    if (!intro) return;
    intro.classList.add("hidden");
    setTimeout(() => {
      intro.style.display = "none";
    }, 1000);
  }
};
