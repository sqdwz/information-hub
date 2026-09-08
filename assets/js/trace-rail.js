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
      this.root.innerHTML = `<button class="trace-launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="trace-dialog-${page.id}">循迹</button><nav class="trace-rail" aria-label="循迹"><div class="trace-rail__sections"></div><div class="trace-rail__archive"><div class="trace-rail__tree"></div></div><time class="trace-rail__current" aria-hidden="true"></time></nav><dialog class="trace-dialog" id="trace-dialog-${page.id}" aria-labelledby="trace-title-${page.id}"><header><h2 id="trace-title-${page.id}">循迹</h2><button type="button" data-trace-close aria-label="关闭循迹">关闭</button></header><div class="trace-dialog__body"></div></dialog>`;
      document.body.append(this.root);
      page.classList.add("has-trace");
      this.rail = this.root.querySelector(".trace-rail");
      this.tree = this.root.querySelector(".trace-rail__tree");
      this.branch = this.root.querySelector(".trace-rail__archive");
      this.dialog = this.root.querySelector("dialog");
      this.launcher = this.root.querySelector(".trace-launcher");
      this.sectionLinks = sections.map(({ element, label }) => {
        const link = this.link(element.id, label, "trace-node trace-node--section");
        if (element === this.archive) link.classList.add("trace-node--entry");
        this.rail.querySelector(".trace-rail__sections").append(link);
        return { element, link };
      });
      const options = { signal: this.abort.signal };
      this.root.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-trace-target]");
        if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
          event.preventDefault();
          this.jump(link.dataset.traceTarget, { history: true, smooth: true, focus: true });
        }
      }, options);
      this.launcher.addEventListener("click", () => this.open(), options);
      this.root.querySelector("[data-trace-close]").addEventListener("click", () => this.dialog.close(), options);
      this.dialog.addEventListener("click", (event) => { if (event.target === this.dialog) this.dialog.close(); }, options);
      this.dialog.addEventListener("close", () => {
        this.root.insertBefore(this.rail, this.dialog);
        this.launcher.setAttribute("aria-expanded", "false");
        this.updateState();
      }, options);
      window.addEventListener("app:route", () => this.activate(), options);
      window.addEventListener("resize", () => this.scheduleObserve(), options);
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

    // Bounded windows keep even a full month / many years usable without a second scrollbar.
    windowItems(groups, index, size, parent, unit) {
      const start = Math.max(0, Math.min(index - Math.floor(size / 2), groups.length - size));
      const end = Math.min(groups.length, start + size);
      groups.forEach((group, i) => { group.node.hidden = i < start || i >= end; });
      for (const [direction, target] of [["newer", start > 0 ? groups[start - 1] : null], ["older", end < groups.length ? groups[end] : null]]) {
        let link = [...parent.children].find((child) => child.dataset.pager === direction);
        if (!link && target) {
          link = this.link(target.link.dataset.traceTarget, "", "trace-pager");
          link.dataset.pager = direction;
          if (direction === "newer") parent.prepend(link); else parent.append(link);
        }
        if (!link) continue;
        link.hidden = !target;
        if (target) {
          link.dataset.traceTarget = target.link.dataset.traceTarget;
          link.href = target.link.href;
          link.textContent = direction === "newer" ? "较新" : "更早";
          link.setAttribute("aria-label", `${direction === "newer" ? "查看较新" : "查看更早"}${unit}`);
        }
      }
    }

    fold(branch, open) {
      branch.classList.toggle("is-open", open);
      branch.inert = !open;
      branch.setAttribute("aria-hidden", String(!open));
    }

    updateState() {
      const expanded = !!this.archive && (this.activeSection === this.archive.id || this.dialog.open);
      const current = this.sections.find(({ element }) => element.id === this.activeSection) || this.sections[0];
      const label = current?.label || this.page.querySelector("h1, h2")?.textContent || "页面导航";
      this.launcher.textContent = label;
      this.dialog.querySelector("h2").textContent = label;
      this.dialog.querySelector("[data-trace-close]").setAttribute("aria-label", `关闭${label}导航`);
      this.rail.setAttribute("aria-label", `${label} · 页面导航`);
      this.rail.classList.toggle("is-expanded", expanded);
      this.fold(this.branch, expanded);
      for (const { element, link } of this.sectionLinks) {
        const selected = element.id === this.activeSection;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
        link.hidden = !this.beforeJump && !!element.closest("[hidden]");
        if (element === this.archive) link.setAttribute("aria-expanded", String(expanded));
      }
      const yearKey = this.activeDate?.dataset.year;
      const monthKey = this.activeDate?.dataset.month;
      const shortScreen = innerHeight <= 740;
      const yearLimit = shortScreen ? 1 : 3;
      const monthLimit = shortScreen ? 1 : 3;
      const activeMonths = this.years.find(year => year.key === yearKey)?.months || [];
      const sectionHeight = shortScreen ? 0 : this.dialog.open ? this.sections.length * 32 : innerWidth <= 1200 ? 36 : this.sections.length * 36;
      const rowHeight = shortScreen ? 24 : this.dialog.open ? 32 : 28;
      const reserved = sectionHeight + Math.min(yearLimit, this.years.length) * (shortScreen ? 24 : 34)
        + Math.min(monthLimit, activeMonths.length) * (shortScreen ? 24 : 28) + 36
        + (this.years.length > yearLimit ? 44 : 0) + (activeMonths.length > monthLimit ? 44 : 0) + 44;
      const available = innerHeight - (this.dialog.open ? 128 : 196);
      const dayLimit = Math.max(2, Math.min(9, Math.floor((available - reserved) / rowHeight)));
      this.windowItems(this.years, Math.max(0, this.years.findIndex((year) => year.key === yearKey)), yearLimit, this.tree, "年份");
      for (const year of this.years) {
        const activeYear = year.key === yearKey;
        year.link.classList.toggle("is-active", activeYear);
        year.link.setAttribute("aria-expanded", String(activeYear));
        if (activeYear) year.link.setAttribute("aria-current", "true"); else year.link.removeAttribute("aria-current");
        this.fold(year.branch, activeYear);
        if (activeYear) this.windowItems(year.months, Math.max(0, year.months.findIndex((month) => month.key === monthKey)), monthLimit, year.children, "月份");
        for (const month of year.months) {
          const activeMonth = activeYear && month.key === monthKey;
          month.link.classList.toggle("is-active", activeMonth);
          month.link.setAttribute("aria-expanded", String(activeMonth));
          if (activeMonth) month.link.setAttribute("aria-current", "true"); else month.link.removeAttribute("aria-current");
          this.fold(month.branch, activeMonth);
          if (!activeMonth) continue;
          this.windowItems(month.days, Math.max(0, month.days.findIndex((day) => day.element === this.activeDate)), dayLimit, month.children, "日期");
        }
      }
      this.rail.querySelectorAll(".trace-node--day").forEach((link) => {
        const selected = expanded && link.dataset.traceTarget === this.activeDate?.id;
        link.classList.toggle("is-active", selected);
        if (selected) link.setAttribute("aria-current", "true"); else link.removeAttribute("aria-current");
      });
      const hint = this.rail.querySelector(".trace-rail__current");
      hint.textContent = expanded && this.activeDate ? `${monthKey} · ${this.activeDate.dataset.date}` : "";
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
      this.dialog.showModal();
      this.launcher.setAttribute("aria-expanded", "true");
      this.updateState();
    }

    destroy() {
      this.abort.abort();
      this.observer?.disconnect();
      this.resizeObserver.disconnect();
      cancelAnimationFrame(this.frame);
      if (this.dialog.open) this.dialog.close();
      this.root.remove();
      this.page.classList.remove("has-trace");
    }
  }

  window.TraceArchive = { render: renderArchive, dateOnly, resolveRoute };
  window.initTraceRail = (options) => new TraceRail(options);
})();
