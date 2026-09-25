import {
  calendarMonth,
  canManageKnowledgeShares,
  explicitEventDate,
  groupReminders,
  partitionKnowledge
} from "./knowledge-model.js";

const KNOWLEDGE_API = "/api/knowledge";
const initialCalendarDate = new Date();
const knowledgeState = {
  authenticated: false,
  accessKind: null,
  items: [],
  categories: [],
  projects: [],
  tags: [],
  loaded: false,
  manifestUpdatedAt: "",
  searchIds: null,
  searchController: null,
  searchSequence: 0,
  activeItemId: "",
  calendarYear: initialCalendarDate.getFullYear(),
  calendarMonth: initialCalendarDate.getMonth() + 1,
  selectedDate: ""
};

const kb$ = (selector, scope = document) => scope.querySelector(selector);
const kbEscape = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));

function knowledgeMessage(message, error = false) {
  const status = kb$("#knowledge-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", error);
}

function showKnowledgeAuth() {
  const dialog = kb$("#knowledge-auth");
  if (!dialog?.open) dialog?.showModal();
  kb$("#knowledge-password")?.focus();
}

function updateKnowledgePresentation() {
  const mode = kb$("#knowledge-mode");
  const logout = kb$("#knowledge-logout");
  const authenticated = knowledgeState.authenticated;
  if (mode) {
    mode.textContent = authenticated ? "只读模式 · 已认证" : "私人内容 · 等待认证";
    mode.classList.toggle("is-private", authenticated);
  }
  if (logout) logout.hidden = !authenticated;
  updateKnowledgeShareModule();
}

function updateKnowledgeShareModule() {
  const button = kb$("#knowledge-open-token");
  if (!button) return;
  button.hidden = !canManageKnowledgeShares(knowledgeState.authenticated, knowledgeState.accessKind);
}

function closeKnowledgeTokenDialog() {
  const dialog = kb$("#knowledge-token-dialog");
  if (dialog?.open) dialog.close();
}

