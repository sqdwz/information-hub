const DATA_ENDPOINTS = {
  airspace: "/data/airspace.json",
  urban: "/data/urban-renewal/latest.json",
  urbanIndex: "/data/urban-renewal/index.json",
  urbanHistory: "/data/urban-renewal/history",
  policyIndex: "/data/policy/index.json",
  policyCategories: "/data/policy/categories.json",
  policyCategoriesSnapshot: "/data/policy/categories-snapshot.json",
  policyDocument: "/data/policy/document",
  policySnapshot: "/data/policy/snapshot.json",
  policyLocalBase: "/data/policy/"
};
const statusMeta = { active: ["正在生效", "pill--active"], upcoming: ["即将生效", "pill--upcoming"], ended: ["已结束", "pill--ended"], new: ["本轮新增", "pill--upcoming"] };
const policyStatusMeta = {
  current: ["持续适用", "policy-status--current"],
  historical: ["阶段性文件", "policy-status--historical"],
  review: ["效力待复核", "policy-status--review"]
};
const policyLevelLabels = { national: "国家", province: "省级", city: "市县" };
const policyGuideIds = new Set([
  "national-urban-renewal-2025",
  "national-urban-renewal-orderly-2023",
  "national-old-community-2020",
  "national-expropriation-590",
  "hainan-new-urbanization-2017",
  "hainan-urban-renewal-demo-2024"
]);
let airspaceData;
let airspaceFilter = null;
let urbanData;
let urbanHistoryRecords = [];
let urbanHistoryVisibleRecords = [];
let urbanHistoryShown = 0;
let urbanCurrentFilter = null;
let urbanHistoryYear = "";
let urbanHistorySummary = {};
let policyData;
let policyCategories;
let policyItems = [];
const policyRecordCache = new Map();
let activePolicyDetailId = "";

const $ = (selector, scope = document) => scope.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function initWelcomePavilion() {
  const welcome = $("#welcome-pavilion");
  if (!welcome) return;

  const siteShell = $(".site-shell");
  const enterButton = $("#welcome-enter");
  const sparkles = $("#welcome-sparkles");
  const themeColor = $("meta[name='theme-color']");
  const shouldShow = !location.hash || location.hash === "#welcome";

  const preparePanel = () => {
    document.body.classList.remove("has-welcome");
    siteShell?.removeAttribute("inert");
    siteShell?.removeAttribute("aria-hidden");
      if (themeColor) themeColor.content = "#2d4f9f";
    document.title = "信息聚合中心";
  };

  if (!shouldShow) {
    preparePanel();
    welcome.remove();
    return;
  }

  document.body.classList.add("has-welcome");
  document.title = "RUIXUE · Welcome";
  siteShell?.setAttribute("inert", "");
  siteShell?.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 92; index += 1) {
    const spark = document.createElement("i");
    const useSideEdge = Math.random() < .5;
    const left = useSideEdge
      ? (Math.random() < .5 ? Math.random() * 18 : 82 + Math.random() * 18)
      : 18 + Math.random() * 64;
    const top = useSideEdge
      ? Math.random() * 84
      : (Math.random() < .5 ? Math.random() * 18 : 74 + Math.random() * 10);
    spark.className = "welcome-pavilion__spark";
    spark.style.left = `${left}%`;
    spark.style.top = `${top}%`;
    spark.style.setProperty("--size", `${1.5 + Math.random() * 3.5}px`);
    spark.style.setProperty("--drift-x", `${-16 + Math.random() * 32}px`);
    spark.style.setProperty("--drift-y", `${-22 + Math.random() * 18}px`);
    spark.style.setProperty("--duration", `${3 + Math.random() * 4}s`);
    spark.style.setProperty("--delay", `${-Math.random() * 4}s`);
    sparkles?.appendChild(spark);
  }

  let leaving = false;
  enterButton?.addEventListener("click", () => {
    if (leaving) return;
    leaving = true;
    enterButton.disabled = true;
    window.setTimeout(() => {
      preparePanel();
      welcome.remove();
      location.hash = "home";
      const homeTitle = $("#home-title");
      homeTitle?.setAttribute("tabindex", "-1");
      homeTitle?.focus({ preventScroll: true });
    }, 0);
  });
}

const avatarUnlock = $("#avatar-unlock");
const brandHome = $(".brand__home");
let avatarDrag;
let avatarGestureStage = 0;
let avatarMirrorOffset = 0;
let avatarClickSuppressed = false;

function getAvatarSlideDistance() {
  const avatar = avatarUnlock?.getBoundingClientRect();
  const title = brandHome?.getBoundingClientRect();
  if (!avatar || !title) return 80;
  return Math.max(64, title.right - avatar.left - avatar.width / 2);
}

function getAvatarMirrorOffset() {
  const avatar = avatarUnlock?.getBoundingClientRect();
  const title = brandHome?.getBoundingClientRect();
  if (!avatar || !title) return 104;
  return Math.max(64, title.right - avatar.left + 9);
}

function getAvatarLeftSlideDistance() {
  const avatar = avatarUnlock?.getBoundingClientRect();
  const title = brandHome?.getBoundingClientRect();
  if (!avatar || !title) return 88;
  return Math.max(64, avatar.left - title.left + 4);
}

function restoreAvatarPosition() {
  avatarUnlock?.classList.remove("is-dragging");
  if (avatarUnlock) avatarUnlock.style.transform = `translateX(${avatarGestureStage >= 2 ? avatarMirrorOffset : 0}px)`;
}

function finishAvatarDrag(event) {
  if (!avatarDrag || event.pointerId !== avatarDrag.pointerId) return;
  const mirrorOffset = avatarDrag.mirrorOffset;
  const reachedTarget = avatarDrag.direction === "right"
    ? avatarDrag.offset >= avatarDrag.target - 2
    : avatarDrag.offset <= -avatarDrag.target + 2;
  avatarUnlock.releasePointerCapture?.(event.pointerId);
  avatarDrag = undefined;
  if (!reachedTarget) {
    restoreAvatarPosition();
    return;
  }
  if (avatarGestureStage >= 2) {
    restoreAvatarPosition();
    location.hash = "showcase";
    return;
  }
  avatarGestureStage += 1;
  if (avatarGestureStage === 2) avatarMirrorOffset = mirrorOffset;
  restoreAvatarPosition();
}

avatarUnlock?.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button > 0) return;
  avatarClickSuppressed = false;
  const direction = avatarGestureStage >= 2 ? "left" : "right";
  avatarDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    offset: 0,
    direction,
    target: direction === "right" ? getAvatarSlideDistance() : getAvatarLeftSlideDistance(),
    mirrorOffset: getAvatarMirrorOffset()
  };
  avatarUnlock.setPointerCapture(event.pointerId);
});

