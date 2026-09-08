(() => {
const BRIEF_ENDPOINT = "/data/brief/latest.json";
const BRIEF_INDEX_ENDPOINT = "/data/brief/index.json";
const BRIEF_ARCHIVE_ENDPOINT = "/data/brief/archive";
let archiveReports = [];
let briefTrace;
let archiveQuery = "";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function externalLink(url, label, className = "") {
  if (!/^https?:\/\//i.test(url || "")) return escapeHtml(label);
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span></a>`;
}

function filterLabel(category) {
  return String(category || "其他").split(" /")[0].trim() || "其他";
}

function briefHighlights(summary) {
  const parts = String(summary || "").split(/[；;。]/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  return `<div class="brief-highlights" aria-label="本期重点"><span>本期重点</span><ul>${parts.map((part) => `<li>${escapeHtml(part.replace(/^本次日报聚焦\d+条当天动态[：:]?/, ""))}</li>`).join("")}</ul></div>`;
}

function renderIndustryBrief(data) {
  const section = document.querySelector("#ai");
  if (!section || !Array.isArray(data.items)) return;

  const reportType = data.type === "weekly" ? "行业周汇总" : "行业日报";
  const itemCount = data.items.length;
  const dailyCount = data.type === "weekly" ? 0 : itemCount;
  const weeklyCount = data.type === "weekly" ? itemCount : 0;
  const filterLabels = [...new Set(data.items.map((item) => filterLabel(item.category)))];
  const sections = (data.sections || []).map((item) => {
    const summary = String(item.summary || "").trim() || `本期已收录 ${itemCount} 条${reportType}，下滑即可查看完整动态。`;
    return `<article class="brief-section-card">
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(summary)}</p>
    </article>`;
  }).join("");
  const items = data.items.map((item) => `
    <article class="brief-item-card" data-brief-filter-item="${escapeHtml(filterLabel(item.category))}">
      <div class="brief-item-meta"><span class="brief-category">${escapeHtml(item.category)}</span><time>${escapeHtml(item.publish_date)}</time></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <p class="brief-item-impact"><strong>项目提示：</strong>${escapeHtml(item.impact)}</p>
      <p class="brief-publisher">来源：${externalLink(item.url, item.publisher, "brief-publisher-link")}</p>
    </article>`).join("");
  const tool = data.tool_recommendation ? `<p class="brief-tool"><strong>本期工具：</strong>${externalLink(data.tool_recommendation.url, data.tool_recommendation.name)} — ${escapeHtml(data.tool_recommendation.reason)}</p>` : "";

  section.innerHTML = `
    <div class="page-head panel" id="brief-overview">
      <div><p class="eyebrow">行业简报</p><h2 id="ai-title">${escapeHtml(data.title || `${reportType}｜${data.date || ""}`)}</h2>${briefHighlights(data.summary)}<p class="brief-collection">本期已收录：<strong>${dailyCount} 条日报</strong><span>·</span><strong>${weeklyCount} 条周报</strong></p></div>
    </div>
    <p class="brief-coverage">${escapeHtml(data.coverage_note || "")}</p>
    <div class="brief-filter filter-panel" id="brief-filters" aria-label="按标签筛选本期动态">
      <span class="brief-filter__label filter-panel__label">标签筛选</span>
      <div class="brief-filter__tags filter-panel__controls">${filterLabels.map((label) => `<button class="filter-panel__button" type="button" data-brief-filter="${escapeHtml(label)}" aria-pressed="false">${escapeHtml(label)}</button>`).join("")}</div>
      <p class="brief-filter__hint filter-panel__hint" aria-live="polite">点击标签筛选，再次点击即可取消。</p>
    </div>
    <section id="brief-current" aria-labelledby="brief-current-title">
    ${sections ? `<div class="brief-section-grid" data-brief-overview>${sections}</div>` : ""}
    ${tool ? `<div data-brief-overview>${tool}</div>` : ""}
    <h3 class="brief-list-title" id="brief-current-title">本期动态 <span data-brief-count>${itemCount} 条</span></h3>
    <div class="brief-item-grid">${items}</div>
    </section>
    <section class="brief-archive trace-archive-surface" id="brief-archive" data-brief-archive aria-labelledby="brief-archive-title"><h3 id="brief-archive-title">往期日报与周报</h3><p class="brief-archive__loading">正在读取往期归档…</p></section>`;

  let activeFilter = null;
  const filterButtons = [...section.querySelectorAll("[data-brief-filter]")];
  const filterItems = [...section.querySelectorAll("[data-brief-filter-item]")];
  const overview = [...section.querySelectorAll("[data-brief-overview]")];
  const filterHint = section.querySelector(".brief-filter__hint");
  const filterCount = section.querySelector("[data-brief-count]");

  filterButtons.forEach((button) => button.addEventListener("click", () => {
    const nextFilter = button.dataset.briefFilter;
    activeFilter = activeFilter === nextFilter ? null : nextFilter;
    let visibleCount = 0;

    filterButtons.forEach((tag) => {
      const selected = tag.dataset.briefFilter === activeFilter;
      tag.classList.toggle("is-active", selected);
      tag.setAttribute("aria-pressed", String(selected));
    });
    filterItems.forEach((item) => {
      const visible = !activeFilter || item.dataset.briefFilterItem === activeFilter;
      item.classList.toggle("is-filter-hidden", !visible);
      item.setAttribute("aria-hidden", String(!visible));
      if (visible) visibleCount += 1;
    });
    overview.forEach((item) => {
      item.classList.toggle("is-filter-hidden", Boolean(activeFilter));
      item.setAttribute("aria-hidden", String(Boolean(activeFilter)));
    });
    filterCount.textContent = activeFilter ? `${visibleCount} 条 · ${activeFilter}` : `${itemCount} 条`;
    filterHint.textContent = activeFilter ? `正在显示“${activeFilter}”相关内容；再次点击该标签即可取消。` : "点击标签筛选，再次点击即可取消。";
    briefTrace?.scheduleObserve();
  }));

  const portal = document.querySelector('[data-go="ai"]');
  if (portal) {
    const status = portal.querySelector(".status");
    if (status) {
      status.textContent = "日报 · 周报";
      status.classList.add("status--active");
    }
    const metric = portal.querySelector(".portal__metric");
    if (metric) metric.textContent = `${reportType} · ${itemCount} 条 · ${data.date || "最新"}`;
  }
  const footerReportType = data.type === "weekly" ? "周报" : "日报";
  window.registerFooterUpdate?.("brief", { title: `行业简报 · ${footerReportType}`, date: data.date, href: "#ai" });
}

function isArchivePath(path) {
  return /^data\/(?:daily\/\d{4}-\d{2}-\d{2}|weekly\/(?:\d{4}-\d{2}-\d{2}|\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])))\.json$/.test(path || "");
}

function reportTypeLabel(type) {
  return type === "weekly" ? "周报" : "日报";
}

function reportSearchText(report) {
  const flatten = (value) => value && typeof value === "object" ? Object.values(value).map(flatten).join(" ") : String(value ?? "");
  return flatten([report.entry, report.data]).toLocaleLowerCase("zh-CN");
}

function reportItems(data) {
  const items = [...(data.items || []), ...(data.sections || []).flatMap(section => section.items || [])].filter(item => item && typeof item === "object");
  return [...new Map(items.map(item => [`${item.title}-${item.url || ""}`, item])).values()];
}

function renderReading(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.map(renderReading).join("");
  if (typeof value !== "object") return `<p>${escapeHtml(value)}</p>`;
  const heading = value.title || value.name || value.topic || value.category || value.publisher;
  const copy = [value.summary, value.content, value.body, value.reason, value.description, value.impact].filter(Boolean);
  return `${heading ? `<p><strong>${externalLink(value.url, heading)}</strong></p>` : ""}${copy.map(renderReading).join("")}${!heading && !copy.length ? Object.values(value).map(renderReading).join("") : ""}`;
}

function renderFullReport(data) {
  const sections = (data.sections || []).map(section => `<section><h5>${escapeHtml(section.name)}</h5>${renderReading(section.summary)}${(section.items || []).filter(item => typeof item === "string").map(renderReading).join("")}</section>`).join("");
  const items = reportItems(data).map(item => `<article><div class="brief-item-meta"><span class="brief-category">${escapeHtml(item.category)}</span><time>${escapeHtml(item.publish_date)}</time></div><h5>${escapeHtml(item.title)}</h5>${renderReading(item.summary)}${renderReading(item.body || item.content)}${item.impact ? `<p><strong>项目提示：</strong>${escapeHtml(item.impact)}</p>` : ""}<p>来源：${externalLink(item.url, item.publisher || "查看原文")}</p></article>`).join("");
  const extras = [["core_changes", "核心变化"], ["work_impact", "工作影响"], ["trend", "趋势观察"], ["next_week_watch", "下周关注"], ["tool_recommendation", "本期工具"], ["recommended_reading", "推荐阅读"], ["sources", "信息来源"]].filter(([key]) => data[key]).map(([key, label]) => `<section><h5>${label}</h5>${renderReading(data[key])}</section>`).join("");
  return `${renderReading(data.coverage_note)}${sections}${items}${extras}`;
}

function applyArchiveSearch() {
  const host = document.querySelector("[data-brief-archive]");
  const query = archiveQuery.trim().toLocaleLowerCase("zh-CN");
  const reportsByPath = new Map(archiveReports.map(report => [report.entry.path, report]));
  let matched = 0;
  host.querySelectorAll("[data-brief-archive-path]").forEach(card => {
    const report = reportsByPath.get(card.dataset.briefArchivePath);
    card.hidden = Boolean(query) && !report.searchText.includes(query);
    if (!card.hidden) matched++;
  });
  host.querySelectorAll(".trace-date").forEach(date => { date.hidden = !date.querySelector("[data-brief-archive-path]:not([hidden])"); });
  host.querySelectorAll(".trace-month").forEach(month => { month.hidden = !month.querySelector(".trace-date:not([hidden])"); });
  host.querySelector("[data-brief-archive-result]").textContent = query ? `“${archiveQuery.trim()}”匹配到 ${matched} 期归档。` : `共 ${archiveReports.length} 期归档 · 日报与周报按日期排列 · 可原位展开全文`;
  host.querySelector("[data-brief-no-results]").hidden = matched > 0;
  host.dataset.traceEmpty = query ? "暂无匹配内容" : "暂无往期内容";
  briefTrace?.refresh();
}

function renderArchiveExplorer() {
  const host = document.querySelector("[data-brief-archive]");
  if (!host) return;
  const records = archiveReports.map(report => {
    const { entry, data = {} } = report;
    const date = window.TraceArchive.dateOnly(entry.date) || window.TraceArchive.dateOnly(data.date);
    const tags = [...new Set(reportItems(data).map(item => filterLabel(item.category)))];
    report.searchText = reportSearchText(report);
    return { date, label: reportTypeLabel(entry.type || data.type), html: `<section class="brief-archive-card" data-brief-archive-path="${escapeHtml(entry.path)}">
      <div class="brief-archive-card__meta"><span>${reportTypeLabel(entry.type || data.type)}</span><time datetime="${date}">${date}</time></div>
      <h4>${escapeHtml(entry.title || data.title || "行业简报")}</h4>
      <p class="brief-archive-card__summary">${escapeHtml(data.summary || (report.error ? "本期正文暂时无法读取，稍后可重试。" : "查看本期完整内容"))}</p>
      <div class="brief-archive-card__tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${report.error ? '<button class="button" type="button" data-brief-retry>重新读取本期</button>' : '<details><summary>查看全文</summary><div class="brief-archive-full"></div></details>'}
    </section>` };
  });
  host.innerHTML = `
    <div class="brief-archive__head">
      <div><p class="eyebrow">归档与检索</p><h3 id="brief-archive-title">往期日报与周报</h3><p>输入关键词可在所有已归档期刊的标题、分类、正文和来源中检索。</p></div>
      <label class="brief-archive__search"><span>检索归档</span><input type="search" data-brief-archive-search placeholder="例如：无人机、城市更新、Survey123" autocomplete="off" /></label>
    </div>
    <p class="brief-archive__result" data-brief-archive-result aria-live="polite"></p>
    <p class="brief-archive__empty" data-brief-no-results hidden>${archiveReports.length ? "没有匹配的往期内容，试试其他关键词。" : "暂无往期内容"}</p>
    <div class="brief-archive__cards" aria-label="每一期归档内容">${window.TraceArchive.render(records)}</div>`;
  const reportsByPath = new Map(archiveReports.map(report => [report.entry.path, report]));
  host.querySelectorAll("details").forEach(details => details.addEventListener("toggle", () => {
    const report = reportsByPath.get(details.closest("[data-brief-archive-path]").dataset.briefArchivePath);
    const body = details.querySelector(".brief-archive-full");
    if (details.open && !body.hasChildNodes()) body.innerHTML = renderFullReport(report.data);
    details.querySelector("summary").textContent = details.open ? "收起全文" : "查看全文";
  }));
  host.querySelectorAll("[data-brief-retry]").forEach(button => button.addEventListener("click", async () => {
    const report = reportsByPath.get(button.closest("[data-brief-archive-path]").dataset.briefArchivePath);
    button.disabled = true;
    button.textContent = "正在读取…";
    try {
      report.data = await fetchBriefJson(`${BRIEF_ARCHIVE_ENDPOINT}?path=${encodeURIComponent(report.entry.path)}`);
      report.error = false;
      const id = button.closest(".trace-date")?.id;
      renderArchiveExplorer();
      if (id) briefTrace.jump(id, { focus: true });
    } catch {
      button.disabled = false;
      button.textContent = "读取失败，点击重试";
    }
  }));
  const searchInput = host.querySelector("[data-brief-archive-search]");
  searchInput.value = archiveQuery;
  searchInput.addEventListener("input", () => { archiveQuery = searchInput.value; applyArchiveSearch(); });
  applyArchiveSearch();
  if (!briefTrace) initBriefTrace();
}

function initBriefTrace() {
  briefTrace = window.initTraceRail({
    page: document.querySelector("#ai"),
    sections: [
      { element: document.querySelector("#brief-overview"), label: "概览" },
      { element: document.querySelector("#brief-filters"), label: "标签筛选" },
      { element: document.querySelector("#brief-current"), label: "本期内容" },
      { element: document.querySelector("#brief-archive"), label: "循迹" }
    ],
    archiveTrigger: document.querySelector("#brief-archive")
  });
}

async function fetchBriefJson(endpoint) {
  const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Brief endpoint returned ${response.status}`);
  return response.json();
}

async function hydrateArchiveReports() {
  const host = document.querySelector("[data-brief-archive]");
  try {
    const index = await fetchBriefJson(BRIEF_INDEX_ENDPOINT);
    const entries = [...new Map((index.recent || []).filter(entry => isArchivePath(entry.path)).map(entry => [entry.path, entry])).values()];
    archiveReports = entries.map(entry => ({ entry }));
    // Bound requests when the archive grows. A single unavailable issue never hides the others.
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, archiveReports.length) }, async () => {
      while (next < archiveReports.length) {
        const report = archiveReports[next++];
        try { report.data = await fetchBriefJson(`${BRIEF_ARCHIVE_ENDPOINT}?path=${encodeURIComponent(report.entry.path)}`); }
        catch { report.error = true; }
      }
    }));
    renderArchiveExplorer();
  } catch (error) {
    console.error("Industry brief archive load failed", error);
    if (host) {
      host.innerHTML = `<h3 id="brief-archive-title">往期日报与周报</h3><p class="brief-archive__empty">往期归档暂时无法读取。</p><button class="button" type="button" data-retry-archives>重新读取归档</button>`;
      host.dataset.traceEmpty = "往期内容暂不可用";
      host.querySelector("[data-retry-archives]").addEventListener("click", hydrateArchiveReports, { once: true });
      if (briefTrace) briefTrace.refresh(); else initBriefTrace();
    }
  }
}

function renderBriefError() {
  const section = document.querySelector("#ai");
  if (!section) return;
  section.innerHTML = `<div class="empty-state brief-error"><p>行业数据暂时无法加载，请稍后重试。</p></div>`;
}

async function loadIndustryBrief() {
  try {
    const response = await fetch(BRIEF_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`Industry brief endpoint returned ${response.status}`);
    renderIndustryBrief(await response.json());
    await hydrateArchiveReports();
  } catch (endpointError) {
    console.error("Industry brief load failed", endpointError);
    renderBriefError();
  }
}

loadIndustryBrief();
})();
