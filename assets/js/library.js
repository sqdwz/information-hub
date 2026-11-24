import {
  classificationSource, featuredLandCodes, filterLand, landCsv, landSceneUrl, readLandData, symbolForLand, symbolVariants
} from "./library-model.js?v=20261124-hd";
import { initializeLandGallery } from "./land-gallery.js?v=20261124-hd";

const sections = [
  { id: "library", title: "资料库首页" },
  {
    id: "policy", title: "政策法规类", icon: "scale", art: "books", unit: "份文件",
    description: "查阅城市更新、征收补偿、老旧小区改造等公开文件。"
  },
  {
    id: "land-atlas", title: "地类图鉴", icon: "layers", art: "layers", unit: "条地类",
    description: "按代码、名称和分类查找地类，查看释义、识别要点及教学图式。"
  }
];

const libraryAnchors = {
  library: [
    ["library-overview", "资料库首页"], ["library-find", "资料检索"],
    ["library-categories", "栏目分类"], ["library-highlights", "推荐与结果"]
  ],
  "land-atlas": [
    ["atlas-overview", "地类图鉴"], ["atlas-find", "快速查询"],
    ["atlas-stats", "收录统计"], ["atlas-catalog", "分类浏览"], ["atlas-sources", "标准说明"]
  ],
  "land-detail": [
    ["land-overview", "地类概览"], ["land-definition", "定义"], ["land-usage", "用途"],
    ["land-identify", "识别方法"], ["land-related", "地类对照"],
    ["land-symbols", "相关图式"], ["land-sources", "标准依据"]
  ]
};

const icons = {
  book: '<path d="M12 5a5 5 0 0 0-4-2H3v16h5a5 5 0 0 1 4 2m0-16a5 5 0 0 1 4-2h5v16h-5a5 5 0 0 0-4 2m0-16v16"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  scale: '<path d="M12 3v17M6 21h12M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  enlarge: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  doc: '<path d="M7 2h7l5 5v15H5V2h2Zm7 0v6h5M8 13h8m-8 4h8"/>'
};

const icon = name => '<svg class="library-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">' + icons[name] + '</svg>';
const select = selector => document.querySelector(selector);
const atlasSize = 15;
const initialAtlas = { query: "", medium: "", level: "", category: "", sort: "featured", view: "grid", page: 1 };

export function isLibraryPage(page) {
  return sections.some(section => section.id === page) || page === "policy-detail" || page === "land-detail";
}

function atlasSearchLink(query) {
  return "#land-atlas" + (query ? "?" + new URLSearchParams({ q: query }) : "");
}