avatarUnlock?.addEventListener("pointermove", event => {
  if (!avatarDrag || event.pointerId !== avatarDrag.pointerId) return;
  const rawOffset = event.clientX - avatarDrag.startX;
  const offset = avatarDrag.direction === "right"
    ? Math.max(0, Math.min(avatarDrag.target, rawOffset))
    : Math.min(0, Math.max(-avatarDrag.target, rawOffset));
  if (Math.abs(offset) > 3) {
    event.preventDefault();
    avatarClickSuppressed = true;
  }
  avatarDrag.offset = offset;
  avatarUnlock.classList.add("is-dragging");
  const rotation = (Math.abs(offset) / avatarDrag.target) * 360;
  avatarUnlock.style.transform = avatarDrag.direction === "right"
    ? `translateX(${offset}px) rotate(${rotation}deg)`
    : `translateX(${avatarMirrorOffset + offset}px) rotate(${rotation}deg)`;
});

avatarUnlock?.addEventListener("pointerup", finishAvatarDrag);
avatarUnlock?.addEventListener("pointercancel", finishAvatarDrag);
avatarUnlock?.addEventListener("dragstart", event => event.preventDefault());
avatarUnlock?.addEventListener("click", event => {
  if (avatarClickSuppressed) {
    event.preventDefault();
    avatarClickSuppressed = false;
    return;
  }
  $("#share-dialog")?.showModal();
});

$("#share-dialog")?.addEventListener("click", event => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-share]")) event.currentTarget.close();
});

const showcaseTabs = [...document.querySelectorAll("[data-showcase-tab]")];
const showcasePages = [...document.querySelectorAll("[data-showcase-page]")];

