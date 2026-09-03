const endpoints = {
  index: "/data/policy/index.json",
  snapshot: "/data/policy/snapshot.json",
  document: "/data/policy/document",
  localBase: "/data/policy/"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

async function fetchJson(url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Response is not JSON");
  return response.json();
}

async function firstAvailable(candidates, validate) {
  let lastError;
  for (const url of candidates) {
    try {
      const value = await fetchJson(url);
      if (validate && !validate(value)) throw new Error("Unexpected policy data");
      return value;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Policy data unavailable");
}

async function loadPolicy(id) {
  const local = ["127.0.0.1", "localhost"].includes(location.hostname);
  const index = await firstAvailable(local ? [endpoints.snapshot, endpoints.index] : [endpoints.index, endpoints.snapshot], value => value.items?.length);
  const item = index.items.find(candidate => candidate.id === id);
  if (!item) throw new Error("资料索引中没有这份文件");
  const localRecord = `${endpoints.localBase}${String(item.record_path).replace(/^data\//, "")}`;
  const workerRecord = `${endpoints.document}?path=${encodeURIComponent(item.record_path)}`;
  const record = await firstAvailable(local ? [localRecord, workerRecord] : [workerRecord, localRecord], value => value.id === id && value.guide?.chapters?.length);
  return { item, record };
}

function analysisRow(label, value) {
  if (!value) return "";
  return `<div class="guide-analysis"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function entryCard(entry) {
  return `<article class="guide-entry" id="${escapeHtml(entry.id)}"><header class="guide-entry__head"><span class="guide-entry__number">${escapeHtml(entry.no || "要点")}</span><h3>${escapeHtml(entry.title)}</h3></header><div class="guide-entry__body">${entry.source_text ? `<div class="guide-source-text">${escapeHtml(entry.source_text)}</div>` : ""}<dl>${analysisRow("是什么", entry.what)}${analysisRow("怎么理解", entry.meaning)}${analysisRow("为什么重要", entry.why)}${analysisRow("核验依据", entry.basis)}${analysisRow("工作应用", entry.application)}</dl>${entry.takeaway ? `<p class="guide-takeaway"><b>核心要点</b>${escapeHtml(entry.takeaway)}</p>` : ""}</div></article>`;
}

function chapterBlock(chapter) {
  const entries = chapter.entries || [];
  return `<section class="guide-chapter" id="${escapeHtml(chapter.id)}"><header class="guide-chapter__head"><h2>${escapeHtml(chapter.title)}</h2><p>${escapeHtml(chapter.summary || "")}</p></header><nav class="guide-entry-index" aria-label="${escapeHtml(chapter.title)}条目">${entries.map(entry => `<a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.no || entry.title)}</a>`).join("")}</nav><div class="guide-entry-list">${entries.map(entryCard).join("")}</div></section>`;
}

function renderPolicy(record) {
  const guide = record.guide;
  if (!guide?.chapters?.length) throw new Error("这份文件尚未生成解读内容");
  const entryCount = guide.chapters.reduce((sum, chapter) => sum + (chapter.entries?.length || 0), 0);
  document.title = `${guide.title}｜瑞雪的小栈`;
  document.querySelector("#policy-detail-link").href = `./index.html#policy/${encodeURIComponent(record.id)}`;
  document.querySelector("#guide-app").innerHTML = `
    <header class="guide-hero">
      <div class="guide-hero__meta"><span>${escapeHtml(record.policy_type)}</span><span>${escapeHtml(record.document_no || "文号未标注")}</span><span>${escapeHtml((record.regions || []).join("、"))}</span></div>
      <h1><small>文件解读报告</small>${escapeHtml(guide.title)}</h1>
      <p class="guide-hero__subtitle">${escapeHtml(guide.subtitle || record.title)}</p>
      <p class="guide-hero__intro">${escapeHtml(guide.intro || record.summary)}</p>
      <div class="guide-hero__facts"><div><b>${guide.chapters.length}</b><span>讲解章节</span></div><div><b>${entryCount}</b><span>讲解条目</span></div><div><b>${escapeHtml(record.verified_at || "未标注")}</b><span>资料核验日期</span></div></div>
    </header>
    <div class="guide-shell">
      <aside class="guide-toc"><h2>内容目录</h2><nav>${guide.chapters.map(chapter => `<a href="#${escapeHtml(chapter.id)}">${escapeHtml(chapter.title)}</a>`).join("")}<a href="#required-companions">还需配套核对</a></nav><p class="guide-source-note">${escapeHtml(guide.source_note || "解读依据公开文件文本整理。")}</p></aside>
      <div class="guide-main">
        ${guide.chapters.map(chapterBlock).join("")}
        <section class="guide-companions" id="required-companions"><h2>实际落地，还需配套核对</h2><p>国家或省级文件提供框架，具体项目通常还要叠加下列属地标准、管理办法和项目文件。</p><ol>${(guide.required_companions || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol><div class="guide-actions"><a href="${escapeHtml(record.source_url)}" target="_blank" rel="noopener">打开官方原文 ↗</a><a href="./index.html#policy/${encodeURIComponent(record.id)}">查看内容要点</a><a href="./index.html#policy">返回资料库</a></div><p class="guide-disclaimer">本页用于培训、信息检索和资料链梳理，不替代法律意见、行政确认、评估报告或项目专项审查。请以发文机关最新公开文本及项目所在地现行规定为准。</p></section>
      </div>
    </div>`;
}

function renderError(error) {
  document.querySelector("#guide-app").innerHTML = `<section class="guide-error"><h1>解读页暂时无法读取</h1><p>${escapeHtml(error.message || "资料源不可用，请稍后重试。")}</p><a href="./index.html#policy">返回资料库</a></section>`;
}

async function init() {
  const id = new URLSearchParams(location.search).get("id");
  try {
    if (!id) throw new Error("链接中缺少文件 ID");
    const { record } = await loadPolicy(id);
    renderPolicy(record);
  } catch (error) {
    console.error("Failed to load policy guide", error);
    renderError(error);
  } finally {
    document.querySelector("#guide-loading").hidden = true;
    document.querySelector("#guide-app").hidden = false;
  }
}

init();
