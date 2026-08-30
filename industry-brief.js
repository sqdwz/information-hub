(() => {
const BRIEF_ENDPOINT = "/data/brief/latest.json";
const BRIEF_FALLBACK_URL = "https://raw.githubusercontent.com/sqdwz/industry-brief/main/data/latest.json";
const BRIEF_INDEX_ENDPOINT = "/data/brief/index.json";
const BRIEF_ARCHIVE_ENDPOINT = "/data/brief/archive";
const GITHUB_BRIEF_BASE_URL = "https://raw.githubusercontent.com/sqdwz/industry-brief/main";
let archiveReports = [];
let selectedArchivePath = null;

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
  if (!url) return escapeHtml(label);
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

function renderIndustryBrief(data, source = "cloudflare") {
  const section = document.querySelector("#ai");
  if (!section || !Array.isArray(data.items)) return;

  const reportType = data.type === "weekly" ? "行业周汇总" : "行业日报";
  const itemCount = data.items.length;
  const dailyCount = data.type === "weekly" ? 0 : itemCount;
  const weeklyCount = data.type === "weekly" ? itemCount : 0;
  const filterLabels = [...new Set(data.items.map((item) => filterLabel(item.category)))];
  const sections = (data.sections || []).map((item) => `
    <article class="brief-section-card">
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.summary)}</p>
    </article>`).join("");
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
    <div class="page-head brief-head panel">
      <div><p class="eyebrow">行业日报与周汇总</p><h2>${escapeHtml(data.title || `${reportType}｜${data.date || ""}`)}</h2>${briefHighlights(data.summary)}<p class="brief-collection">本期已收录：<strong>${dailyCount} 条日报</strong><span>·</span><strong>${weeklyCount} 条周报</strong></p></div>
    </div>
    <div class="brief-notice">数据来自 <a href="https://github.com/sqdwz/industry-brief" target="_blank" rel="noreferrer">sqdwz/industry-brief</a>，${source === "fallback" ? "已使用 GitHub 直连数据" : "由 Cloudflare 自动同步"}。</div>
    <p class="brief-coverage">${escapeHtml(data.coverage_note || "")}</p>
    <div class="brief-filter" aria-label="按标签筛选本期动态">
      <span class="brief-filter__label">标签筛选</span>
      <div class="brief-filter__tags">${filterLabels.map((label) => `<button class="brief-filter__tag" type="button" data-brief-filter="${escapeHtml(label)}" aria-pressed="false">${escapeHtml(label)}</button>`).join("")}</div>
      <p class="brief-filter__hint" aria-live="polite">点击标签筛选，再次点击即可取消。</p>
    </div>
    ${sections ? `<div class="brief-section-grid" data-brief-overview>${sections}</div>` : ""}
    ${tool ? `<div data-brief-overview>${tool}</div>` : ""}
    <h3 class="brief-list-title">本期动态 <span data-brief-count>${itemCount} 条</span></h3>
    <div class="brief-item-grid">${items}</div>
    <section class="brief-archive" data-brief-archive aria-labelledby="brief-archive-title"><p class="brief-archive__loading">正在读取往期归档…</p></section>`;

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
  }));

  const portal = document.querySelector('[data-go="ai"]');
  if (portal) {
    const status = portal.querySelector(".status");
    if (status) {
      status.textContent = "已接入";
      status.classList.add("status--active");
    }
    const metric = portal.querySelector(".portal__metric");
    if (metric) metric.textContent = `${reportType} · ${itemCount} 条 · ${data.date || "最新"}`;
  }
}

function isArchivePath(path) {
  return /^data\/(daily|weekly)\/\d{4}-\d{2}-\d{2}\.json$/.test(path || "");
}

function reportTypeLabel(type) {
  return type === "weekly" ? "周报" : "日报";
}

function reportSearchText(report) {
  const { data } = report;
  return [
    data.title,
    data.summary,
    data.coverage_note,
    ...(data.sections || []).flatMap((item) => [item.name, item.summary]),
    ...(data.items || []).flatMap((item) => [item.category, item.title, item.summary, item.impact, item.publisher])
  ].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");
}

function renderArchiveExplorer() {
  const host = document.querySelector("[data-brief-archive]");
  if (!host) return;
  if (!archiveReports.length) {
    host.innerHTML = `<p class="brief-archive__empty">暂未读取到往期归档。</p>`;
    return;
  }
  const cards = archiveReports.map((report) => {
    const { entry, data } = report;
    const selected = entry.path === selectedArchivePath;
    return `<button class="brief-archive-card${selected ? " is-active" : ""}" type="button" data-brief-archive-path="${escapeHtml(entry.path)}" aria-pressed="${selected}">
      <span>${escapeHtml(reportTypeLabel(entry.type || data.type))}</span>
      <strong>${escapeHtml(entry.date || data.date)}</strong>
      <b>${escapeHtml(entry.title || data.title)}</b>
      <small>${escapeHtml(data.summary || "查看本期完整内容")}</small>
    </button>`;
  }).join("");
  host.innerHTML = `
    <div class="brief-archive__head">
      <div><p class="eyebrow">归档与检索</p><h3 id="brief-archive-title">往期日报与周报</h3><p>输入关键词可在所有已归档期刊的标题、分类、正文和来源中检索。</p></div>
      <label class="brief-archive__search"><span>检索归档</span><input type="search" data-brief-archive-search placeholder="例如：无人机、城市更新、Survey123" autocomplete="off" /></label>
    </div>
    <p class="brief-archive__result" data-brief-archive-result>共 ${archiveReports.length} 期归档；点击卡片即可查看该期全文。</p>
    <div class="brief-archive__cards" aria-label="每一期归档内容">${cards}</div>`;
  host.querySelectorAll("[data-brief-archive-path]").forEach((button) => button.addEventListener("click", () => {
    const report = archiveReports.find((item) => item.entry.path === button.dataset.briefArchivePath);
    if (!report) return;
    selectedArchivePath = report.entry.path;
    renderIndustryBrief(report.data, "cloudflare");
    renderArchiveExplorer();
    document.querySelector("#ai")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  const searchInput = host.querySelector("[data-brief-archive-search]");
  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLocaleLowerCase("zh-CN");
    let matched = 0;
    host.querySelectorAll("[data-brief-archive-path]").forEach((button) => {
      const report = archiveReports.find((item) => item.entry.path === button.dataset.briefArchivePath);
      const visible = !query || reportSearchText(report).includes(query);
      button.classList.toggle("is-search-hidden", !visible);
      if (visible) matched += 1;
    });
    const result = host.querySelector("[data-brief-archive-result]");
    result.textContent = query ? `“${searchInput.value.trim()}”匹配到 ${matched} 期归档；点击卡片查看全文。` : `共 ${archiveReports.length} 期归档；点击卡片即可查看该期全文。`;
  });
}

async function fetchBriefJson(endpoint, fallbackUrl) {
  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`Brief endpoint returned ${response.status}`);
    return await response.json();
  } catch (error) {
    if (!fallbackUrl) throw error;
    const response = await fetch(fallbackUrl, { cache: "no-store" });
    if (!response.ok) throw error;
    return response.json();
  }
}

async function hydrateArchiveReports() {
  const host = document.querySelector("[data-brief-archive]");
  try {
    const index = await fetchBriefJson(BRIEF_INDEX_ENDPOINT, `${GITHUB_BRIEF_BASE_URL}/data/index.json`);
    const entries = (index.recent || []).filter((entry) => isArchivePath(entry.path));
    archiveReports = await Promise.all(entries.map(async (entry) => ({
      entry,
      data: await fetchBriefJson(`${BRIEF_ARCHIVE_ENDPOINT}?path=${encodeURIComponent(entry.path)}`, `${GITHUB_BRIEF_BASE_URL}/${entry.path}`)
    })));
    selectedArchivePath = index.latest_daily || index.latest_weekly || archiveReports[0]?.entry.path || null;
    renderArchiveExplorer();
  } catch (error) {
    console.error("Industry brief archive load failed", error);
    if (host) host.innerHTML = `<p class="brief-archive__empty">往期归档暂时无法读取，请稍后重试。</p>`;
  }
}

function renderBriefError() {
  const section = document.querySelector("#ai");
  if (!section) return;
  section.innerHTML = `<div class="empty-state brief-error"><p>行业数据暂时无法加载。</p><a href="https://github.com/sqdwz/industry-brief" target="_blank" rel="noreferrer">查看数据仓库 ↗</a></div>`;
}

async function loadIndustryBrief() {
  try {
    const response = await fetch(BRIEF_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error(`Industry brief endpoint returned ${response.status}`);
    renderIndustryBrief(await response.json(), "cloudflare");
    await hydrateArchiveReports();
  } catch (endpointError) {
    try {
      const response = await fetch(BRIEF_FALLBACK_URL, { cache: "no-store" });
      if (!response.ok) throw endpointError;
      renderIndustryBrief(await response.json(), "fallback");
      await hydrateArchiveReports();
    } catch {
      console.error("Industry brief load failed", endpointError);
      renderBriefError();
    }
  }
}

loadIndustryBrief();
})();