async function knowledgeSession() {
  const response = await fetch(`${KNOWLEDGE_API}/session`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return { authenticated: false };
  return response.json();
}

function knowledgeTokenTtl() {
  return Number(kb$("#knowledge-token-ttl")?.value || 604800);
}

function showKnowledgeTokenResult(result) {
  const panel = kb$("#knowledge-token-result");
  const value = kb$("#knowledge-token-value");
  const linkRow = kb$("#knowledge-share-link-row");
  const link = kb$("#knowledge-share-link");
  const copyShare = kb$("#knowledge-copy-share");
  if (!panel || !value) return;
  value.value = result.token || "";
  if (linkRow) linkRow.hidden = false;
  if (copyShare) copyShare.hidden = false;
  if (link) link.value = `${location.origin}${location.pathname}?share=${encodeURIComponent(result.token)}`;
  panel.hidden = false;
  kb$("#knowledge-token-result-status").textContent = `分享令牌有效至 ${new Date(result.expiresAt * 1000).toLocaleString("zh-CN")}。令牌只显示这一次，请立即复制。`;
}

async function createKnowledgeToken() {
  const button = kb$("#knowledge-create-share");
  if (button) button.disabled = true;
  try {
    const body = { ttl: knowledgeTokenTtl(), ids: knowledgeState.items.map(item => item.id).filter(Boolean) };
    const response = await fetch(`${KNOWLEDGE_API}/tokens`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    showKnowledgeTokenResult(result);
  } catch (error) {
    knowledgeMessage("令牌生成失败，请重新登录后重试。", true);
    console.error("Knowledge token issue failed", error);
  } finally {
    if (button) button.disabled = false;
  }
}

async function copyKnowledgeValue(selector, statusMessage) {
  const input = kb$(selector);
  if (!input?.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand("copy");
  }
  kb$("#knowledge-token-result-status").textContent = statusMessage;
}

async function consumeKnowledgeShareToken() {
  const token = new URLSearchParams(location.search).get("share");
  if (!token) return false;
  history.replaceState(null, "", location.pathname);
  const response = await fetch(`${KNOWLEDGE_API}/token/exchange`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  if (!response.ok) {
    knowledgeMessage("分享令牌无效或已过期。", true);
    return false;
  }
  return true;
}

function itemProject(item) {
  return String(item.project || item.project_name || "").trim();
}

function itemDateValue(item) {
  return item.updated_at || item.created_at || "";
}

function formatKnowledgeDate(value, includeTime = false) {
  if (!value) return "时间未标注";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || "时间未标注";
  return new Intl.DateTimeFormat("zh-CN", includeTime
    ? { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function replaceSelectOptions(selector, label, values) {
  const select = kb$(selector);
  if (!select) return;
  const previous = select.value;
  select.replaceChildren(new Option(label, ""), ...values.map(value => new Option(value, value)));
  select.value = values.includes(previous) ? previous : "";
}

function currentKnowledgeFilters() {
  return {
    query: (kb$("#knowledge-search")?.value || "").trim().toLowerCase(),
    category: kb$("#knowledge-category")?.value || "",
    tag: kb$("#knowledge-tag")?.value || ""
  };
}

function matchesKnowledgeSearch(item) {
  const filters = currentKnowledgeFilters();
  if (!filters.query) return true;
  if (knowledgeState.searchIds) return knowledgeState.searchIds.has(item.id);
  const metadata = [item.title, item.summary, item.category, itemProject(item), ...(item.tags || [])].join(" ").toLowerCase();
  return metadata.includes(filters.query);
}

function filteredMemoItems() {
  const filters = currentKnowledgeFilters();
  return partitionKnowledge(knowledgeState.items).memos.filter(item => matchesKnowledgeSearch(item)
    && (!filters.category || item.category === filters.category)
    && (!filters.tag || (item.tags || []).includes(filters.tag)));
}

function visibleReminderItems() {
  return partitionKnowledge(knowledgeState.items).reminders.filter(matchesKnowledgeSearch);
}

function knowledgeTagHtml(tags = [], limit = 4) {
  return tags.slice(0, limit).map(tag => `<span>${kbEscape(tag)}</span>`).join("");
}

function makeKnowledgeItemButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "knowledge-card";
  button.dataset.knowledgeId = item.id;
  const project = itemProject(item);
  button.innerHTML = `<span class="knowledge-card__meta"><span>${kbEscape(item.category || "未分类")}</span><time datetime="${kbEscape(itemDateValue(item))}">更新于 ${kbEscape(formatKnowledgeDate(itemDateValue(item)))}</time></span><span class="knowledge-card__title">${kbEscape(item.title || "未命名条目")}</span><p>${kbEscape(item.summary || "暂无摘要")}</p>${project ? `<span class="knowledge-card__project">项目 · ${kbEscape(project)}</span>` : ""}<span class="knowledge-card__tags">${knowledgeTagHtml(item.tags)}</span><span class="knowledge-card__action">阅读全文 <b aria-hidden="true">→</b></span>`;
  button.addEventListener("click", () => openKnowledgeItem(item.id));
  return button;
}

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeReminderButton(item) {
  const button = document.createElement("button");
  const date = explicitEventDate(item);
  button.type = "button";
  button.className = "knowledge-reminder";
  button.classList.toggle("is-past", Boolean(date && date < todayIso()));
  button.dataset.knowledgeId = item.id;
  const dateLabel = date ? `${date < todayIso() ? "已过日期 · " : ""}${formatKnowledgeDate(date)}` : "未标注日程日期";
  button.innerHTML = `<span><strong>${kbEscape(item.title || "未命名日程")}</strong><small>${kbEscape(dateLabel)}${item.summary ? ` · ${kbEscape(item.summary)}` : ""}</small></span>`;
  button.addEventListener("click", () => openKnowledgeItem(item.id));
  return button;
}

function reminderGroup(title, items) {
  const section = document.createElement("section");
  section.className = "knowledge-reminder-group";
  section.innerHTML = `<div class="knowledge-reminder-group__title"><span>${kbEscape(title)}</span><span>${items.length}</span></div>`;
  section.append(...items.map(makeReminderButton));
  return section;
}

function renderKnowledgeReminders() {
  const root = kb$("#knowledge-reminders");
  if (!root) return;
  const reminders = visibleReminderItems();
  const groups = groupReminders(reminders, todayIso());
  kb$("#knowledge-reminder-filter-count").textContent = `${reminders.length} 条`;
  if (!reminders.length) {
    root.innerHTML = `<p class="knowledge-empty">${knowledgeState.items.length ? "没有匹配当前搜索的日程记录。" : "当前知识库暂无日程记录。"}</p>`;
    return;
  }
  const sections = [
    groups.upcoming.length ? reminderGroup("近期与已过日期", groups.upcoming) : null,
    groups.later.length ? reminderGroup("以后", groups.later) : null,
    groups.unscheduled.length ? reminderGroup("未安排", groups.unscheduled) : null
  ].filter(Boolean);
  root.replaceChildren(...sections);
}

function renderCalendarSelection(cells) {
  const root = kb$("#knowledge-calendar-selection");
  if (!root) return;
  const selected = cells.find(cell => cell.date === knowledgeState.selectedDate);
  if (!selected) {
    root.innerHTML = '<p class="knowledge-empty">选择日期查看已有日程。</p>';
    return;
  }
  const items = selected.itemIds.map(id => knowledgeState.items.find(item => item.id === id)).filter(Boolean);
  if (!items.length) {
    root.innerHTML = `<p class="knowledge-empty">${kbEscape(formatKnowledgeDate(selected.date))}没有明确标注日期的日程。</p>`;
    return;
  }
  root.replaceChildren(...items.map(makeReminderButton));
}

function renderKnowledgeCalendar() {
  const root = kb$("#knowledge-calendar-grid");
  if (!root) return;
  const reminders = visibleReminderItems();
  const cells = calendarMonth(knowledgeState.calendarYear, knowledgeState.calendarMonth, reminders);
  kb$("#knowledge-calendar-title").textContent = `${knowledgeState.calendarYear} 年 ${knowledgeState.calendarMonth} 月`;
  root.replaceChildren(...cells.map(cell => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "knowledge-calendar__day";
    button.classList.toggle("is-month", cell.inMonth);
    button.classList.toggle("is-today", cell.date === todayIso());
    button.classList.toggle("is-selected", cell.date === knowledgeState.selectedDate);
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", `${formatKnowledgeDate(cell.date)}${cell.count ? `，${cell.count} 条日程` : "，无日程"}`);
    button.innerHTML = `<span>${cell.day}</span>${cell.count ? '<i class="knowledge-calendar__dot" aria-hidden="true"></i>' : ""}`;
    button.addEventListener("click", () => {
      knowledgeState.selectedDate = cell.date;
      if (!cell.inMonth) {
        const [year, month] = cell.date.split("-").map(Number);
        knowledgeState.calendarYear = year;
        knowledgeState.calendarMonth = month;
      }
      renderKnowledgeCalendar();
    });
    return button;
  }));
  renderCalendarSelection(cells);
}

function renderKnowledgeMemos() {
  const list = kb$("#knowledge-memos");
  if (!list) return;
  const items = filteredMemoItems();
  const count = kb$("#knowledge-result-count");
  const total = partitionKnowledge(knowledgeState.items).memos.length;
  if (count) count.textContent = `显示 ${items.length} / ${total} 条`;
  if (!items.length) {
    list.innerHTML = `<p class="knowledge-empty">${total ? "没有匹配当前条件的备忘录。" : "当前知识库暂无备忘录。"}</p>`;
    return;
  }
  list.replaceChildren(...items.map(item => makeKnowledgeItemButton(item)));
}

function renderKnowledgeHome() {
  renderKnowledgeReminders();
  renderKnowledgeCalendar();
  renderKnowledgeMemos();
  const clear = kb$("#knowledge-search-clear");
  if (clear) clear.hidden = !(kb$("#knowledge-search")?.value || "");
}

function safeMarkdownHref(value) {
  const href = String(value || "").trim();
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(href)) return kbEscape(href);
  return "";
}

function renderInlineMarkdown(value = "") {
  const code = [];
  let html = kbEscape(value).replace(/`([^`]+)`/g, (_, text) => {
    const index = code.push(`<code>${text}</code>`) - 1;
    return `\u0000CODE${index}\u0000`;
  });
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, href) => {
    const safe = safeMarkdownHref(href);
    return safe ? `<a href="${safe}" target="_blank" rel="noopener">图片：${alt || "外部资源"}</a>` : alt;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, href) => {
    const safe = safeMarkdownHref(href);
    return safe ? `<a href="${safe}"${/^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>` : label;
  });
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return html.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)] || "");
}

function markdownHeadingId(text, used) {
  const base = String(text).replace(/[`*_~\[\]()]/g, "").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
  const count = used.get(base) || 0;
  used.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function markdownTableCells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
}

function renderMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  const toc = [];
  const usedIds = new Map();
  const isFence = line => /^\s*```/.test(line);
  const isHeading = line => /^(#{1,6})\s+/.test(line);
  const isList = line => /^\s*(?:[-+*]|\d+\.)\s+/.test(line);
  const isQuote = line => /^\s*>\s?/.test(line);
  const isRule = line => /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  const isTableDivider = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (isFence(line)) {
      const language = line.trim().slice(3).trim().toLowerCase();
      const body = [];
      index += 1;
      while (index < lines.length && !isFence(lines[index])) body.push(lines[index++]);
      if (index < lines.length) index += 1;
      const code = kbEscape(body.join("\n"));
      html.push(language === "mermaid"
        ? `<details class="knowledge-diagram"><summary>查看 Mermaid 图表源码</summary><pre><code class="language-mermaid">${code}</code></pre></details>`
        : `<pre><code${language ? ` class="language-${kbEscape(language)}"` : ""}>${code}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(6, Math.max(2, heading[1].length + 1));
      const text = heading[2].trim();
      const id = markdownHeadingId(text, usedIds);
      toc.push({ level, text: text.replace(/[*_`~]/g, ""), id });
      html.push(`<h${level} id="${id}">${renderInlineMarkdown(text)}<a class="knowledge-heading-anchor" href="#${id}" aria-label="链接到本节">#</a></h${level}>`);
      index += 1;
      continue;
    }
    if (isRule(line)) { html.push("<hr>"); index += 1; continue; }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = markdownTableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(markdownTableCells(lines[index++]));
      html.push(`<div class="knowledge-table-wrap"><table><thead><tr>${headers.map(cell => `<th scope="col">${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (isQuote(line)) {
      const quote = [];
      while (index < lines.length && isQuote(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""));
      html.push(`<blockquote>${quote.map(renderInlineMarkdown).join("<br>")}</blockquote>`);
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (index < lines.length && isList(lines[index]) && /^\s*\d+\./.test(lines[index]) === ordered) {
        let value = lines[index++].replace(/^\s*(?:[-+*]|\d+\.)\s+/, "");
        const task = value.match(/^\[([ xX])\]\s+(.*)$/);
        value = task ? `<input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""}> ${renderInlineMarkdown(task[2])}` : renderInlineMarkdown(value);
        items.push(`<li>${value}</li>`);
      }
      html.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !isFence(lines[index]) && !isHeading(lines[index]) && !isList(lines[index]) && !isQuote(lines[index]) && !isRule(lines[index]) && !(lines[index].includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1]))) {
      paragraph.push(lines[index++].trim());
    }
    html.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
  }
  return { html: html.join(""), toc };
}

function renderKnowledgeToc(items) {
  const toc = kb$("#knowledge-toc");
  if (!toc) return;
  if (!items.length) {
    toc.hidden = true;
    toc.replaceChildren();
    return;
  }
  toc.hidden = false;
  toc.innerHTML = `<p>本文目录</p><nav>${items.map(item => `<a href="#${kbEscape(item.id)}" class="level-${item.level}">${kbEscape(item.text)}</a>`).join("")}</nav>`;
  toc.querySelectorAll("a").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    target?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }));
}