function landLink(code) {
  return "#land-atlas?" + new URLSearchParams({ code });
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initializeLibrary(escapeHtml, copyText) {
  const atlas = { ...initialAtlas };
  const gallery = initializeLandGallery();
  let atlasResults = [];
  let policyItems;
  let land;
  let landLoad;
  let landError = false;
  let page = "";
  let detailCode = "";
  let atlasPosition = 0;
  let atlasReturnCode;
  let railFrame = 0;
  let railButtons = [];
  let selectedAnchor;
  let symbolId = 0;
  const landingQuery = select("#library-query");
  const scopeSelect = select("#library-scope");
  const atlasQuery = select("#atlas-query");
  const galleryButton = select("#atlas-gallery");
  const detail = select("#land-detail-content");
  const sectionCounts = {
    policy: () => policyItems?.length,
    "land-atlas": () => land?.records.length
  };

  function symbolSvg(record, variant, standalone = false) {
    const style = symbolForLand(record, variant);
    const id = standalone ? "teaching-pattern" : "teaching-pattern-" + ++symbolId;
    const tile = 16 * style.density;
    const name = escapeHtml(record.code + " " + record.name + " · 教学示意");
    const access = standalone ? "" : ' aria-hidden="true" focusable="false"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 64" preserveAspectRatio="xMidYMid slice"' + access + '><title>' + name + '</title>' +
      (standalone ? '<desc>' + style.sourceLocator + '。' + style.verificationStatus + '。仅供教学学习。</desc>' : "") +
      '<defs><pattern id="' + id + '" width="' + tile + '" height="' + tile + '" viewBox="0 0 16 16" patternUnits="userSpaceOnUse"><g fill="none" stroke="' +
      style.strokeColor + '" stroke-width="1">' + style.pattern + '</g></pattern></defs><path fill="' + style.fillColor +
      '" d="M0 0h240v64H0z"/><path fill="url(#' + id + ')" d="M0 0h240v64H0z"/></svg>';
  }

  function renderTabs(active, atlasHref = "#land-atlas") {
    return '<nav class="library-tabs" aria-label="资料库栏目">' + sections.map(section =>
      '<a href="' + (section.id === "land-atlas" ? atlasHref : "#" + section.id) + '"' +
      (active === section.id ? ' aria-current="page"' : "") + '>' +
      (section.icon ? icon(section.icon) : "") + section.title + '</a>'
    ).join("") + "</nav>";
  }

  function renderCategories() {
    select("#library-categories").innerHTML = sections.slice(1).map(section => {
      const count = sectionCounts[section.id]();
      const error = section.id === "policy" ? policyItems === null : landError;
      const countText = count === undefined ? (error ? "收录数量暂不可用" : "正在统计…") : count + " " + section.unit;
      return '<a class="library-category library-panel" href="#' + section.id + '" data-library-art="' + section.art + '">' +
        '<span class="library-emblem">' + icon(section.icon) + '</span><h2>' + section.title + '</h2><span class="library-category__count">' +
        countText + '</span><p>' + section.description + '</p><span class="library-category__arrow">' + icon("arrow") + '</span></a>';
    }).join("");
  }

  function sceneImage(record, { eager = false } = {}) {
    return '<img class="land-scene" src="' + escapeHtml(landSceneUrl(record).href) +
      '" alt="" width="384" height="384" loading="' + (eager ? "eager" : "lazy") + '" decoding="async">';
  }

  function landingCard({ href, art, record, type, title, meta }) {
    const cover = art ? ' data-library-art="' + art + '"' : "";
    return '<a class="library-highlight" href="' + escapeHtml(href) + '"><div class="library-highlight__cover"' + cover +
      '>' + (record ? sceneImage(record) : "") + '<span>' + type + '</span></div><div class="library-highlight__body"><h3>' + escapeHtml(title) +
      '</h3><p class="library-note">' + escapeHtml(meta) + '</p></div></a>';
  }

  function renderLanding() {
    const query = landingQuery.value.trim();
    const normalized = query.toLocaleLowerCase();
    const scope = scopeSelect.value;
    const showPolicy = !query || scope !== "land-atlas";
    const showLand = !query || scope !== "policy";
    const policyMatches = showPolicy && policyItems ? policyItems.filter(item =>
      !query || [item.title, item.document_no, item.summary, ...(item.themes || []), ...(item.regions || []), ...(item.issuer || [])]
        .join(" ").toLocaleLowerCase().includes(normalized)
    ) : [];
    const landMatches = showLand && land ? (query ? filterLand(land.records, { query }) :
      featuredLandCodes.slice(0, 2).map(code => land.byCode.get(code)).filter(Boolean)) : [];
    const list = [
      ...policyMatches.slice(0, query ? 6 : 2).map(item => ({
        href: "#policy/" + encodeURIComponent(item.id), art: "books", type: "政策法规",
        title: item.title, meta: [item.document_no, item.published_at].filter(Boolean).join(" · ")
      })),
      ...landMatches.slice(0, query ? 6 : 2).map(record => ({
        href: landLink(record.code), record, type: "地类图鉴",
        title: record.code + " " + record.name, meta: record.level + " 级 · " + record.medium
      }))
    ];
    select("#library-scope-label").hidden = !query;
    select("#library-highlights-title").innerHTML = icon(query ? "search" : "book") + (query ? "搜索结果" : "推荐内容");
    const loading = (showPolicy && policyItems === undefined) || (showLand && !land && !landError);
    const unavailable = (showPolicy && policyItems === null) || (showLand && landError);
    let status = "";
    if (query) {
      const limitNote = policyMatches.length > 6 || landMatches.length > 6 ? "，每个栏目显示前 6 条" : "";
      status = loading ? "正在检索资料…" : "找到 " + (policyMatches.length + landMatches.length) + " 条" + limitNote;
    } else if (!list.length) {
      status = loading ? "正在载入推荐资料…" : "暂无可显示的资料";
    }
    if (unavailable) status += (status ? " · " : "") + "部分资料暂未载入";
    select("#library-search-status").textContent = status;
    const links = [
      query && policyMatches.length > 6 && '<button class="library-button" type="button" id="library-all-policy">查看全部政策结果 ' + icon("arrow") + '</button>',
      query && landMatches.length > 6 && '<a class="library-button" href="' + atlasSearchLink(query) + '">查看全部地类结果 ' + icon("arrow") + '</a>'
    ].filter(Boolean);
    select("#library-highlights-grid").innerHTML = list.map(landingCard).join("") +
      (links.length ? '<div class="library-search-more">' + links.join("") + '</div>' : "");
    select("#library-all-policy")?.addEventListener("click", () => {
      const search = select("#policy-search");
      for (const id of ["#policy-level", "#policy-theme", "#policy-status"]) select(id).value = "";
      search.value = query;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      location.hash = "policy";
    });
  }

  function renderAtlasStats() {
    const labels = [["收录地类", land.records.length], ...["一级", "二级", "三级"].map((name, index) =>
      [name, land.records.filter(record => record.level === index + 1).length])];
    select("#atlas-stats").innerHTML = labels.map(([label, value]) =>
      "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>"
    ).join("") + '<div class="atlas-stats__note">以上为本站收录条目统计</div>';
  }

  function renderSources() {
    return '<ul class="library-sources">' +
      '<li><a href="' + classificationSource.url + '" target="_blank" rel="noopener">' + icon("doc") + '<span>' + classificationSource.name +
      '<small>' + classificationSource.reference + ' · 分类指南（2023 版）</small></span><span aria-hidden="true">↗</span></a></li>' +
      '<li><a href="https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=224BF9DA69F053DA22AC758AAAADEEAA" target="_blank" rel="noopener">' +
      icon("doc") + '<span>土地利用现状分类<small>GB/T 21010—2017 · 对照标准</small></span><span aria-hidden="true">↗</span></a></li></ul>' +
      '<p class="library-note">指南统计口径为 24 个一级类、113 个二级类、140 个三级类。本站展示附件整理的显式编码，条目释义待逐项校对。</p>' +
      '<p class="library-note">场景图片为 AI 生成的科普示意。</p>';
  }

  function atlasCard(record) {
    const root = land.byCode.get(record.code.slice(0, 2));
    const description = escapeHtml("查看 " + record.code + " " + record.name + " 高清图");
    return '<div class="atlas-card-shell"><a class="atlas-card library-panel" href="' + landLink(record.code) + '" data-land-code="' + record.code + '">' +
      '<div class="atlas-card__cover">' + sceneImage(record) +
      '<span class="atlas-card__photo-label">场景示意</span><span class="library-tag">' + escapeHtml(root.name) + '</span></div>' +
      '<div class="atlas-card__body"><h3><b>' + record.code + '</b> ' + escapeHtml(record.name) + '</h3>' +
      '<p>' + escapeHtml(record.summary) + '</p></div><div class="atlas-card__symbol"><span>教学示意 <small>未核验</small></span><div>' +
      symbolSvg(record, "color") + '</div></div></a>' +
      '<button type="button" class="atlas-photo-open" data-open-land-photo="' + record.code +
      '" aria-label="' + description + '" title="' + description + '">' + icon("enlarge") + '</button></div>';
  }

  function emptyState(message, action = "") {
    return '<div class="library-panel library-empty"><p>' + message + '</p>' + action + '</div>';
  }

  function renderAtlas() {
    const cards = select("#atlas-cards");
    select("#atlas-pagination").hidden = true;
    if (!land) {
      galleryButton.disabled = true;
      select("#atlas-count").textContent = landError ? "地类数据暂未载入" : "正在载入地类…";
      cards.innerHTML = landError ? emptyState("暂时无法读取地类分类数据。",
        '<button type="button" class="library-button" data-land-retry>重试</button>') : "";
      return;
    }

    const results = atlasResults = filterLand(land.records, atlas);
    galleryButton.disabled = results.length === 0;
    const pages = Math.max(1, Math.ceil(results.length / atlasSize));
    atlas.page = Math.min(atlas.page, pages);
    select("#atlas-count").textContent = "找到 " + results.length + " 条 / 收录 " + land.records.length + " 条";
    for (const property of ["medium", "level", "view"]) {
      for (const button of document.querySelectorAll("[data-atlas-" + property + "]")) {
        button.setAttribute("aria-pressed", String(button.dataset["atlas" + property[0].toUpperCase() + property.slice(1)] === atlas[property]));
      }
    }
    select("#atlas-category").value = atlas.category;
    select("#atlas-sort").value = atlas.sort;
    cards.dataset.view = atlas.view;
    const offset = (atlas.page - 1) * atlasSize;
    cards.innerHTML = results.length ? results.slice(offset, offset + atlasSize).map(atlasCard).join("") :
      emptyState("没有符合当前条件的地类。", '<button type="button" class="library-button" data-atlas-clear>清除筛选</button>');
    select("#atlas-page-number").textContent = "第 " + atlas.page + " / " + pages + " 页";
    select("#atlas-prev").disabled = atlas.page === 1;
    select("#atlas-next").disabled = atlas.page === pages;
    select("#atlas-pagination").hidden = pages === 1;
  }

  function changeAtlasQuery(value) {
    atlas.query = value;
    atlas.page = 1;
    history.replaceState(history.state, "", atlasSearchLink(value.trim()));
    renderAtlas();
  }

  function resetAtlas() {
    const { view, sort } = atlas;
    Object.assign(atlas, initialAtlas, { view, sort });
    atlasQuery.value = "";
    changeAtlasQuery("");
  }

  function jumpToSection(target) {
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function refreshRail() {
    railFrame = 0;
    if (!railButtons.length) return;
    let current = railButtons[0];
    let currentTop = -Infinity;
    for (const entry of railButtons) {
      const top = entry.target.getBoundingClientRect().top;
      if (top <= 156 && (top > currentTop + 1 || (Math.abs(top - currentTop) <= 1 && entry === selectedAnchor))) {
        current = entry;
        currentTop = top;
      }
    }
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = railButtons.at(-1);
    for (const entry of railButtons) {
      if (entry === current) entry.button.setAttribute("aria-current", "location");
      else entry.button.removeAttribute("aria-current");
    }
  }

  function buildRail() {
    railButtons = [];
    selectedAnchor = null;
    const rail = select("#" + page + " [data-library-rail]");
    if (!rail) return;
    const links = libraryAnchors[page].map(([id, label]) => {
      const target = document.getElementById(id);
      if (!target) return null;
      const button = Object.assign(document.createElement("button"), { type: "button", textContent: label });
      const entry = { target, button };
      button.addEventListener("click", () => {
        selectedAnchor = entry;
        jumpToSection(target);
        refreshRail();
      });
      return entry;
    }).filter(Boolean);
    railButtons = links;
    const title = Object.assign(document.createElement("p"), { textContent: "本页目录" });
    rail.replaceChildren(...(links.length ? [title, ...links.map(entry => entry.button)] : []));
    refreshRail();
  }

  function renderDetail() {
    const back = atlasSearchLink(atlas.query.trim());
    const record = land?.byCode.get(detailCode);
    const selected = record ? record.code + " " + record.name : "地类详情";
    const crumb = '<nav class="library-crumb" aria-label="当前位置"><a href="#library">资料库</a><span aria-hidden="true">›</span><a href="' +
      back + '">地类图鉴</a><span aria-hidden="true">›</span><span aria-current="page">' + escapeHtml(selected) + '</span></nav>';
    if (!record) {
      const error = land ? "未找到该地类" : (landError ? "地类数据读取失败" : "正在查找地类…");
      const retry = landError ? '<button type="button" class="library-button" data-land-retry>重试</button>' : "";
      const title = '<h1 id="land-detail-title">' + error + '</h1>';
      const message = land ? '<p>请核对代码，或返回图鉴使用名称查询。</p>' : "";
      detail.innerHTML = crumb + '<section class="library-panel library-empty" aria-labelledby="land-detail-title">' + title + message + retry +
        ' <a class="library-button" href="' + back + '">返回地类图鉴</a></section>';
      return;
    }

    const root = land.byCode.get(record.code.slice(0, 2));
    const related = land.related(record);
    const notes = [
      ["definition", "book", "定义概述", record.summary, "自编科普释义 · 待逐项校对"],
      ["usage", "layers", "用途", record.usage, "适用性应结合项目用途及审批条件核对"],
      ["identify", "target", "识别方法", record.identify, "结合现场、影像及调查规程判断"]
    ];
    const panels = notes.map(([id, name, title, text, note]) =>
      '<section class="library-panel land-note" id="land-' + id + '"><h2>' + icon(name) + title + '</h2><p>' +
      escapeHtml(text) + '</p><small>' + note + '</small></section>'
    ).join("");
    const comparisons = related.map(item => {
      const preview = '<div class="land-related__cover">' + sceneImage(item) + '</div>';
      return '<a href="' + landLink(item.code) + '">' + preview + '<div><h3>' + item.code + ' ' + escapeHtml(item.name) +
        '</h3><p>' + escapeHtml(item.summary) + '</p></div>' + icon("arrow") + '</a>';
    }).join("");
    const variants = symbolVariants.map(variant =>
      '<button type="button" data-land-variant="' + variant.id + '" aria-pressed="' + (variant.id === "color") + '">' +
      '<span>' + symbolSvg(record, variant.id) + '</span>' + variant.label + '</button>'
    ).join("");

    detail.innerHTML = crumb + '<header class="library-hero library-hero--detail" id="land-overview">' +
      sceneImage(record, { eager: true }) + '<div class="library-hero__heading"><span class="library-emblem">' + icon("layers") + '</span><div>' +
      '<h1 id="land-detail-title">' + escapeHtml(selected) + '</h1><div class="land-tags"><span class="library-tag">一级类 · ' +
      escapeHtml(root.name) + '</span><span class="library-tag">' + record.level + ' 级 · ' + escapeHtml(record.medium) +
      '</span><button type="button" class="library-button" data-land-copy>复制代码</button><button type="button" class="library-button" data-land-gallery>查看高清图</button>' +
      '<span class="library-note" role="status" id="land-copy-status"></span></div></div></div>' +
      '<span class="land-hero__photo-label">场景示意</span></header>' +
      '<div class="library-bar">' + renderTabs("land-atlas", back) + '</div>' +
      '<div class="land-note-grid">' + panels + '</div>' +
      '<section class="library-panel land-related" id="land-related"><h2>' + icon("scale") + '地类对照</h2>' +
      (related.length ? '<div class="land-related__grid">' + comparisons + '</div>' : '<p class="library-note">暂无已整理的对照地类。</p>') + '</section>' +
      '<div class="land-bottom"><section class="library-panel land-symbols" id="land-symbols"><h2>' + icon("layers") + '相关图式</h2>' +
      '<p class="library-note">本站自制教学示意 · 未核验 · 非正式标准图式</p><div class="land-symbols__preview" id="land-symbol-preview">' + symbolSvg(record, "color") +
      '</div><div class="land-variants" role="group" aria-label="图式变体">' + variants + '</div>' +
      '<button type="button" class="library-button" data-land-export>导出示意 SVG</button></section>' +
      '<section class="library-panel atlas-sources" id="land-sources"><h2>' + icon("book") + '标准依据</h2>' + renderSources() +
      '<p class="library-note">地类分类与权属、规划用途、永久基本农田及审批许可各有不同的核查依据。</p>' +
      '<a class="library-button" href="' + back + '">← 返回地类图鉴</a></section></div>';
    document.title = selected + "｜瑞雪的小栈";
  }

  function updateLandViews() {
    renderCategories();
    renderLanding();
    renderAtlas();
    if (page === "land-detail") {
      const headingFocused = document.activeElement?.id === "land-detail-title";
      renderDetail();
      if (headingFocused) focusDetailHeading();
    }
    buildRail();
  }

  function focusDetailHeading() {
    const heading = select("#land-detail-title");
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  function loadLand() {
    if (land || landLoad) return;
    landError = false;
    updateLandViews();
    landLoad = fetch(new URL("../library/landuse-data.json", import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(entries => {
        land = readLandData(entries);
        const category = select("#atlas-category");
        for (const record of land.roots) category.add(new Option(record.code + " " + record.name, record.code));
        select("#atlas-export").disabled = false;
        renderAtlasStats();
      })
      .catch(error => {
        landError = true;
        console.warn("Land atlas data unavailable", error);
      })
      .finally(() => {
        landLoad = null;
        updateLandViews();
      });
  }

  for (const node of document.querySelectorAll("[data-library-nav]")) node.innerHTML = renderTabs(node.dataset.libraryNav);
  for (const node of document.querySelectorAll("[data-library-icon]")) node.innerHTML = icon(node.dataset.libraryIcon);
  for (const section of sections.slice(1)) scopeSelect.add(new Option(section.title, section.id));
  select("[data-atlas-sources]").innerHTML = renderSources();
  landingQuery.addEventListener("input", renderLanding);
  scopeSelect.addEventListener("change", renderLanding);
  select("#library-search-form").addEventListener("submit", event => {
    event.preventDefault();
    renderLanding();
    jumpToSection(select("#library-highlights-title"));
  });
  select("#atlas-search-form").addEventListener("submit", event => {
    event.preventDefault();
    jumpToSection(select("#atlas-catalog-title"));
  });
  atlasQuery.addEventListener("input", () => changeAtlasQuery(atlasQuery.value));
  select("#atlas-category").addEventListener("change", event => {
    atlas.category = event.target.value;
    atlas.page = 1;
    renderAtlas();
  });
  select("#atlas-sort").addEventListener("change", event => {
    atlas.sort = event.target.value;
    atlas.page = 1;
    renderAtlas();
  });
  for (const property of ["medium", "level", "view"]) {
    for (const button of document.querySelectorAll("[data-atlas-" + property + "]")) {
      button.addEventListener("click", () => {
        atlas[property] = button.getAttribute("data-atlas-" + property);
        if (property !== "view") atlas.page = 1;
        renderAtlas();
      });
    }
  }
  for (const [id, step] of [["#atlas-prev", -1], ["#atlas-next", 1]]) {
    select(id).addEventListener("click", () => {
      atlas.page += step;
      renderAtlas();
      jumpToSection(select("#atlas-catalog-title"));
    });
  }
  select("#atlas-reset").addEventListener("click", resetAtlas);
  galleryButton.addEventListener("click", () => gallery.open(atlasResults, atlasResults[(atlas.page - 1) * atlasSize]?.code));
  select("#atlas-cards").addEventListener("click", event => {
    const photo = event.target.closest("[data-open-land-photo]");
    if (photo) gallery.open(atlasResults, photo.dataset.openLandPhoto);
    const card = event.target.closest("[data-land-code]");
    if (card) atlasReturnCode = card.dataset.landCode;
    if (event.target.closest("[data-atlas-clear]")) {
      resetAtlas();
      atlasQuery.focus({ preventScroll: true });
    }
    if (event.target.closest("[data-land-retry]")) loadLand();
  });
  select("#atlas-export").addEventListener("click", () => {
    if (land) download("国土空间地类图鉴_2023.csv", landCsv(land.records), "text/csv;charset=utf-8");
  });
  detail.addEventListener("click", async event => {
    if (event.target.closest("[data-land-retry]")) loadLand();
    const record = land?.byCode.get(detailCode);
    if (!record) return;
    if (event.target.closest("[data-land-gallery]")) gallery.open(land.records, record.code);
    const variant = event.target.closest("[data-land-variant]");
    if (variant) {
      select("#land-symbol-preview").innerHTML = symbolSvg(record, variant.dataset.landVariant);
      for (const button of detail.querySelectorAll("[data-land-variant]")) button.setAttribute("aria-pressed", String(button === variant));
    }
    if (event.target.closest("[data-land-copy]")) {
      const status = select("#land-copy-status");
      try {
        await copyText(record.code);
        status.textContent = "已复制";
      } catch {
        status.textContent = "请手动复制 " + record.code;
      }
    }
    if (event.target.closest("[data-land-export]")) {
      const active = select('[data-land-variant][aria-pressed="true"]').dataset.landVariant;
      download(record.code + "_" + record.name + "_教学示意.svg", symbolSvg(record, active, true), "image/svg+xml");
    }
  });
  const scheduleRail = () => {
    if (railButtons.length && !railFrame) railFrame = requestAnimationFrame(refreshRail);
  };
  window.addEventListener("scroll", scheduleRail, { passive: true });
  window.addEventListener("resize", scheduleRail);

  return {
    updatePolicy(items) {
      policyItems = items;
      renderCategories();
      renderLanding();
    },
    route(nextPage, previousPage, params, scrollY) {
      gallery.close();
      page = nextPage;
      if (previousPage === "land-atlas" && page !== "land-atlas") atlasPosition = scrollY;
      let restorePosition = 0;
      if (page === "land-atlas") {
        const query = params.get("q") || "";
        if (query !== atlas.query.trim()) {
          Object.assign(atlas, initialAtlas, { view: atlas.view, sort: atlas.sort, query });
          atlasQuery.value = query;
        } else if (previousPage === "land-detail") {
          restorePosition = atlasPosition;
        }
        renderAtlas();
        if (previousPage === "land-detail" && atlasReturnCode) {
          select('#atlas-cards [data-land-code="' + atlasReturnCode + '"]')?.focus({ preventScroll: true });
        }
      }
      if (page === "land-detail") {
        detailCode = params.get("code") || "";
        renderDetail();
        if (previousPage === page) focusDetailHeading();
      }
      if (page === "library") {
        renderCategories();
        renderLanding();
      }
      if (["library", "land-atlas", "land-detail"].includes(page) && !landError) loadLand();
      buildRail();
      return restorePosition;
    }
  };
}