function setShowcaseTab(tab) {
  showcaseTabs.forEach(button => {
    const active = button.dataset.showcaseTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  showcasePages.forEach(page => { page.hidden = page.dataset.showcasePage !== tab; });
}

showcaseTabs.forEach(button => button.addEventListener("click", () => setShowcaseTab(button.dataset.showcaseTab)));
setShowcaseTab("share");

function route() {
  const id = location.hash.slice(1) || "home";
  const policyDetailMatch = id.match(/^policy\/([^/]+)$/);
  const page = policyDetailMatch ? "policy-detail" : (document.querySelector(`[data-page="${id}"]`) ? id : "home");
  document.querySelectorAll("[data-page]").forEach(node => node.classList.toggle("is-active", node.dataset.page === page));
  const activeRoute = page === "policy-detail" ? "policy" : page;
  document.querySelectorAll("[data-route]").forEach(node => node.toggleAttribute("aria-current", node.dataset.route === activeRoute));
  if (matchMedia("(max-width: 820px)").matches) {
    const nav = $(".nav");
    const activeLink = document.querySelector(`[data-route="${activeRoute}"]`);
    if (nav && activeLink) nav.scrollTo({ left: Math.max(0, activeLink.offsetLeft + activeLink.offsetWidth - nav.clientWidth), behavior: "instant" });
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  if (policyDetailMatch) loadPolicyDetail(decodeURIComponent(policyDetailMatch[1]));
}

function preferredSources(sources = []) {
  return [...sources].sort((a, b) => Number(b.type === "official") - Number(a.type === "official") || b.authority - a.authority).slice(0, 4);
}

function normalizeNotice(notice) {
  const linkedSources = notice.sources?.length
    ? notice.sources
    : (notice.links || []).map(link => ({
      name: link.name,
      url: link.url,
      type: link.type === "official" ? "official" : "media",
      authority: link.type === "official" ? 5 : Math.max(1, 6 - (link.rank || 5))
    }));
  const fallbackSource = notice.primary_url || notice.url
    ? [{ name: notice.origin_publisher || notice.publisher || "原始来源", url: notice.primary_url || notice.url, type: notice.source_type === "official" ? "official" : "media", authority: notice.source_type === "official" ? 5 : 3 }]
    : [];
  return {
    ...notice,
    region: notice.region || notice.area || "未说明区域",
    published_at: notice.published_at || notice.publish_date || "未说明",
    start_at: notice.start_at || notice.start_time,
    end_at: notice.end_at || notice.end_time,
    sources: linkedSources.length ? linkedSources : fallbackSource
  };
}

function normalizeAirspaceData(data) {
  return {
    ...data,
    notices: (data.notices || []).map(normalizeNotice),
    ended_recent: (data.ended_recent || []).map(normalizeNotice),
    sources: (data.sources || []).map(source => typeof source === "string" ? source : source.name).filter(Boolean)
  };
}

function noticeCard(notice) {
  const [label, className] = statusMeta[notice.status] || statusMeta.new;
  const sources = preferredSources(notice.sources);
  const primarySource = sources[0];
  const official = sources.some(source => source.type === "official");
  const sourceLinks = sources.length
    ? sources.map(source => `<a class="notice-link ${source.type === "official" ? "notice-link--official" : ""}" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.name)} <span aria-hidden="true">↗</span></a>`).join("")
    : "暂未提供";
  const sourceLabel = official ? "官方发布" : "权威转载";
  return `<article class="notice-card notice-card--${escapeHtml(notice.status)}"><div class="notice-card__heading"><h3>${escapeHtml(notice.title)}</h3><div class="notice-flags"><span class="flag flag--source ${official ? "flag--official" : ""}">${sourceLabel}</span><span class="flag flag--status ${className}">${label}</span></div></div><dl class="notice-table"><div><dt>发布机构</dt><dd>${escapeHtml(primarySource?.name || "暂未提供")}</dd></div><div><dt>发布日期</dt><dd>${escapeHtml(notice.published_at)}</dd></div><div><dt>管制区域</dt><dd>${escapeHtml(notice.region)}</dd></div><div><dt>管制时段</dt><dd>${escapeHtml(notice.time_text)}</dd></div><div><dt>通告链接</dt><dd class="notice-links">${sourceLinks}</dd></div><div><dt>摘要</dt><dd>${escapeHtml(notice.summary)}</dd></div></dl><div class="card-actions"><button class="button button--primary" type="button" data-detail="${escapeHtml(notice.id)}">查看详情</button></div></article>`;
}

function renderGroup(selector, notices, emptyText) {
  $(selector).innerHTML = notices.length ? notices.map(noticeCard).join("") : `<div class="empty-card">${emptyText}</div>`;
}

const airspaceFilterLabels = { new: "本次巡检新增", active: "当前生效", upcoming: "即将生效" };

function applyAirspaceFilter(nextFilter) {
  airspaceFilter = airspaceFilter === nextFilter ? null : nextFilter;
  document.querySelectorAll("[data-airspace-filter-section]").forEach((section) => {
    section.hidden = Boolean(airspaceFilter) && section.dataset.airspaceFilterSection !== airspaceFilter;
  });
  document.querySelectorAll("[data-airspace-filter]").forEach((button) => {
    const selected = button.dataset.airspaceFilter === airspaceFilter;
    button.classList.toggle("metric--selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const status = $("#airspace-filter-status");
  if (status) status.textContent = airspaceFilter ? `正在显示“${airspaceFilterLabels[airspaceFilter]}”相关公告；再次点击该统计可取消筛选。` : "";
}

function renderAirspace(data) {
  const notices = data.notices || [];
  const ended = data.ended_recent || [];
  const summary = data.summary || {};
  const reportDate = data.generated_at ? String(data.generated_at).slice(0, 10) : "暂无日期";
  $("#airspace-title-date").textContent = reportDate;
  $("[data-summary-message]").textContent = data.message || "暂未生成巡检结论。";
  $("#new-date").textContent = data.generated_at ? `巡检时间 · ${data.generated_at.slice(0, 10)}` : "";
  $("#airspace-stats").innerHTML = [["new", "本次巡检新增", summary.new || 0], ["active", "当前生效", summary.active || 0], ["upcoming", "即将生效", summary.upcoming || 0]].map(([key, label, value]) => `<button class="metric metric--filter" type="button" data-airspace-filter="${key}" aria-pressed="false"><span>${label}</span><b>${value}<em>条</em></b></button>`).join("");
  document.querySelectorAll("[data-airspace-filter]").forEach((button) => button.addEventListener("click", () => applyAirspaceFilter(button.dataset.airspaceFilter)));
  const isNew = notice => notice.is_new_scan || notice.status === "new";
  renderGroup("#new-list", notices.filter(isNew), "本轮巡检未发现新增公告；后续新增内容会优先显示在这里。");
  renderGroup("#active-list", notices.filter(item => item.status === "active"), "当前没有仍在生效的公告。");
  renderGroup("#upcoming-list", notices.filter(item => item.status === "upcoming"), "暂未发现即将生效的公告。");
  renderGroup("#ended-list", ended, "近期没有需要保留的结束公告。");
  $("#source-list").innerHTML = (data.sources || []).map(source => `<li>${escapeHtml(source)}</li>`).join("");
  $("#home-airspace-metric").textContent = `本轮新增 ${summary.new || 0} 条 · 当前生效 ${summary.active || 0} 条`;
  airspaceFilter = null;
  applyAirspaceFilter(null);
}

function formatUrbanDate(value) {
  if (!value) return "未披露";
  return String(value).replace("T", " ").replace(/([+-]\d{2}:\d{2}|Z)$/, "");
}

function urbanVerificationLabel(item) {
  if (item.verification_status === "verified") return "已核验";
  if (item.verification_status === "expanded") return "扩展候选";
  return "待补官方原文";
}

function urbanCard(item) {
  const isOfficial = String(item.source_level || "").startsWith("official");
  const sourceLabel = isOfficial ? "官方来源" : "补充线索";
  const isAwarded = item.status === "awarded" || /中标|成交|结果/.test(String(item.notice_type || ""));
  const statusLabel = isAwarded ? "已中标" : (item.status === "active" ? "正在招标" : "历史记录");
  const projectType = item.project_type || urbanHistoryProjectType(item);
  const serviceType = Array.isArray(item.service_type) ? item.service_type.join("、") : (item.service_type || urbanHistoryServiceType(item));
  const tags = [...new Set([projectType, serviceType, ...(item.tags || [])].filter((tag) => tag && tag !== "未说明"))].slice(0, 6);
  const source = item.source_url
    ? `<a class="notice-link ${isOfficial ? "notice-link--official" : ""}" href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">查看原文 <span aria-hidden="true">↗</span></a>`
    : "暂未提供";
  const amount = item.award_yuan ?? item.control_price_yuan ?? item.budget_yuan ?? item.project_investment_yuan;
  const amountText = amount !== null && amount !== undefined && amount !== "" && Number.isFinite(Number(amount)) ? `${Number(amount).toLocaleString("zh-CN")} 元` : "未披露";
  const deadlineText = item.deadline
    ? `${formatUrbanDate(item.deadline)} · ${Math.ceil((new Date(item.deadline) - Date.now()) / 86400000) > 0 ? `剩余 ${Math.ceil((new Date(item.deadline) - Date.now()) / 86400000)} 天` : "已截止"}`
    : "未披露";
  const rows = [["项目类型", projectType], ["服务类型", serviceType], ["项目阶段", item.project_stage || "未说明"], ["地区", item.region || item.city || "未说明"], ["公告类型", item.notice_type || "未说明"], ["项目编号", item.project_id || "未披露"], ["采购方式", item.procurement_method || "未说明"], ["采购人", item.purchaser || "未披露"], ["金额", amountText], ["发布日期", item.publish_date || "未说明"], ["截止时间", deadlineText], ["核验状态", urbanVerificationLabel(item)]];
  const badges = [`<span class="flag flag--source ${isOfficial ? "flag--official" : ""}">${sourceLabel}</span>`, `<span class="flag flag--status ${isAwarded ? "pill--ended" : "pill--active"}">${statusLabel}</span>`, ...tags.map((tag) => `<span class="flag flag--tag">${escapeHtml(tag)}</span>`)].join("");
  return `<article class="notice-card urban-card notice-card--${isAwarded ? "ended" : "active"}"><div class="notice-card__heading"><h3>${escapeHtml(item.title)}</h3><div class="notice-flags">${badges}</div></div><p class="urban-card-summary">${escapeHtml(item.summary || "暂无摘要")}</p><dl class="notice-table">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><div class="card-actions">${source}</div></article>`;
}

function renderUrbanSources(checks = []) {
  $("#urban-source-list").innerHTML = checks.length
    ? checks.map((check) => `<li>${escapeHtml(check.source || "公开信息源")} · ${escapeHtml(check.status === "swept" ? "已巡检" : "已核查")}</li>`).join("")
    : "<li>本次来源信息暂未提供。</li>";
}

const urbanCurrentFilterLabels = { new: "今日新增", tender: "正在招标", deadline: "即将截止", expanded: "扩展候选" };

function urbanDateOnly(value) {
  return String(value || "").slice(0, 10);
}

function urbanCurrentItems(data, filter) {
  const active = Array.isArray(data?.items) ? data.items.filter((item) => item.status === "active") : [];
  const expanded = Array.isArray(data?.expanded_candidates) ? data.expanded_candidates : (data?.expanded_candidates ? [data.expanded_candidates] : []);
  const reportDate = urbanDateOnly(data?.date || data?.generated_at);
  if (filter === "new") return active.filter((item) => urbanDateOnly(item.publish_date) === reportDate);
  if (filter === "deadline") return active.filter((item) => item.deadline && new Date(item.deadline).getTime() >= Date.now());
  if (filter === "expanded") return expanded;
  return active;
}

function renderUrbanCurrentItems() {
  if (!urbanData) return;
  const visible = urbanCurrentItems(urbanData, urbanCurrentFilter);
  const title = $("#urban-active-title");
  const note = $("#urban-active-note");
  const label = urbanCurrentFilter ? urbanCurrentFilterLabels[urbanCurrentFilter] : "正在招标";
  title.textContent = label;
  note.textContent = visible.length ? `共 ${visible.length} 条` : `暂无${label}项目`;
  $("#urban-active-list").innerHTML = visible.length ? visible.map(urbanCard).join("") : `<div class="empty-card">当前没有${label}项目。</div>`;
}

function applyUrbanCurrentFilter(nextFilter) {
  urbanCurrentFilter = urbanCurrentFilter === nextFilter ? null : nextFilter;
  document.querySelectorAll("[data-urban-filter]").forEach((button) => {
    const selected = button.dataset.urbanFilter === urbanCurrentFilter;
    button.classList.toggle("metric--selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const status = $("#urban-filter-status");
  if (status) status.textContent = urbanCurrentFilter ? `正在显示“${urbanCurrentFilterLabels[urbanCurrentFilter]}”相关项目；再次点击该统计可取消筛选。` : "";
  renderUrbanCurrentItems();
}

function urbanSummaryText(value) {
  return String(value || "")
    .replace(/source_error/gi, "来源访问异常")
    .replace(/complete\/zero_verified/gi, "“巡检完整/零新增已核验”");
}

function urbanSummaryLabel(value) {
  if (/补录|修正/.test(value)) return "重点修正";
  if (/排除|未纳入|不能确认|暂不能确认/.test(value)) return "排除说明";
  if (/超时|异常|巡检完整|零新增已核验/.test(value)) return "数据完整性";
  return "补充说明";
}

function renderUrbanSummary(note) {
  const container = $("[data-urban-message]");
  const sentences = urbanSummaryText(note || "暂未生成巡检结论。")
    .match(/[^。！？]+[。！？]?/g)
    ?.map(value => value.trim())
    .filter(Boolean) || [];
  const [lead = "暂未生成巡检结论。", ...details] = sentences;
  container.innerHTML = `<h2>${escapeHtml(lead)}</h2>${details.length ? `<ul>${details.map(value => `<li><span>${urbanSummaryLabel(value)}</span><p>${escapeHtml(value)}</p></li>`).join("")}</ul>` : ""}`;
}

function renderUrban(data) {
  const summary = data.summary || {};
  const active = urbanCurrentItems(data);
  const expanded = urbanCurrentItems(data, "expanded");
  const newToday = urbanCurrentItems(data, "new");
  const deadlines = urbanCurrentItems(data, "deadline");
  urbanData = data;
  $("#urban-title-date").textContent = urbanDateOnly(data.generated_at || data.date) || "暂无日期";
  renderUrbanSummary(summary.note);
  $("#urban-current-count").textContent = active.length;
  $("#urban-stats").innerHTML = [["new", "今日新增", summary.new_today ?? newToday.length], ["tender", "正在招标", active.length], ["deadline", "即将截止", deadlines.length], ["expanded", "扩展候选", expanded.length]].map(([key, label, value]) => `<button class="metric metric--filter" type="button" data-urban-filter="${key}" aria-pressed="false"><span>${label}</span><b>${escapeHtml(value)}<em>条</em></b></button>`).join("");
  document.querySelectorAll("[data-urban-filter]").forEach((button) => button.addEventListener("click", () => applyUrbanCurrentFilter(button.dataset.urbanFilter)));
  urbanCurrentFilter = null;
  applyUrbanCurrentFilter(null);
  renderUrbanSources(data.source_checks);
  $("#home-urban-metric").textContent = `今日新增 ${summary.new_today || 0} 条 · 当前有效 ${summary.active_core ?? active.length} 条`;
  if (urbanHistoryRecords.length) refreshUrbanHistory();
}

function recordsFromHistoryDocument(documentData) {
  return ["projects", "records", "items", "events", "secondary_candidates", "expanded_candidates"].flatMap((key) => Array.isArray(documentData?.[key]) ? documentData[key] : []);
}

function urbanHistoryProjectType(item) {
  if (item.project_type) return item.project_type;
  return (item.tags || []).find((tag) => /城市更新|城中村|老旧小区|城市体检/.test(String(tag))) || "未说明";
}

function urbanHistoryServiceType(item) {
  if (Array.isArray(item.service_type)) return item.service_type.join("、");
  if (item.service_type) return item.service_type;
  const types = (item.tags || []).filter((tag) => /设计|施工|监理|测绘|评估|咨询|物业|造价|物探|代建|征收/.test(String(tag)));
  return types.length ? [...new Set(types)].join("、") : "未说明";
}

function urbanHistoryFieldValue(item, field) {
  if (field === "region") return item.region || item.city || "未说明";
  if (field === "projectType") return urbanHistoryProjectType(item);
  if (field === "serviceType") return urbanHistoryServiceType(item);
  if (field === "verification") return urbanVerificationLabel(item);
  return "";
}

function urbanArchiveRecords() {
  const recordKeys = new Map();
  const records = [];
  const extraRecords = [
    ...(Array.isArray(urbanData?.recent_events) ? urbanData.recent_events : []),
    ...(Array.isArray(urbanData?.expanded_candidates) ? urbanData.expanded_candidates : (urbanData?.expanded_candidates ? [urbanData.expanded_candidates] : []))
  ];
  [...extraRecords, ...urbanHistoryRecords].forEach((item) => {
    const keys = [item.id, item.source_url, `${item.title || ""}-${item.publish_date || ""}`].filter(Boolean).map((key) => String(key));
    if (keys.some((key) => recordKeys.has(key))) return;
    records.push(item);
    keys.forEach((key) => recordKeys.set(key, item));
  });
  return records.sort((a, b) => String(b.publish_date || "").localeCompare(String(a.publish_date || "")));
}

function populateUrbanHistoryFilterOptions(records = urbanArchiveRecords()) {
  const filters = [["#urban-history-region", "region"], ["#urban-history-type", "projectType"], ["#urban-history-service", "serviceType"], ["#urban-history-verification", "verification"]];
  filters.forEach(([selector, field]) => {
    const select = $(selector);
    if (!select) return;
    const placeholder = select.options[0]?.outerHTML || "<option value=\"\">全部</option>";
    const values = [...new Set(records.map((item) => urbanHistoryFieldValue(item, field)).filter((value) => value && value !== "未说明"))].sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
    select.innerHTML = placeholder + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  });
}

function renderUrbanHistoryTimeline(records = urbanArchiveRecords()) {
  const timeline = $("#urban-history-timeline");
  if (!timeline) return;
  const years = new Map();
  records.forEach((item) => {
    const year = urbanDateOnly(item.publish_date).slice(0, 4) || "未标注";
    years.set(year, (years.get(year) || 0) + 1);
  });
  const nodes = [...years.entries()].sort(([a], [b]) => String(b).localeCompare(String(a)));
  timeline.innerHTML = `<span class="urban-history-timeline__label">时间线</span><div class="urban-history-timeline__track"><button type="button" class="urban-history-timeline__node ${urbanHistoryYear ? "" : "is-active"}" data-urban-history-year="" aria-pressed="${String(!urbanHistoryYear)}"><b>全部</b><small>${records.length} 条</small></button>${nodes.map(([year, count]) => `<button type="button" class="urban-history-timeline__node ${urbanHistoryYear === year ? "is-active" : ""}" data-urban-history-year="${escapeHtml(year)}" aria-pressed="${String(urbanHistoryYear === year)}"><b>${escapeHtml(year)}</b><small>${count} 条</small></button>`).join("")}</div>`;
  timeline.querySelectorAll("[data-urban-history-year]").forEach((button) => button.addEventListener("click", () => {
    const year = button.dataset.urbanHistoryYear;
    urbanHistoryYear = urbanHistoryYear === year ? "" : year;
    renderUrbanHistoryTimeline();
    applyUrbanHistoryFilters();
  }));
}

function applyUrbanHistoryFilters() {
  const keyword = $("#urban-history-search")?.value.trim().toLowerCase() || "";
  const region = $("#urban-history-region")?.value || "";
  const projectType = $("#urban-history-type")?.value || "";
  const serviceType = $("#urban-history-service")?.value || "";
  const verification = $("#urban-history-verification")?.value || "";
  urbanHistoryVisibleRecords = urbanArchiveRecords().filter((item) => {
    const searchable = [item.title, item.project_id, item.purchaser, item.region, item.city, item.summary, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase();
    return (!keyword || searchable.includes(keyword))
      && (!urbanHistoryYear || urbanDateOnly(item.publish_date).startsWith(urbanHistoryYear))
      && (!region || urbanHistoryFieldValue(item, "region") === region)
      && (!projectType || urbanHistoryFieldValue(item, "projectType") === projectType)
      && (!serviceType || urbanHistoryFieldValue(item, "serviceType") === serviceType)
      && (!verification || urbanHistoryFieldValue(item, "verification") === verification);
  });
  urbanHistoryShown = 0;
  $("#urban-history-list").innerHTML = urbanHistoryVisibleRecords.length ? "" : '<div class="empty-card">没有找到符合筛选条件的历史招标信息。</div>';
  $("#urban-history-filter-status").textContent = `已匹配 ${urbanHistoryVisibleRecords.length} 条历史招标信息`;
  if (urbanHistoryVisibleRecords.length) renderNextUrbanHistory();
  else $("#urban-history-more").hidden = true;
}

function renderNextUrbanHistory() {
  const list = $("#urban-history-list");
  const nextRecords = urbanHistoryVisibleRecords.slice(urbanHistoryShown, urbanHistoryShown + 12);
  list.insertAdjacentHTML("beforeend", nextRecords.map(urbanCard).join(""));
  urbanHistoryShown += nextRecords.length;
  const more = $("#urban-history-more");
  const remaining = urbanHistoryVisibleRecords.length - urbanHistoryShown;
  more.hidden = remaining <= 0;
  more.textContent = remaining > 0 ? `加载更多历史招标信息（剩余 ${remaining} 条）` : "";
}

function refreshUrbanHistory() {
  const records = urbanArchiveRecords();
  const summary = urbanHistorySummary;
  $("#urban-history-count").textContent = records.length;
  $("#urban-history-note").textContent = `近三年 · ${records.length} 条`;
  $("#urban-history-message").textContent = historyIndexNote || `已接入 ${records.length} 条可查询历史招标信息。`;
  $("#urban-history-stats").innerHTML = [["历史项目", records.length, "条"], ["已核验", summary.verified_or_official_index || summary.verified_or_authoritative || 0, "条"], ["待回溯", summary.secondary_pending_backfill || 0, "条"], ["覆盖市县", summary.jurisdictions_with_confirmed_or_candidate_core || 0, "个"]].map(([label, value, unit]) => `<span>${escapeHtml(label)} <b>${escapeHtml(value)}</b> ${unit}</span>`).join("");
  populateUrbanHistoryFilterOptions(records);
  renderUrbanHistoryTimeline(records);
  applyUrbanHistoryFilters();
}

let historyIndexNote = "";

function renderUrbanHistory(historyIndex, documents) {
  const summary = historyIndex.summary || {};
  const uniqueRecords = new Map();
  documents.flatMap(recordsFromHistoryDocument).forEach((item) => {
    const key = item.id || `${item.title || ""}-${item.publish_date || ""}`;
    if (!uniqueRecords.has(key)) uniqueRecords.set(key, item);
  });
  urbanHistoryRecords = [...uniqueRecords.values()].sort((a, b) => String(b.publish_date || "").localeCompare(String(a.publish_date || "")));
  urbanHistorySummary = summary;
  historyIndexNote = historyIndex.note || "";
  refreshUrbanHistory();
}

function setUrbanView(view) {
  document.querySelectorAll("[data-urban-view-button]").forEach((button) => {
    const active = button.dataset.urbanViewButton === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-urban-section]").forEach((section) => {
    section.hidden = section.dataset.urbanSection !== view;
  });
}

async function fetchUrbanHistoryDocument(path) {
  const response = await fetch(`${DATA_ENDPOINTS.urbanHistory}?path=${encodeURIComponent(path)}&v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
  return response.json();
}

async function initUrbanHistory() {
  try {
    const response = await fetch(`${DATA_ENDPOINTS.urbanIndex}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
    const index = await response.json();
    const historyIndex = await fetchUrbanHistoryDocument(index.history?.index_path || "data/history/index.json");
    const documents = await Promise.all((historyIndex.datasets || []).map((dataset) => fetchUrbanHistoryDocument(dataset.path)));
    renderUrbanHistory(historyIndex, documents);
  } catch (error) {
    console.error("Failed to load urban renewal history", error);
    $("#urban-history-note").textContent = "历史数据暂时无法读取";
    $("#urban-history-message").textContent = "无法读取历史招标信息索引，请稍后重试。";
  }
}

function renderUrbanError() {
  $("#urban-title-date").textContent = "暂无日期";
  renderUrbanSummary("数据暂未载入，请稍后重试。");
  $("#urban-active-list").innerHTML = '<div class="empty-card">无法读取城市更新数据备份，请稍后重试。</div>';
  $("#urban-source-list").innerHTML = "";
  $("#home-urban-metric").textContent = "数据暂未载入";
}

async function initUrbanData() {
  try {
    const response = await fetch(`${DATA_ENDPOINTS.urban}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
    renderUrban(await response.json());
  } catch (error) {
    console.error("Failed to load urban renewal data", error);
    renderUrbanError();
  }
}

function policyStatusLabel(status) {
  return policyStatusMeta[status]?.[0] || "状态未标注";
}

function policyDate(value) {
  if (!value) return "未标注";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function populatePolicySelect(selector, entries, getValue = item => item, getLabel = item => item) {
  const select = $(selector);
  if (!select) return;
  const first = select.options[0]?.outerHTML || '<option value="">全部</option>';
  select.innerHTML = first + entries.map(item => `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`).join("");
}

function renderPolicyOverview() {
  const current = policyItems.filter(item => item.status === "current").length;
  const hainan = policyItems.filter(item => item.regions?.includes("海南省")).length;
  const historical = policyItems.filter(item => item.status === "historical").length;
  const stats = [
    ["全部资料", policyItems.length, "all"],
    ["持续适用", current, "current"],
    ["海南文件", hainan, "province"],
    ["阶段性文件", historical, "historical"]
  ];
  $("#policy-stats").innerHTML = stats.map(([label, value, filter]) => `<button class="policy-stat" type="button" data-policy-stat="${filter}"><span>${label}</span><b>${value}</b></button>`).join("");
  $("#policy-overview-note").textContent = policyData.summary || "文件摘要用于快速定位，具体适用情形仍应核对发文机关原文。";
  $("#home-policy-metric").textContent = `${policyItems.length} 份文件 · ${policyItems.filter(item => item.themes?.includes("城市更新")).length} 份城市更新相关`;
  document.querySelectorAll("[data-policy-stat]").forEach(button => button.addEventListener("click", () => {
    const filter = button.dataset.policyStat;
    $("#policy-level").value = filter === "province" ? "province" : "";
    $("#policy-status").value = ["current", "historical"].includes(filter) ? filter : "";
    applyPolicyFilters();
    $("#policy-search").focus({ preventScroll: true });
  }));
}

function renderPolicyTopics() {
  const topics = (policyCategories.themes || []).filter(theme => policyItems.some(item => item.themes?.includes(theme))).slice(0, 6);
  $("#policy-topics").innerHTML = topics.map(theme => `<button type="button" data-policy-topic="${escapeHtml(theme)}">${escapeHtml(theme)}</button>`).join("");
  document.querySelectorAll("[data-policy-topic]").forEach(button => button.addEventListener("click", () => {
    $("#policy-theme").value = $("#policy-theme").value === button.dataset.policyTopic ? "" : button.dataset.policyTopic;
    applyPolicyFilters();
  }));
}

function renderPolicyCoverageGaps() {
  const gaps = policyCategories.coverage_gaps || [];
  const highPriority = gaps.filter(item => item.priority === "high").length;
  $("#policy-gaps-summary").innerHTML = gaps.length
    ? `<b>当前缺少 ${gaps.length} 类配套文件</b><span>其中 ${highPriority} 类为优先收集：市县补偿标准、补偿办法、省级细化规则和城市更新属地办法。</span>`
    : "当前未登记资料覆盖缺口。";
  $("#policy-gaps-list").innerHTML = gaps.slice(0, 8).map(item => `<article class="policy-gap ${item.priority === "high" ? "policy-gap--high" : ""}"><div><span>${escapeHtml(item.level)}</span><span>${escapeHtml(item.status)}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.scope)}</p><small>${escapeHtml(item.reason)}</small></article>`).join("");
}

function policyCard(item) {
  const [statusLabel, statusClass] = policyStatusMeta[item.status] || ["状态未标注", "policy-status--review"];
  const tags = [...(item.regions || []), ...(item.themes || []).slice(0, 3)];
  const hasGuide = policyGuideIds.has(item.id);
  const guideLink = hasGuide ? `<a class="button button--primary" href="./policy-guide.html?id=${encodeURIComponent(item.id)}">文件解读</a>` : "";
  return `<article class="policy-card"><div class="policy-card__meta"><span>${escapeHtml(policyLevelLabels[item.jurisdiction_level] || "未分级")}</span><span class="policy-status ${statusClass}">${escapeHtml(statusLabel)}</span></div><h3>${escapeHtml(item.title)}</h3><p class="policy-card__number">${escapeHtml(item.document_no || "文号未标注")}</p><p class="policy-card__summary">${escapeHtml(item.summary)}</p><div class="policy-card__tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div><div class="policy-card__foot"><p><b>${escapeHtml((item.issuer || []).join("、"))}</b><span>发布于 ${escapeHtml(policyDate(item.published_at))}</span></p><div>${guideLink}<a class="button${hasGuide ? "" : " button--primary"}" href="#policy/${encodeURIComponent(item.id)}">内容要点</a><a class="button" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">原文 ↗</a></div></div></article>`;
}

function applyPolicyFilters() {
  const query = $("#policy-search").value.trim().toLowerCase();
  const level = $("#policy-level").value;
  const theme = $("#policy-theme").value;
  const status = $("#policy-status").value;
  const filtered = policyItems.filter(item => {
    const haystack = [item.title, item.document_no, item.summary, ...(item.issuer || []), ...(item.regions || []), ...(item.themes || [])].join(" ").toLowerCase();
    return (!query || haystack.includes(query))
      && (!level || item.jurisdiction_level === level)
      && (!theme || item.themes?.includes(theme))
      && (!status || item.status === status);
  });

  document.querySelectorAll("[data-policy-topic]").forEach(button => button.classList.toggle("is-active", button.dataset.policyTopic === theme));
  document.querySelectorAll("[data-policy-stat]").forEach(button => {
    const filter = button.dataset.policyStat;
    const selected = (filter === "current" && status === "current" && !level)
      || (filter === "historical" && status === "historical" && !level)
      || (filter === "province" && level === "province" && !status)
      || (filter === "all" && !level && !status && !theme && !query);
    button.classList.toggle("is-active", selected);
  });
  $("#policy-filter-status").textContent = `找到 ${filtered.length} 份资料${query ? `，关键词“${$("#policy-search").value.trim()}”` : ""}`;
  $("#policy-list").innerHTML = filtered.length ? filtered.map(policyCard).join("") : '<div class="empty-card">没有符合当前条件的资料。可以清除筛选后重新检索。</div>';
}

function renderPolicyIndex() {
  policyItems = [...(policyData.items || [])].sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
  populatePolicySelect("#policy-level", policyCategories.jurisdiction_levels || [], item => item.id, item => item.label);
  populatePolicySelect("#policy-theme", policyCategories.themes || []);
  populatePolicySelect("#policy-status", policyCategories.statuses || [], item => item.id, item => item.label);
  renderPolicyOverview();
  renderPolicyTopics();
  renderPolicyCoverageGaps();
  applyPolicyFilters();
}

async function fetchPolicyJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Response is not JSON");
  return response.json();
}

async function fetchPolicyIndex() {
  try {
    const data = await fetchPolicyJson(DATA_ENDPOINTS.policyIndex);
    if (data.items?.length) return data;
  } catch (error) {
    console.warn("Policy index endpoint unavailable; using bundled snapshot", error);
  }
  return fetchPolicyJson(DATA_ENDPOINTS.policySnapshot);
}

async function fetchPolicyCategories() {
  try {
    const data = await fetchPolicyJson(DATA_ENDPOINTS.policyCategories);
    if (!data.jurisdiction_levels?.length || !data.themes?.length || !data.statuses?.length) throw new Error("Policy category dimensions are incomplete");
    return data;
  } catch {
    return fetchPolicyJson(DATA_ENDPOINTS.policyCategoriesSnapshot);
  }
}

async function initPolicyData() {
  try {
    [policyData, policyCategories] = await Promise.all([fetchPolicyIndex(), fetchPolicyCategories()]);
    renderPolicyIndex();
    route();
  } catch (error) {
    console.error("Failed to load policy library", error);
    $("#policy-overview-note").textContent = "无法读取资料索引，请稍后重试。";
    $("#policy-list").innerHTML = '<div class="empty-card">资料源与本地快照均未能载入。</div>';
    $("#home-policy-metric").textContent = "资料索引暂未载入";
  }
}

function localPolicyRecordUrl(path) {
  return `${DATA_ENDPOINTS.policyLocalBase}${String(path || "").replace(/^data\//, "")}`;
}

async function fetchPolicyRecord(item) {
  if (policyRecordCache.has(item.id)) return policyRecordCache.get(item.id);
  const endpoint = `${DATA_ENDPOINTS.policyDocument}?path=${encodeURIComponent(item.record_path)}`;
  const local = localPolicyRecordUrl(item.record_path);
  const localDevelopment = ["127.0.0.1", "localhost"].includes(location.hostname);
  const candidates = localDevelopment ? [local, endpoint] : [endpoint, local];
  let lastError;
  for (const url of candidates) {
    try {
      const record = await fetchPolicyJson(url);
      if (record.id !== item.id) throw new Error("Policy record ID mismatch");
      policyRecordCache.set(item.id, record);
      return record;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Policy record unavailable");
}

function relatedPolicyLinks(record) {
  const related = (record.related_policy_ids || []).map(id => policyItems.find(item => item.id === id)).filter(Boolean);
  if (!related.length) return '<p class="policy-detail__muted">暂未建立相关文件。</p>';
  return `<div class="policy-related">${related.map(item => `<a href="#policy/${encodeURIComponent(item.id)}"><span>${escapeHtml(item.document_no)}</span><b>${escapeHtml(item.title)}</b></a>`).join("")}</div>`;
}

async function loadPolicyDetail(id) {
  if (!policyData) return;
  const item = policyItems.find(candidate => candidate.id === id);
  const container = $("#policy-detail-content");
  if (!item) {
    container.innerHTML = '<h1 id="policy-detail-title">未找到这份文件</h1><p class="policy-detail__muted">资料索引中不存在该记录，可能已经调整或更名。</p>';
    return;
  }
  if (activePolicyDetailId !== id) container.innerHTML = '<div class="empty-card">正在读取文件详情…</div>';
  activePolicyDetailId = id;
  try {
    const record = await fetchPolicyRecord(item);
    if (activePolicyDetailId !== id) return;
    const [statusLabel, statusClass] = policyStatusMeta[record.status] || ["状态未标注", "policy-status--review"];
    container.innerHTML = `<header class="policy-detail__head"><p class="eyebrow"><span></span>${escapeHtml(policyLevelLabels[record.jurisdiction_level] || "文件资料")}</p><div class="policy-detail__badges"><span>${escapeHtml(record.policy_type)}</span><span class="policy-status ${statusClass}">${escapeHtml(statusLabel)}</span></div><h1 id="policy-detail-title">${escapeHtml(record.title)}</h1><p class="policy-detail__number">${escapeHtml(record.document_no || "文号未标注")}</p><p class="policy-detail__summary">${escapeHtml(record.summary)}</p></header><dl class="policy-detail__facts"><div><dt>发文机关</dt><dd>${escapeHtml((record.issuer || []).join("、"))}</dd></div><div><dt>发布日期</dt><dd>${escapeHtml(policyDate(record.published_at))}</dd></div><div><dt>施行日期</dt><dd>${escapeHtml(policyDate(record.effective_at))}</dd></div><div><dt>适用地区</dt><dd>${escapeHtml((record.regions || []).join("、"))}</dd></div></dl><section><h2>适用范围</h2><div class="policy-detail__chips">${(record.applies_to || []).map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div></section><section><h2>核心要点</h2><ol class="policy-highlights">${(record.highlights || []).map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ol><p class="policy-detail__disclaimer"><b>免责声明</b>以上要点仅供信息检索与快速理解，不构成法律意见、行政确认或项目专项审查；请以发文机关最新公开原文及项目所在地现行规定为准。</p></section><section class="policy-detail__notice"><h2>效力与核验说明</h2><p>${escapeHtml(record.status_note || "请以发文机关最新公开文本为准。")}</p><p>本资料于 ${escapeHtml(record.verified_at || "未标注")} 核对公开来源。</p></section><section><h2>相关文件</h2>${relatedPolicyLinks(record)}</section><footer class="policy-detail__actions">${record.guide ? `<a class="button button--primary" href="./policy-guide.html?id=${encodeURIComponent(record.id)}">打开文件解读 →</a>` : ""}<a class="button" href="${escapeHtml(record.source_url)}" target="_blank" rel="noopener">打开官方原文 ↗</a><a class="button" href="#policy">返回检索结果</a></footer>`;
  } catch (error) {
    console.error("Failed to load policy record", { id, error });
    container.innerHTML = `<h1 id="policy-detail-title">${escapeHtml(item.title)}</h1><p class="policy-detail__muted">文件详情暂时无法读取。你仍可直接打开官方原文核对。</p><a class="button button--primary" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">打开官方原文 ↗</a>`;
  }
}

function openDetail(id) {
  const notice = [...(airspaceData?.notices || []), ...(airspaceData?.ended_recent || [])].find(item => item.id === id);
  if (!notice) return;
  const sources = preferredSources(notice.sources).map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.name)}${source.type === "official" ? "（官方）" : ""}</a>`).join("");
  $("#dialog-content").innerHTML = `<p class="eyebrow"><span></span>${escapeHtml(notice.region)}</p><h2 id="dialog-title">${escapeHtml(notice.title)}</h2><div class="meta"><span class="pill">发布时间 ${escapeHtml(notice.published_at)}</span><span class="pill">${escapeHtml(notice.time_text)}</span></div><p class="dialog-summary">${escapeHtml(notice.summary)}</p><h3>相关来源</h3><div class="dialog-sources">${sources || "暂无可跳转的来源"}</div>`;
  $("#notice-dialog").showModal();
}

async function initData() {
  try {
    const freshUrl = `${DATA_ENDPOINTS.airspace}?v=${Date.now()}`;
    let response = await fetch(freshUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
    airspaceData = normalizeAirspaceData(await response.json());
    renderAirspace(airspaceData);
  } catch (error) {
    $("[data-summary-message]").textContent = "数据暂未载入，请稍后重试。";
    $("#active-list").innerHTML = '<div class="empty-card">无法读取空域数据备份，请稍后重试。</div>';
    $("#home-airspace-metric").textContent = "数据暂未载入";
    console.error("Failed to load airspace data", error);
  }
}

function initHomePortalCarousel() {
  const carousel = $(".portal-grid");
  const cards = carousel ? [...carousel.querySelectorAll(".portal")] : [];
  const homePage = $("[data-page='home']");
  if (!carousel || cards.length < 2) return;

  carousel.classList.add("portal-carousel");
  const navigation = document.createElement("div");
  navigation.className = "portal-carousel__nav";
  navigation.setAttribute("aria-label", "切换首页信息板块");
  const navButtons = cards.map((card, index) => {
    const button = document.createElement("button");
    const title = card.querySelector("h2")?.textContent?.trim() || `第 ${index + 1} 张卡片`;
    button.type = "button";
    button.setAttribute("aria-label", `显示${title}`);
    button.addEventListener("click", () => setActive(index, { scrollIntoView: compactViewport.matches }));
    navigation.appendChild(button);
    return button;
  });
  carousel.appendChild(navigation);
  let activeIndex = 0;
  let autoplay = null;
  let paused = false;
  let pointerStart = null;
  let suppressClick = false;
  let wheelLocked = false;
  let scrollTimer = null;
  let resumeTimer = null;
  let programmaticScroll = false;
  const compactViewport = window.matchMedia("(max-width: 820px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const signedOffset = (index) => {
    let offset = index - activeIndex;
    if (offset > cards.length / 2) offset -= cards.length;
    if (offset < -cards.length / 2) offset += cards.length;
    return offset;
  };

  function updateCards({ scrollIntoView = false } = {}) {
    cards.forEach((card, index) => {
      const offset = signedOffset(index);
      const position = offset === 0 ? "current" : Math.abs(offset) === 2 ? "rear" : offset < 0 ? "left" : "right";
      card.dataset.carouselPosition = position;
      card.classList.toggle("is-carousel-active", position === "current");
      card.setAttribute("aria-current", position === "current" ? "true" : "false");
      navButtons[index].classList.toggle("is-active", position === "current");
      navButtons[index].setAttribute("aria-current", position === "current" ? "true" : "false");
    });

    if (compactViewport.matches && scrollIntoView) {
      programmaticScroll = true;
      cards[activeIndex].scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest", inline: "center" });
      window.setTimeout(() => { programmaticScroll = false; }, 700);
    }
  }

  function setActive(nextIndex, options) {
    activeIndex = (nextIndex + cards.length) % cards.length;
    updateCards(options);
  }

  function advance(direction, options) {
    setActive(activeIndex + direction, options);
  }

  function isHomeVisible() {
    return homePage?.classList.contains("is-active") && document.visibilityState === "visible";
  }

  function startAutoplay() {
    if (autoplay || reducedMotion.matches) return;
    autoplay = window.setInterval(() => {
      if (!paused && isHomeVisible()) advance(1, { scrollIntoView: compactViewport.matches });
    }, 2800);
  }

  function pauseTemporarily() {
    paused = true;
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => { paused = false; }, 2800);
  }

  carousel.addEventListener("mouseenter", () => {
    paused = true;
    window.clearTimeout(resumeTimer);
  });
  carousel.addEventListener("mouseleave", () => { paused = false; });

  carousel.addEventListener("wheel", event => {
    if (compactViewport.matches || wheelLocked) return;
    const direction = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(direction) < 8) return;
    event.preventDefault();
    wheelLocked = true;
    advance(direction > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLocked = false; }, 660);
  }, { passive: false });

  carousel.addEventListener("pointerdown", event => {
    if (compactViewport.matches || event.button > 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    paused = true;
    carousel.setPointerCapture?.(event.pointerId);
  });
  carousel.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.pointerId !== event.pointerId) return;
    const distance = event.clientX - pointerStart.x;
    if (Math.abs(distance) > 42) {
      suppressClick = true;
      advance(distance < 0 ? 1 : -1);
    }
    pointerStart = null;
    paused = false;
    carousel.releasePointerCapture?.(event.pointerId);
  });
  carousel.addEventListener("pointercancel", () => {
    pointerStart = null;
    paused = false;
  });

  cards.forEach((card, index) => card.addEventListener("click", event => {
    if (suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
      return;
    }
    if (index !== activeIndex) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setActive(index, { scrollIntoView: compactViewport.matches });
    }
  }));

  carousel.addEventListener("scroll", () => {
    if (!compactViewport.matches || programmaticScroll) return;
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const midpoint = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
      const closestIndex = cards.reduce((bestIndex, card, index) => {
        const best = cards[bestIndex].getBoundingClientRect();
        const current = card.getBoundingClientRect();
        return Math.abs(current.left + current.width / 2 - midpoint) < Math.abs(best.left + best.width / 2 - midpoint) ? index : bestIndex;
      }, 0);
      if (closestIndex !== activeIndex) setActive(closestIndex);
      pauseTemporarily();
    }, 100);
  }, { passive: true });

  compactViewport.addEventListener("change", () => updateCards());
  reducedMotion.addEventListener("change", () => {
    window.clearInterval(autoplay);
    autoplay = null;
    startAutoplay();
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible") paused = true; else paused = false; });

  updateCards();
  startAutoplay();
}

initHomePortalCarousel();
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => { location.hash = button.dataset.go; }));
document.addEventListener("click", event => { const button = event.target.closest("[data-detail]"); if (button) openDetail(button.dataset.detail); if (event.target.matches("[data-close-dialog]")) $("#notice-dialog").close(); });
$("#notice-dialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
window.addEventListener("hashchange", route);
initWelcomePavilion();
route();
initData();
initUrbanData();
initUrbanHistory();
initPolicyData();
$("#urban-history-more")?.addEventListener("click", renderNextUrbanHistory);
document.querySelectorAll("[data-urban-view-button]").forEach((button) => button.addEventListener("click", () => setUrbanView(button.dataset.urbanViewButton)));
$("#urban-history-search")?.addEventListener("input", applyUrbanHistoryFilters);
["#urban-history-region", "#urban-history-type", "#urban-history-service", "#urban-history-verification"].forEach((selector) => $(selector)?.addEventListener("change", applyUrbanHistoryFilters));
$("#urban-history-clear")?.addEventListener("click", () => {
  $("#urban-history-search").value = "";
  ["#urban-history-region", "#urban-history-type", "#urban-history-service", "#urban-history-verification"].forEach((selector) => { $(selector).value = ""; });
  urbanHistoryYear = "";
  renderUrbanHistoryTimeline();
  applyUrbanHistoryFilters();
});
$("#policy-search")?.addEventListener("input", applyPolicyFilters);
["#policy-level", "#policy-theme", "#policy-status"].forEach(selector => $(selector)?.addEventListener("change", applyPolicyFilters));
$("#policy-clear")?.addEventListener("click", () => {
  $("#policy-search").value = "";
  ["#policy-level", "#policy-theme", "#policy-status"].forEach(selector => { $(selector).value = ""; });
  applyPolicyFilters();
});
setUrbanView("current");