async function openKnowledgeItem(id) {
  const detail = kb$("#knowledge-detail");
  const home = kb$("#knowledge-home");
  if (!detail || !home) return;
  knowledgeState.activeItemId = id;
  home.hidden = true;
  detail.hidden = false;
  kb$("#knowledge-detail-title").textContent = "正在读取条目…";
  kb$("#knowledge-detail-summary").textContent = "";
  kb$("#knowledge-detail-meta").replaceChildren();
  kb$("#knowledge-markdown").innerHTML = "<p>正在读取正文…</p>";
  kb$("#knowledge-toc").hidden = true;
  detail.scrollIntoView({ behavior: "auto", block: "start" });
  try {
    const response = await fetch(`${KNOWLEDGE_API}/item?id=${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) { showKnowledgeAuth(); return; }
    if (!response.ok) throw new Error(`Knowledge item HTTP ${response.status}`);
    const item = await response.json();
    const rendered = renderMarkdown(item.content || "");
    kb$("#knowledge-detail-category").textContent = item.category || "未分类";
    kb$("#knowledge-detail-title").textContent = item.title || "未命名条目";
    kb$("#knowledge-detail-summary").textContent = item.summary || "";
    const metadata = [
      `<span>更新于 <time datetime="${kbEscape(itemDateValue(item))}">${kbEscape(formatKnowledgeDate(itemDateValue(item), true))}</time></span>`,
      itemProject(item) ? `<span>项目 · ${kbEscape(itemProject(item))}</span>` : "",
      ...(item.tags || []).map(tag => `<span class="knowledge-detail__tag">#${kbEscape(tag)}</span>`)
    ].filter(Boolean);
    kb$("#knowledge-detail-meta").innerHTML = metadata.join("");
    kb$("#knowledge-markdown").innerHTML = rendered.html || "<p>正文为空。</p>";
    renderKnowledgeToc(rendered.toc);
    kb$("#knowledge-detail-title").setAttribute("tabindex", "-1");
    kb$("#knowledge-detail-title").focus({ preventScroll: true });
  } catch (error) {
    kb$("#knowledge-detail-title").textContent = "条目读取失败";
    kb$("#knowledge-markdown").innerHTML = "<p>当前条目暂时无法读取，请返回总览后重试。</p>";
    console.error("Knowledge item load failed", error);
  }
}

