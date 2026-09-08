(() => {
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const dateOnly = (value) => {
    const date = String(value || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) return "";
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
  };

  // Both pages share date grouping. An undated record remains readable without inventing a date.
  function renderArchive(items, prefix = "archive") {
    const groups = new Map();
    const undated = [];
    for (const item of items) {
      const date = dateOnly(item.date);
      if (!date) { undated.push(item.html); continue; }
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date).push(item);
    }
    let month = "";
    let html = "";
    for (const [date, records] of [...groups].sort(([a], [b]) => b.localeCompare(a))) {
      const [year, monthNumber, day] = date.split("-");
      const monthKey = `${year}-${monthNumber}`;
      if (month !== monthKey) {
        if (month) html += "</section>";
        month = monthKey;
        html += `<section class="trace-month" data-archive-month="${monthKey}"><h3 class="trace-month__title">${year}<span>·</span>${monthNumber}</h3>`;
      }
      const label = [...new Set(records.map((record) => record.label).filter(Boolean))].join(" / ");
      html += `<article class="trace-date" id="${prefix}-${date}" data-year="${year}" data-month="${monthNumber}" data-date="${day}" data-trace-label="${escape(label)}" tabindex="-1"><h4 class="trace-date__title"><time datetime="${date}">${monthNumber}.${day}</time></h4><div class="trace-date__content">${records.map((record) => record.html).join("")}</div></article>`;
    }
    if (month) html += "</section>";
    if (undated.length) html += `<section class="trace-undated"><h3>发布日期待补充</h3>${undated.join("")}</section>`;
    return html;
  }

  function resolveRoute(hash = location.hash) {
    const value = hash.replace(/^#/, "");
    const sectionRoute = value.match(/^(urban|policy|showcase)\/section\/([a-z0-9-]+)$/);
    if (sectionRoute) return { page: sectionRoute[1], anchor: sectionRoute[2] };
    const scoped = value.match(/^(ai|airspace)\/([a-z0-9-]+)$/);
    if (scoped) return { page: scoped[1], anchor: scoped[2] };
    if (/^archive-\d{4}-\d{2}-\d{2}$/.test(value)) return { page: "ai", anchor: value };
    if (/^airspace-archive-\d{4}-\d{2}-\d{2}$/.test(value)) return { page: "airspace", anchor: value };
    return null;
  }

  class TraceRail {
    constructor({ page, sections, archiveTrigger, beforeJump, offsetTop = 100 }) {
      this.page = page;
      this.sections = sections;
      this.archive = archiveTrigger;
      this.beforeJump = beforeJump;
      this.offsetTop = offsetTop;
      this.activeSection = sections[0]?.element.id;
      this.activeDate = null;
      this.abort = new AbortController();
      this.root = document.createElement("div");
      this.root.className = "trace-root";
      this.root.dataset.tracePage = page.id;
      this.root.innerHTML = `<button class="trace-launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="trace-dialog-${page.id}">循迹</button><nav class="trace-rail" aria-label="循迹"><div class="trace-heading" aria-hidden="true"></div><div class="trace-scroll" tabindex="0" aria-label="滚动浏览页面与日期"><div class="trace-rail__sections"></div><div class="trace-rail__archive"><div class="trace-rail__tree"></div></div></div><time class="trace-rail__current" aria-hidden="true"></time></nav><dialog class="trace-dialog" id="trace-dialog-${page.id}" aria-labelledby="trace-title-${page.id}"><header><h2 id="trace-title-${page.id}">循迹</h2><button type="button" data-trace-close aria-label="关闭循迹">关闭</button></header><div class="trace-dialog__body"></div></dialog>`;
      document.body.append(this.root);
      page.classList.add("has-trace");
      this.rail = this.root.querySelector(".trace-rail");
      this.tree = this.root.querySelector(".trace-rail__tree");
      this.branch = this.root.querySelector(".trace-rail__archive");
      this.dialog = this.root.querySelector("dialog");
      this.launcher = this.root.querySelector(".trace-launcher");
      this.scroller = this.root.querySelector(".trace-scroll");
      this.compact = matchMedia("(max-width: 768px), (max-height: 600px)");
      this.sectionLinks = sections.map(({ element, label }) => {
        const link = this.link(element.id, label, "trace-node trace-node--section");
        if (element === this.archive) link.classList.add("trace-node--entry");
        this.rail.querySelector(".trace-rail__sections").append(link);
        return { element, link };
      });
      const options = { signal: this.abort.signal };
      this.installGestures(options);
      this.root.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-trace-target]");
        if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
          event.preventDefault();
          this.jump(link.dataset.traceTarget, { history: true, smooth: true, focus: true });
        }
      }, options);
      this.launcher.addEventListener("click", () => this.dialog.open ? this.dialog.close() : this.open(), options);
      this.root.querySelector("[data-trace-close]").addEventListener("click", () => this.dialog.close(), options);
      this.dialog.addEventListener("click", (event) => { if (event.target === this.dialog) this.dialog.close(); }, options);
      this.dialog.addEventListener("close", () => {
        if (this.dialog.open) return;
        clearTimeout(this.holdTimer);
        cancelAnimationFrame(this.pickFrame);
        this.pickNode?.classList.remove("is-preview");
        this.pickNode = null;
        this.dialog.style.removeProperty("transform");
        this.dialog.classList.remove("is-swiping");
        this.root.insertBefore(this.rail, this.dialog);
        this.launcher.setAttribute("aria-expanded", "false");
        this.updateState();
      }, options);
      document.addEventListener("pointerdown", event => {
        if (this.dialog.open && !this.root.contains(event.target)) this.dialog.close();
      }, { ...options, capture: true });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape" && this.dialog.open) {
          this.dialog.close();
          this.launcher.focus({ preventScroll: true });
        }
      }, options);
      this.compact.addEventListener("change", () => {
        if (this.dialog.open) this.dialog.close();
        this.endInteraction();
      }, options);
      window.addEventListener("app:route", () => this.activate(), options);
      window.addEventListener("resize", () => this.scheduleObserve(), options);
      window.addEventListener("scroll", () => {
        if (this.root.hidden) return;
        cancelAnimationFrame(this.endFrame);
        this.endFrame = requestAnimationFrame(() => {
          const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
          if (atEnd) {
            const last = this.sections.findLast(({ element }) => !element.closest("[hidden]") && element.getBoundingClientRect().top < innerHeight);
            if (last) { this.activeSection = last.element.id; this.updateState(); }
          } else if (this.atEnd) this.scheduleObserve();
          this.atEnd = atEnd;
        });
      }, { ...options, passive: true });
      this.resizeObserver = new ResizeObserver(() => this.scheduleObserve());
      this.resizeObserver.observe(page);
      const topbar = document.querySelector(".topbar");
      if (topbar) this.resizeObserver.observe(topbar);
      this.refresh();
      this.activate();
    }

    link(id, label, className = "trace-node") {
      const link = document.createElement("a");
      link.href = this.href(id);
      link.dataset.traceTarget = id;
      link.className = className;
      link.textContent = label;
      return link;
    }

    href(id) {
      return `#${this.page.id}/${["urban", "policy", "showcase"].includes(this.page.id) ? "section/" : ""}${id}`;
    }

    // Only called after data or filters change, never for ordinary scrolling.
    refresh() {
      this.dates = [...(this.archive?.querySelectorAll("[data-year][data-month][data-date]") || [])].filter((element) => !element.hidden);
      this.years = [];
      this.tree.replaceChildren();
      for (const element of this.dates) {
        const { year, month, date, traceLabel } = element.dataset;
        let yearGroup = this.years.find((group) => group.key === year);
        if (!yearGroup) {
          const node = document.createElement("div");
          node.className = "trace-year";
          const link = this.link(element.id, year, "trace-node trace-node--year");
          const branch = document.createElement("div");
          branch.className = "trace-fold";
          const children = document.createElement("div");
          children.className = "trace-fold__inner";
          branch.append(children);
          node.append(link, branch);
          this.tree.append(node);
          yearGroup = { key: year, node, link, branch, children, months: [] };
          this.years.push(yearGroup);
        }
        let monthGroup = yearGroup.months.find((group) => group.key === month);
        if (!monthGroup) {
          const node = document.createElement("div");
          node.className = "trace-month-node";
          const link = this.link(element.id, month, "trace-node trace-node--month");
          link.setAttribute("aria-label", `${year} 年 ${month} 月`);
          const branch = document.createElement("div");
          branch.className = "trace-fold";
          const children = document.createElement("div");
          children.className = "trace-fold__inner";
          branch.append(children);
          node.append(link, branch);
          yearGroup.children.append(node);
          monthGroup = { key: month, node, link, branch, children, days: [] };
          yearGroup.months.push(monthGroup);
        }
        const link = this.link(element.id, date, "trace-node trace-node--day");
        link.setAttribute("aria-label", `${year} 年 ${month} 月 ${date} 日${traceLabel ? ` · ${traceLabel}` : ""}`);
        if (traceLabel) {
          const small = document.createElement("small");
          small.textContent = traceLabel;
          link.append(small);
        }
        monthGroup.children.append(link);
        monthGroup.days.push({ node: link, link, element });
      }
      if (!this.dates.length) {
        const empty = document.createElement("p");
        empty.className = "trace-rail__empty";
        empty.textContent = this.archive?.dataset.traceEmpty || "暂无往期内容";
        this.tree.append(empty);
      }
      if (!this.dates.includes(this.activeDate)) this.activeDate = this.dates[0] || null;
      this.updateState();
      this.scheduleObserve();
      this.restoreHash();
    }

    fold(branch, open) {
      branch.classList.toggle("is-open", open);
      branch.inert = !open;
      branch.setAttribute("aria-hidden", String(!open));
    }

    updateState() {
      const expanded = !!this.archive && (this.activeSection === this.archive.id || this.dialog.open);
      const current = this.sections.find(({ element }) => element.id === this.activeSection) || this.sections[0];
      const inArchive = current?.element === this.archive;
      const label = inArchive ? (this.activeDate ? `${this.activeDate.dataset.year}·${this.activeDate.dataset.month}·${this.activeDate.dataset.date}` : "归档信息")
        : current?.label || this.page.querySelector("h1, h2")?.textContent || "页面导航";
      this.launcher.textContent = label;
      this.rail.querySelector(".trace-heading").textContent = label;
      this.dialog.querySelector("h2").textContent = label;
      this.dialog.querySelector("[data-trace-close]").setAttribute("aria-label", `关闭${label}导航`);
      this.rail.setAttribute("aria-label", `${label} · 页面导航`);
      this.rail.classList.toggle("is-expanded", expanded);
      this.fold(this.branch, expanded);
      for (const { element, link } of this.sectionLinks) {
        if (element === this.archive) link.textContent = "归档信息";
        const selected = element.id === this.activeSection;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
        link.hidden = !this.beforeJump && !!element.closest("[hidden]");
        if (element === this.archive) link.setAttribute("aria-expanded", String(expanded));
      }
      const visibleDate = this.isTraceInteracting ? this.browsingDate : this.activeDate;
      const yearKey = visibleDate?.dataset.year;
      const monthKey = visibleDate?.dataset.month;
      for (const year of this.years) {
        const activeYear = year.key === yearKey;
        year.link.classList.toggle("is-active", activeYear);
        year.link.setAttribute("aria-expanded", "true");
        if (activeYear) year.link.setAttribute("aria-current", "true"); else year.link.removeAttribute("aria-current");
        this.fold(year.branch, true);
        for (const month of year.months) {
          const activeMonth = activeYear && month.key === monthKey;
          month.link.classList.toggle("is-active", activeMonth);
          month.link.setAttribute("aria-expanded", String(activeMonth));
          if (activeMonth) month.link.setAttribute("aria-current", "true"); else month.link.removeAttribute("aria-current");
          this.fold(month.branch, activeMonth);
          if (!activeMonth) continue;
        }
      }
      this.rail.querySelectorAll(".trace-node--day").forEach((link) => {
        const selected = expanded && link.dataset.traceTarget === this.activeDate?.id;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
      });
      const hint = this.rail.querySelector(".trace-rail__current");
      hint.textContent = expanded && this.activeDate ? `${monthKey} · ${this.activeDate.dataset.date}` : "";
      cancelAnimationFrame(this.followFrame);
      this.followFrame = requestAnimationFrame(() => { this.followActive(); this.updateEdges(); });
    }

    scheduleObserve() {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.observe());
    }

    observe() {
      this.observer?.disconnect();
      if (this.root.hidden) return;
      this.updateOffset();
      const line = Math.min(innerHeight - 2, this.offsetTop + 44);
      const visibleSections = new Set();
      const visibleDates = new Set();
      const sectionElements = this.sections.map((section) => section.element).filter((element) => !element.closest("[hidden]"));
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const set = sectionElements.includes(entry.target) ? visibleSections : visibleDates;
          if (entry.isIntersecting) set.add(entry.target); else set.delete(entry.target);
        }
        const section = sectionElements.findLast((element) => visibleSections.has(element));
        const date = this.dates.findLast((element) => visibleDates.has(element))
          || (section === this.archive ? this.dates.findLast(element => element.getBoundingClientRect().top <= line) : null);
        const previousSection = this.activeSection;
        const previousDate = this.activeDate;
        if (section) this.activeSection = section.id;
        else if (!visibleDates.size) this.activeSection = (sectionElements.findLast(element => element.getBoundingClientRect().top <= line) || sectionElements[0])?.id;
        if (date) { this.activeDate = date; this.activeSection = this.archive.id; }
        if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) {
          const last = sectionElements.findLast(element => element.getBoundingClientRect().top < innerHeight);
          if (last) this.activeSection = last.id;
        }
        if (previousSection !== this.activeSection || previousDate !== this.activeDate) this.updateState();
      }, { rootMargin: `-${line}px 0px -${Math.max(0, innerHeight - line - 2)}px 0px`, threshold: 0 });
      [...sectionElements, ...this.dates].forEach((element) => this.observer.observe(element));
      this.updateState();
    }

    updateOffset() {
      const bar = document.querySelector(".topbar");
      this.offsetTop = Math.ceil((bar?.offsetHeight || 64) + 36);
      this.page.style.setProperty("--trace-offset", `${this.offsetTop}px`);
    }

    activate() {
      this.root.hidden = !this.page.classList.contains("is-active");
      if (this.root.hidden) {
        this.restoredHash = null;
        if (this.dialog.open) this.dialog.close();
        this.observer?.disconnect();
      } else {
        this.scheduleObserve();
        this.restoreHash();
      }
    }

    restoreHash() {
      const route = resolveRoute();
      if (!this.root.hidden && route?.page === this.page.id && this.restoredHash !== location.hash) {
        if (this.jump(route.anchor)) this.restoredHash = location.hash;
      }
      if (!route) this.restoredHash = null;
    }

    jump(id, { history = false, smooth = false, focus = false } = {}) {
      const target = document.getElementById(id);
      if (target && this.page.contains(target)) this.beforeJump?.(target);
      if (!target || !this.page.contains(target) || target.hidden || target.closest("[hidden]")) return false;
      this.updateOffset();
      if (this.dialog.open) {
        this.dialog.close();
        // Move immediately: the close event is asynchronous and focus must land in the page.
        this.root.insertBefore(this.rail, this.dialog);
      }
      if (history) {
        window.history.scrollRestoration = "manual";
        window.history.pushState(null, "", this.href(id));
        this.restoredHash = location.hash;
      }
      const date = this.dates.find((element) => element.id === id);
      if (date) { this.activeDate = date; this.activeSection = this.archive.id; }
      else this.activeSection = id;
      this.updateState();
      if (focus) { target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true }); }
      const navigation = this.navigation = (this.navigation || 0) + 1;
      const scroll = () => requestAnimationFrame(() => {
        if (navigation !== this.navigation || this.root.hidden || !target.isConnected) return;
        target.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant", block: "start" });
      });
      // The existing page entrance translates by 8px. Wait for it to settle before anchoring.
      const animations = this.page.getAnimations().filter(animation => animation.playState === "running");
      if (animations.length) void Promise.allSettled(animations.map(animation => animation.finished)).then(scroll);
      else scroll();
      return true;
    }

    open() {
      this.dialog.querySelector(".trace-dialog__body").append(this.rail);
      if (!this.dialog.open) this.dialog.show();
      this.launcher.setAttribute("aria-expanded", "true");
      this.updateState();
    }

    interact() {
      if (!this.isTraceInteracting) this.browsingDate = this.activeDate;
      this.isTraceInteracting = true;
      clearTimeout(this.interactionTimer);
      this.interactionTimer = setTimeout(() => {
        if (this.gesture) { this.interact(); return; }
        this.endInteraction();
      }, 1000);
    }

    endInteraction() {
      clearTimeout(this.interactionTimer);
      clearTimeout(this.holdTimer);
      cancelAnimationFrame(this.pickFrame);
      this.pickNode?.classList.remove("is-preview");
      this.pickNode = null;
      this.launcher.classList.remove("is-pressed");
      this.gesture = null;
      this.scroller.classList.remove("is-dragging");
      this.isTraceInteracting = false;
      this.updateState();
    }

    updateEdges() {
      const { scrollTop, scrollHeight, clientHeight } = this.scroller;
      this.scroller.classList.toggle("has-above", scrollTop > 2);
      this.scroller.classList.toggle("has-below", scrollTop + clientHeight < scrollHeight - 2);
    }

    followActive() {
      if (this.root.hidden || this.isTraceInteracting || !this.scroller.clientHeight) return;
      const node = this.scroller.querySelector('.trace-node--day[aria-current="true"]')
        || this.scroller.querySelector('.trace-node--section[aria-current="true"]');
      if (!node || !node.getClientRects().length) return;
      const box = node.getBoundingClientRect(), viewport = this.scroller.getBoundingClientRect();
      // Scroll only this list; scrollIntoView would also move the page.
      if (box.top < viewport.top + 12) this.scroller.scrollTop += box.top - viewport.top - 12;
      else if (box.bottom > viewport.bottom - 12) this.scroller.scrollTop += box.bottom - viewport.bottom + 12;
    }

    installGestures(options) {
      this.root.addEventListener("click", event => {
        if (performance.now() < (this.suppressClickUntil || 0) && event.detail !== 0) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
      }, { ...options, capture: true });
      this.scroller.addEventListener("wheel", () => this.interact(), { ...options, passive: true });
      this.rail.addEventListener("wheel", event => {
        if (event.ctrlKey || this.scroller.contains(event.target) || !this.rail.classList.contains("is-expanded")) return;
        // The fixed title forwards wheel input without introducing a second scroll area.
        event.preventDefault();
        this.interact();
        const unit = event.deltaMode === 1 ? 28 : event.deltaMode === 2 ? this.scroller.clientHeight : 1;
        this.scroller.scrollTop += event.deltaY * unit;
      }, { ...options, passive: false });
      this.scroller.addEventListener("scroll", () => {
        this.updateEdges();
        if (this.isTraceInteracting) this.interact();
      }, { ...options, passive: true });
      this.scroller.addEventListener("keydown", event => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) this.interact();
      }, options);
      this.scroller.addEventListener("transitionend", () => this.followActive(), options);
      this.root.addEventListener("dragstart", event => event.preventDefault(), options);
      this.root.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.button !== 0 || event.target.closest("[data-trace-close]")) return;
        const inside = this.scroller.contains(event.target);
        if (!inside && !this.launcher.contains(event.target) && !this.dialog.contains(event.target)) return;
        this.interact();
        const fromLauncher = this.launcher.contains(event.target);
        this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
          scroll: this.scroller.scrollTop, open: this.dialog.open, inside,
          mouse: event.pointerType === "mouse", select: fromLauncher || event.pointerType !== "mouse", direction: null };
        if (fromLauncher) {
          event.preventDefault();
          this.root.setPointerCapture(event.pointerId);
          this.open();
          this.gesture.inside = true;
          this.gesture.scroll = this.scroller.scrollTop;
          this.suppressClickUntil = performance.now() + 500;
          this.launcher.classList.add("is-pressed");
        }
      }, options);
      this.root.addEventListener("pointermove", event => {
        const g = this.gesture;
        if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.x, dy = event.clientY - g.y;
        if (!g.direction && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
          if (this.compact.matches && Math.abs(dx) > Math.abs(dy) * 1.2) g.direction = "horizontal";
          else g.direction = "vertical";
        }
        if (g.direction === "horizontal") {
          clearTimeout(this.holdTimer);
          event.preventDefault();
          this.root.setPointerCapture(event.pointerId);
          if (!this.dialog.open) this.open();
          this.dialog.classList.add("is-swiping");
          const width = this.dialog.offsetWidth + 8;
          g.offset = Math.max(0, Math.min(width, (g.open ? 0 : width) + dx));
          this.dialog.style.transform = `translateY(-50%) translateX(${g.offset}px)`;
          this.suppressClickUntil = performance.now() + 500;
        } else if (g.direction === "vertical" && (g.inside || this.compact.matches)) {
          event.preventDefault();
          clearTimeout(this.holdTimer);
          if (this.compact.matches && !this.dialog.open) { this.open(); g.inside = true; }
          this.root.setPointerCapture(event.pointerId);
          this.scroller.classList.add("is-dragging");
          if (!g.select) this.scroller.scrollTop = g.scroll - dy;
          this.suppressClickUntil = performance.now() + 500;
          if (g.select) {
            g.pickX = event.clientX; g.pickY = event.clientY;
            this.previewPick();
          }
        }
      }, { ...options, passive: false });
      const finish = event => {
        if (event.type === "lostpointercapture" && event.target !== this.root) return;
        const g = this.gesture;
        if (!g || g.id !== event.pointerId) return;
        clearTimeout(this.holdTimer);
        cancelAnimationFrame(this.pickFrame);
        if (g.direction || g.select) this.suppressClickUntil = performance.now() + 500;
        this.launcher.classList.remove("is-pressed");
        const pick = event.type === "pointerup" && g.direction === "vertical" && g.select ? this.pickNode?.dataset.traceTarget : null;
        this.pickNode?.classList.remove("is-preview");
        this.pickNode = null;
        if (g.direction === "horizontal") {
          const keepOpen = event.type === "pointercancel" ? g.open : g.offset < (this.dialog.offsetWidth + 8) * (g.open ? .35 : .65);
          this.dialog.classList.remove("is-swiping");
          this.dialog.style.removeProperty("transform");
          if (!keepOpen) this.dialog.close();
        }
        this.gesture = null;
        this.scroller.classList.remove("is-dragging");
        if (this.root.hasPointerCapture(event.pointerId)) this.root.releasePointerCapture(event.pointerId);
        this.interact();
        if (pick) this.jump(pick, { history: true, smooth: false, focus: true });
      };
      this.root.addEventListener("pointerup", finish, options);
      this.root.addEventListener("pointercancel", finish, options);
      this.root.addEventListener("lostpointercapture", finish, options);
    }

    previewPick() {
      cancelAnimationFrame(this.pickFrame);
      const g = this.gesture;
      if (!g || !this.dialog.open) return;
      const viewport = this.scroller.getBoundingClientRect();
      this.pickNode?.classList.remove("is-preview");
      this.pickNode = null;
      if (g.pickX < viewport.left - 32 || g.pickX > viewport.right + 32 || g.pickY < viewport.top || g.pickY > viewport.bottom) return;
      const nodes = [...this.scroller.querySelectorAll("a[data-trace-target]")].filter(node => {
        const box = node.getBoundingClientRect();
        return !node.closest('[hidden], [inert]') && box.height > 0 && box.bottom > viewport.top && box.top < viewport.bottom;
      });
      this.pickNode = nodes.reduce((best, node) => {
        const distance = el => Math.abs(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 - g.pickY);
        return !best || distance(node) < distance(best) ? node : best;
      }, null);
      this.pickNode?.classList.add("is-preview");
      // Holding near an edge continues browsing without moving the page.
      const speed = g.pickY < viewport.top + 32 ? -4 : g.pickY > viewport.bottom - 32 ? 4 : 0;
      if (speed) this.pickFrame = requestAnimationFrame(() => { this.scroller.scrollTop += speed; this.previewPick(); });
    }

    destroy() {
      this.abort.abort();
      this.observer?.disconnect();
      this.resizeObserver.disconnect();
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.followFrame);
      cancelAnimationFrame(this.endFrame);
      clearTimeout(this.interactionTimer);
      clearTimeout(this.holdTimer);
      cancelAnimationFrame(this.pickFrame);
      if (this.dialog.open) this.dialog.close();
      this.root.remove();
      this.page.classList.remove("has-trace");
    }
  }

  window.TraceArchive = { render: renderArchive, dateOnly, resolveRoute };
  window.initTraceRail = (options) => new TraceRail(options);
})();
