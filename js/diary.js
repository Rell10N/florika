const Diary = {
  labId: "home",
  tabName: "book",
  detail: -1,

  speakIcon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>',

  node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  },

  entries() {
    const total = Math.max(GameConfig.hypothesesPerLab, App.combos.length);
    const checked = App.save.checked[this.labId] || {};
    const tried = App.save.tried[this.labId] || {};
    const list = [];
    for (let i = 0; i < total; i++) {
      const combo = App.combos[i];
      let state = "locked";
      if (combo) {
        if (checked[combo.id]) state = "done";
        else if (tried[combo.id] > 0) state = "redo";
      }
      list.push({ combo, state, index: i });
    }
    return list;
  },

  seenMap() {
    if (!App.save.diarySeen[this.labId]) App.save.diarySeen[this.labId] = {};
    return App.save.diarySeen[this.labId];
  },

  unseen() {
    const seen = this.seenMap();
    return this.entries().filter(entry => entry.state === "done" && !seen[entry.combo.id]);
  },

  markSeen() {
    const seen = this.seenMap();
    let changed = false;
    this.entries().forEach(entry => {
      if (entry.state === "done" && !seen[entry.combo.id]) {
        seen[entry.combo.id] = true;
        changed = true;
      }
    });
    if (changed) App.persist();
  },

  refreshDot() {
    this.labId = typeof Lab !== "undefined" ? Lab.labId : this.labId;
    const dot = document.getElementById("diary-dot");
    if (dot) dot.classList.toggle("is-hidden", this.unseen().length === 0);
  },

  open(tab) {
    this.labId = Lab.labId;
    this.tabName = tab || "book";
    this.detail = -1;
    this.render();
    App.openModal("modal-diary");
  },

  close() {
    this.markSeen();
    App.stopSpeech();
    App.closeModal("modal-diary");
    this.refreshDot();
  },

  tab(name) {
    this.tabName = name;
    this.detail = -1;
    this.render();
    App.playSfx("option");
  },

  render() {
    document.querySelectorAll("#modal-diary .diary-tab").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.tab === this.tabName);
    });
    const body = document.getElementById("diary-body");
    body.innerHTML = "";
    body.scrollTop = 0;
    if (this.tabName === "stats") this.renderStats(body);
    else if (this.detail >= 0) this.renderDetail(body);
    else this.renderBook(body);
    App.refreshSpeakButtons();
  },

  renderBook(body) {
    const entries = this.entries();
    const done = entries.filter(entry => entry.state === "done").length;
    const redo = entries.filter(entry => entry.state === "redo").length;
    const seen = this.seenMap();

    const head = this.node("div", "diary-progress");
    head.appendChild(this.node("strong", "", "Открыто " + done + " из " + entries.length));
    const bar = this.node("div", "diary-bar");
    const fill = this.node("span", "");
    fill.style.width = (entries.length ? (done / entries.length) * 100 : 0) + "%";
    bar.appendChild(fill);
    head.appendChild(bar);
    head.appendChild(this.node("p", "diary-note", redo
      ? "Жёлтые карточки ждут новой попытки. Нажми на открытую карточку, чтобы перечитать."
      : "Нажми на открытую карточку, чтобы перечитать гипотезу и факт."));
    body.appendChild(head);

    const grid = this.node("div", "diary-grid");
    entries.forEach(entry => {
      const card = this.node("button", "diary-item is-" + entry.state);
      card.type = "button";
      card.dataset.sfx = "none";
      if (entry.state === "locked") {
        card.appendChild(this.node("span", "diary-q", "?"));
        card.appendChild(this.node("span", "diary-name", "Ещё не открыто"));
        card.addEventListener("click", () => {
          App.playSfx("locked");
          App.showToast("Смешивай колбы, и здесь появится открытие");
        });
      } else {
        const pair = this.node("div", "diary-pair");
        pair.innerHTML = Lab.pairMarkup(entry.combo);
        card.appendChild(pair);
        card.appendChild(this.node("span", "diary-name", entry.state === "done" ? entry.combo.title : "Попробуй ещё раз"));
        if (entry.state === "done") {
          card.appendChild(this.node("span", "diary-tag " + (entry.combo.verdict ? "yes" : "no"), entry.combo.verdict ? "Возможно" : "Невозможно"));
          if (!seen[entry.combo.id]) card.appendChild(this.node("span", "diary-new", "Новое"));
          card.addEventListener("click", () => {
            App.playSfx("option");
            this.detail = entry.index;
            this.render();
          });
        } else {
          card.addEventListener("click", () => {
            App.playSfx("locked");
            App.showToast("Эта комбинация ждёт новой попытки");
          });
        }
      }
      grid.appendChild(card);
    });
    body.appendChild(grid);
  },

  speakButton(spec) {
    const btn = this.node("button", "btn-speak is-hidden");
    btn.type = "button";
    btn.dataset.sfx = "none";
    btn.dataset.speak = spec;
    btn.setAttribute("aria-label", "Прочитать вслух");
    btn.innerHTML = this.speakIcon;
    btn.addEventListener("click", () => App.speakFrom(btn));
    return btn;
  },

  renderDetail(body) {
    const combo = App.combos[this.detail];
    if (!combo) {
      this.detail = -1;
      this.renderBook(body);
      return;
    }
    const seen = this.seenMap();
    if (!seen[combo.id]) {
      seen[combo.id] = true;
      App.persist();
    }

    const back = this.node("button", "btn-to-shelf diary-back");
    back.type = "button";
    back.dataset.sfx = "back";
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
    back.appendChild(this.node("span", "", "К дневнику"));
    back.addEventListener("click", () => {
      this.detail = -1;
      this.render();
    });
    body.appendChild(back);

    const top = this.node("div", "diary-detail-top");
    const pair = this.node("div", "diary-pair big");
    pair.innerHTML = Lab.pairMarkup(combo);
    top.appendChild(pair);
    const titleBox = this.node("div", "diary-detail-title");
    titleBox.appendChild(this.node("h3", "", combo.title));
    titleBox.appendChild(this.node("span", "diary-tag " + (combo.verdict ? "yes" : "no"), combo.verdict ? "Возможно" : "Невозможно"));
    top.appendChild(titleBox);
    body.appendChild(top);

    const hyp = this.node("section", "diary-block");
    const hypHead = this.node("div", "speak-line");
    hypHead.appendChild(this.node("h4", "", "Гипотеза Мэйлии"));
    hypHead.appendChild(this.speakButton("diary-hyp"));
    hyp.appendChild(hypHead);
    const hypText = this.node("p", "", App.fill(combo.hypothesis));
    hypText.id = "diary-hyp";
    hyp.appendChild(hypText);
    body.appendChild(hyp);

    const correct = (combo.options || []).find(option => option.correct);
    if (correct) {
      const why = this.node("section", "diary-block why");
      const whyHead = this.node("div", "speak-line");
      whyHead.appendChild(this.node("h4", "", "Почему так"));
      whyHead.appendChild(this.speakButton("diary-why"));
      why.appendChild(whyHead);
      const whyText = this.node("p", "", App.fill(correct.text));
      whyText.id = "diary-why";
      why.appendChild(whyText);
      body.appendChild(why);
    }

    if (combo.fact && (combo.fact.title || combo.fact.text)) {
      const fact = this.node("section", "diary-block fact");
      const factHead = this.node("div", "speak-line");
      factHead.appendChild(this.node("h4", "", "Интересный факт"));
      factHead.appendChild(this.speakButton("diary-fact-title,diary-fact-text"));
      fact.appendChild(factHead);
      const factTitle = this.node("p", "diary-fact-title", App.fill(combo.fact.title || ""));
      factTitle.id = "diary-fact-title";
      const factText = this.node("p", "", App.fill(combo.fact.text || ""));
      factText.id = "diary-fact-text";
      fact.appendChild(factTitle);
      fact.appendChild(factText);
      body.appendChild(fact);
    }
  },

  tile(value, label) {
    const tile = this.node("div", "stat-tile");
    tile.appendChild(this.node("span", "stat-value", String(value)));
    tile.appendChild(this.node("span", "stat-label", label));
    return tile;
  },

  renderStats(body) {
    const info = Stats.summary(this.labId);
    body.appendChild(this.node("p", "stats-cheer", App.fill(Lab.cheerText(info))));

    const meter = this.node("div", "stats-meter");
    const share = value => (info.total ? (value / info.total) * 100 : 0) + "%";
    [["seg-ok", info.verified], ["seg-redo", info.redo], ["seg-new", info.fresh]].forEach(pair => {
      const seg = this.node("span", pair[0]);
      seg.style.width = share(pair[1]);
      meter.appendChild(seg);
    });
    body.appendChild(meter);

    const legend = this.node("div", "stats-legend");
    [["ok", info.verified, "проверено полностью"], ["redo", info.redo, "нужно проверить ещё раз"], ["new", info.fresh, "ещё не открыто"]].forEach(item => {
      const box = this.node("div", "legend-item " + item[0]);
      box.appendChild(this.node("span", "legend-value", String(item[1])));
      box.appendChild(this.node("span", "legend-label", item[2]));
      legend.appendChild(box);
    });
    body.appendChild(legend);

    const extra = this.node("div", "stats-extra");
    [
      [info.stars + " из " + GameConfig.starThresholds.length, "звёзд получено"],
      [info.attempts, "ответов всего"],
      [info.firstTry, "верно с первой попытки"],
      [info.bestStreak, "лучшая серия подряд"],
      [info.accuracy + "%", "ответов были верными"],
      [info.hints, "подсказок использовано"]
    ].forEach(item => extra.appendChild(this.tile(item[0], item[1])));
    body.appendChild(extra);
  }
};