function closeKnowledgeItem() {
  knowledgeState.activeItemId = "";
  kb$("#knowledge-detail").hidden = true;
  kb$("#knowledge-home").hidden = false;
  kb$("#knowledge-title")?.setAttribute("tabindex", "-1");
  kb$("#knowledge-title")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function searchKnowledgeContent(query) {
  knowledgeState.searchController?.abort();
  const normalized = query.trim();
  if (normalized.length < 2) {
    knowledgeState.searchIds = null;
    renderKnowledgeHome();
    knowledgeMessage(normalized ? "输入至少 2 个字符可继续检索正文；当前已匹配索引字段。" : `已读取 ${knowledgeState.items.length} 条知识记录。`);
    return;
  }
  const sequence = ++knowledgeState.searchSequence;
  const controller = new AbortController();
  knowledgeState.searchController = controller;
  knowledgeMessage("正在检索索引与正文内容…");
  try {
    const response = await fetch(`${KNOWLEDGE_API}/search?q=${encodeURIComponent(normalized)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
    if (response.status === 401) { showKnowledgeAuth(); return; }
    if (!response.ok) throw new Error(`Knowledge search HTTP ${response.status}`);
    const data = await response.json();
    if (sequence !== knowledgeState.searchSequence) return;
    knowledgeState.searchIds = new Set((data.items || []).map(item => item.id));
    renderKnowledgeHome();
    const suffix = data.content_truncated ? "；正文检索范围已按服务上限截取" : "";
    knowledgeMessage(`找到 ${knowledgeState.searchIds.size} 条相关记录${suffix}。`);
  } catch (error) {
    if (error.name === "AbortError") return;
    knowledgeState.searchIds = null;
    renderKnowledgeHome();
    knowledgeMessage("正文检索暂时不可用，已保留标题、摘要、分类与标签匹配结果。", true);
    console.error("Knowledge full-text search failed", error);
  }
}

let knowledgeSearchTimer;
function scheduleKnowledgeSearch() {
  const query = kb$("#knowledge-search")?.value || "";
  knowledgeState.searchController?.abort();
  knowledgeState.searchSequence += 1;
  knowledgeState.searchIds = null;
  renderKnowledgeHome();
  clearTimeout(knowledgeSearchTimer);
  knowledgeSearchTimer = window.setTimeout(() => searchKnowledgeContent(query), 360);
}

async function loadKnowledgeIndex() {
  knowledgeMessage("正在读取知识库索引…");
  const response = await fetch(`${KNOWLEDGE_API}/index`, { credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) {
    knowledgeState.authenticated = false;
    knowledgeState.accessKind = null;
    updateKnowledgePresentation();
    knowledgeMessage("需要认证后才能读取知识库。", true);
    showKnowledgeAuth();
    return;
  }
  if (!response.ok) throw new Error(`Knowledge HTTP ${response.status}`);
  const data = await response.json();
  knowledgeState.items = Array.isArray(data.items) ? data.items : [];
  const partitioned = partitionKnowledge(knowledgeState.items);
  knowledgeState.categories = [...new Set(partitioned.memos.map(item => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  knowledgeState.projects = [...new Set(partitioned.memos.map(itemProject).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  knowledgeState.tags = [...new Set(partitioned.memos.flatMap(item => Array.isArray(item.tags) ? item.tags : []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  knowledgeState.manifestUpdatedAt = data.updated_at || "";
  knowledgeState.searchIds = null;
  replaceSelectOptions("#knowledge-category", "全部分类", knowledgeState.categories);
  replaceSelectOptions("#knowledge-tag", "全部标签", knowledgeState.tags);
  const updated = kb$("#knowledge-updated-at");
  if (updated) updated.textContent = knowledgeState.manifestUpdatedAt ? `索引更新于 ${formatKnowledgeDate(knowledgeState.manifestUpdatedAt)}` : "按更新时间排列";
  const latestItemDate = knowledgeState.items.map(itemDateValue).find(Boolean) || knowledgeState.manifestUpdatedAt;
  const dashboardValues = {
    "#knowledge-reminder-count": String(partitioned.reminders.length),
    "#knowledge-memo-count": String(partitioned.memos.length),
    "#knowledge-latest-date": latestItemDate ? formatKnowledgeDate(latestItemDate).replace(/\//g, ".") : "暂无"
  };
  Object.entries(dashboardValues).forEach(([selector, value]) => {
    const element = kb$(selector);
    if (element) element.textContent = value;
  });
  knowledgeState.loaded = true;
  updateKnowledgePresentation();
  renderKnowledgeHome();
  knowledgeMessage(`已读取 ${knowledgeState.items.length} 条知识记录 · 只读索引`);
}

async function ensureKnowledgeAccess({ prompt = true } = {}) {
  try {
    const session = await knowledgeSession();
    knowledgeState.authenticated = Boolean(session.authenticated);
    knowledgeState.accessKind = session.kind || null;
    if (!knowledgeState.authenticated) {
      knowledgeState.accessKind = null;
      updateKnowledgePresentation();
      if (prompt) showKnowledgeAuth();
      return false;
    }
    updateKnowledgePresentation();
    if (!knowledgeState.loaded) await loadKnowledgeIndex();
    return true;
  } catch (error) {
    knowledgeMessage("知识库服务暂时不可用，请稍后重试。", true);
    console.error("Knowledge access failed", error);
    return false;
  }
}

kb$("#knowledge-auth-form")?.addEventListener("submit", async event => {
  event.preventDefault();
  const status = kb$("#knowledge-auth-status");
  const password = kb$("#knowledge-password")?.value || "";
  if (!password) return;
  status.textContent = "正在认证…";
  const response = await fetch(`${KNOWLEDGE_API}/login`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    status.textContent = response.status === 429 ? "尝试次数过多，请稍后再试。" : "认证失败，请检查密码。";
    return;
  }
  kb$("#knowledge-auth").close();
  kb$("#knowledge-password").value = "";
  await ensureKnowledgeAccess({ prompt: false });
});

kb$("[data-close-knowledge-auth]")?.addEventListener("click", () => kb$("#knowledge-auth")?.close());
kb$("#knowledge-search")?.addEventListener("input", scheduleKnowledgeSearch);
kb$("#knowledge-search-clear")?.addEventListener("click", () => {
  kb$("#knowledge-search").value = "";
  scheduleKnowledgeSearch();
  kb$("#knowledge-search").focus();
});
["#knowledge-category", "#knowledge-tag"].forEach(selector => kb$(selector)?.addEventListener("change", renderKnowledgeHome));
kb$("#knowledge-filter-clear")?.addEventListener("click", () => {
  ["#knowledge-category", "#knowledge-tag"].forEach(selector => { if (kb$(selector)) kb$(selector).value = ""; });
  renderKnowledgeHome();
});
kb$("#knowledge-refresh")?.addEventListener("click", () => knowledgeState.authenticated && loadKnowledgeIndex());
kb$("#knowledge-calendar-prev")?.addEventListener("click", () => {
  knowledgeState.calendarMonth -= 1;
  if (knowledgeState.calendarMonth === 0) { knowledgeState.calendarMonth = 12; knowledgeState.calendarYear -= 1; }
  knowledgeState.selectedDate = "";
  renderKnowledgeCalendar();
});
kb$("#knowledge-calendar-next")?.addEventListener("click", () => {
  knowledgeState.calendarMonth += 1;
  if (knowledgeState.calendarMonth === 13) { knowledgeState.calendarMonth = 1; knowledgeState.calendarYear += 1; }
  knowledgeState.selectedDate = "";
  renderKnowledgeCalendar();
});
kb$("#knowledge-calendar-today")?.addEventListener("click", () => {
  const now = new Date();
  knowledgeState.calendarYear = now.getFullYear();
  knowledgeState.calendarMonth = now.getMonth() + 1;
  knowledgeState.selectedDate = todayIso();
  renderKnowledgeCalendar();
});
kb$("#knowledge-detail-back")?.addEventListener("click", closeKnowledgeItem);
kb$("#knowledge-create-master")?.addEventListener("click", () => createKnowledgeToken("master"));
kb$("#knowledge-create-share")?.addEventListener("click", createKnowledgeToken);
kb$("#knowledge-open-token")?.addEventListener("click", () => {
  if (knowledgeState.authenticated && knowledgeState.accessKind === "session") kb$("#knowledge-token-dialog")?.showModal();
});
kb$("#knowledge-token-dialog")?.addEventListener("click", event => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-knowledge-token]")) closeKnowledgeTokenDialog();
});
kb$("#knowledge-copy-token")?.addEventListener("click", () => copyKnowledgeValue("#knowledge-token-value", "令牌已复制。"));
kb$("#knowledge-copy-share")?.addEventListener("click", () => copyKnowledgeValue("#knowledge-share-link", "分享链接已复制。"));
kb$("#knowledge-revoke-token")?.addEventListener("click", async () => {
  const token = kb$("#knowledge-token-value")?.value || "";
  if (!token) return;
  await fetch(`${KNOWLEDGE_API}/tokens/revoke`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
  kb$("#knowledge-token-result").hidden = true;
  knowledgeMessage("令牌已撤销。");
});
kb$("#knowledge-logout")?.addEventListener("click", async () => {
  await fetch(`${KNOWLEDGE_API}/logout`, { method: "POST", credentials: "same-origin" });
  closeKnowledgeTokenDialog();
  knowledgeState.authenticated = false;
  knowledgeState.accessKind = null;
  knowledgeState.loaded = false;
  knowledgeState.items = [];
  closeKnowledgeItem();
  updateKnowledgePresentation();
  renderKnowledgeHome();
  showKnowledgeAuth();
});

consumeKnowledgeShareToken()
  .then(consumed => ensureKnowledgeAccess({ prompt: !consumed }))
  .catch(error => { console.error("Knowledge share token exchange failed", error); updateKnowledgePresentation(); });
