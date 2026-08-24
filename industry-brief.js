(() => {
const BRIEF_ENDPOINT = "/data/brief/latest.json";
const BRIEF_FALLBACK_URL = "https://raw.githubusercontent.com/sqdwz/industry-brief/main/data/latest.json";

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

function renderIndustryBrief(data, source) {
  const section = document.querySelector("#ai");
  if (!section || !Array.isArray(data.items)) return;

  const reportType = data.type === "weekly" ? "行业周汇总" : "行业日报";
  const itemCount = data.items.length;
  const sections = (data.sections || []).map((item) => `
    <article class="brief-section-card">
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.summary)}</p>
    </article>`).join("");
  const items = data.items.map((item) => `
    <article class="brief-item-card">
      <div class="brief-item-meta"><span class="brief-category">${escapeHtml(item.category)}</span><time>${escapeHtml(item.publish_date)}</time></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <p class="brief-item-impact"><strong>项目提示：</strong>${escapeHtml(item.impact)}</p>
      <p class="brief-publisher">来源：${externalLink(item.url, item.publisher, "brief-publisher-link")}</p>
    </article>`).join("");
  const tool = data.tool_recommendation ? `<p class="brief-tool"><strong>本期工具：</strong>${externalLink(data.tool_recommendation.url, data.tool_recommendation.name)} — ${escapeHtml(data.tool_recommendation.reason)}</p>` : "";

  section.innerHTML = `
    <div class="page-head brief-head">
      <div><p class="eyebrow">行业日报与周汇总</p><h2>${escapeHtml(data.title || `${reportType}｜${data.date || ""}`)}</h2><p>${escapeHtml(data.summary || "")}</p></div>
      <div class="brief-stats"><span class="brief-stat"><b>${itemCount}</b>条动态</span><span class="brief-stat"><b>${escapeHtml(data.type === "weekly" ? "周" : "日")}</b>报</span></div>
    </div>
    <div class="brief-notice">数据来自 <a href="https://github.com/sqdwz/industry-brief" target="_blank" rel="noreferrer">sqdwz/industry-brief</a>，${source === "fallback" ? "已使用 GitHub 直连数据" : "由 Cloudflare 自动同步"}。</div>
    <p class="brief-coverage">${escapeHtml(data.coverage_note || "")}</p>
    ${sections ? `<div class="brief-section-grid">${sections}</div>` : ""}
    ${tool}
    <h3 class="brief-list-title">本期动态</h3>
    <div class="brief-item-grid">${items}</div>`;

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
  } catch (endpointError) {
    try {
      const response = await fetch(BRIEF_FALLBACK_URL, { cache: "no-store" });
      if (!response.ok) throw endpointError;
      renderIndustryBrief(await response.json(), "fallback");
    } catch {
      console.error("Industry brief load failed", endpointError);
      renderBriefError();
    }
  }
}

loadIndustryBrief();
})();
