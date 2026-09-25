# 独立知识工作台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将知识库从信息中心内嵌路由拆成经隐藏二级页进入的独立只读工作台，并提供提醒事项、日历和备忘录视图。

**Architecture:** 信息中心只保留隐藏入口与普通页面跳转；`knowledge.html`、`knowledge.css` 和 `knowledge.js` 构成独立页面。可测试的日期与视图映射放入无 DOM 依赖的 `knowledge-model.js`，现有 Cloudflare Worker 知识接口保持只读并由独立页复用。

**Tech Stack:** 静态 HTML/CSS、原生 JavaScript、Node.js 20 内置测试运行器、Cloudflare Workers/Wrangler、Playwright CLI。

**Spec:** `docs/superpowers/specs/2026-09-25-standalone-knowledge-workbench-design.md`

## Global Constraints

- 首页、主导航和页脚不得出现公开知识库入口。
- 唯一站内入口为“头像隐藏手势 -> 演示与分享二级页 -> 知识库”。
- 页面和 Worker 保持只读，不新增 GitHub 写入、事项完成或编辑能力。
- 日程日期只读取显式 `event_at`、`start_at` 或 `due_at`；不得用创建/更新时间或自然语言猜测。
- 继续使用现有认证、正文检索、访问令牌、限流和私有缓存边界。
- 桌面与 390 x 844 手机端无横向溢出，交互目标不小于 44 x 44 像素并有可访问名称。
- 保留现有动态分享目录、TraceRail 和 Worker 知识接口改动，不覆盖未提交工作。

---

### Task 1: 可测试的知识视图模型

**Files:**
- Create: `knowledge-model.js`
- Create: `tests/knowledge-model.test.mjs`
- Modify: `package.json`
- Modify: `scripts/build.mjs`

**Interfaces:**
- Consumes: 知识索引条目 `{ id, category, event_at?, start_at?, due_at?, created_at?, updated_at? }`。
- Produces: `KnowledgeModel.explicitEventDate(item) -> string | ""`、`partitionKnowledge(items, today) -> { reminders, memos }`、`groupReminders(items, today) -> { upcoming, later, unscheduled }`、`calendarMonth(year, month, items) -> CalendarCell[]`。

- [ ] **Step 1: 写日期来源失败测试**

```js
test("explicitEventDate ignores created and updated timestamps", () => {
  assert.equal(explicitEventDate({ category: "日程", created_at: "2026-09-25T09:00:00+08:00" }), "");
  assert.equal(explicitEventDate({ due_at: "2026-09-28T14:00:00+08:00" }), "2026-09-28");
});
```

- [ ] **Step 2: 运行测试并确认因模块不存在而失败**

Run: `node --test tests/knowledge-model.test.mjs`
Expected: FAIL，错误指向 `knowledge-model.js` 不存在或缺少导出。

- [ ] **Step 3: 实现最小日期解析和条目分区**

```js
export function explicitEventDate(item = {}) {
  const value = item.event_at || item.start_at || item.due_at || "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
  return match ? match[1] : "";
}
```

`knowledge-model.js` 使用 ES module 导出；浏览器端 `knowledge.js` 与 Node 测试均直接导入同一组函数。

- [ ] **Step 4: 增加并验证提醒分组和月历边界测试**

覆盖：日程/备忘录分离、未来 7 天为近期、以后日期、无日期日程、周一开头的 6 x 7 月历、同日多条数量。预期值全部使用手工列出的日期与数量。

- [ ] **Step 5: 运行模型测试至全部通过**

Run: `npm test`
Expected: PASS，零失败。

### Task 2: 独立知识工作台页面

**Files:**
- Create: `knowledge.html`
- Create: `knowledge.css`
- Modify: `knowledge.js`
- Test: `tests/knowledge-model.test.mjs`

**Interfaces:**
- Consumes: `window.KnowledgeModel` 和现有 `/api/knowledge/*` JSON 接口。
- Produces: 独立认证页、提醒事项列表、月历、备忘录筛选、Markdown 正文阅读和只读令牌管理。

- [ ] **Step 1: 写展示选择失败测试**

```js
test("partitionKnowledge exposes schedules only as reminders", () => {
  const result = partitionKnowledge([
    { id: "a", category: "日程" },
    { id: "b", category: "工作经验" }
  ], "2026-09-25");
  assert.deepEqual(result.reminders.map(item => item.id), ["a"]);
  assert.deepEqual(result.memos.map(item => item.id), ["b"]);
});
```

- [ ] **Step 2: 运行测试并确认新行为失败**

Run: `node --test tests/knowledge-model.test.mjs`
Expected: FAIL，`partitionKnowledge` 尚未满足分区契约。

- [ ] **Step 3: 创建独立 HTML 骨架**

页面必须包含：返回二级页、认证状态、刷新/分享/退出、全局搜索、`knowledge-reminders`、`knowledge-calendar`、`knowledge-memos`、正文阅读区、认证对话框和令牌对话框。`knowledge.js` 作为 ES module 直接导入 `knowledge-model.js`。

- [ ] **Step 4: 改造知识脚本以渲染三个只读视图**

`loadKnowledgeIndex()` 读取真实索引后调用模型分区；月历按钮只改变本地所选月份或日期；点击提醒或备忘录复用 `openKnowledgeItem(id)`；所有写相关交互保持不存在。

- [ ] **Step 5: 将工作台样式隔离到 knowledge.css**

桌面使用三栏网格，手机纵向排列；复用 `styles.css` 的变量和通用按钮，但所有新选择器以 `knowledge-` 开头，避免影响其他业务页。

- [ ] **Step 6: 运行模型测试、语法检查和构建**

Run: `npm test && node --check knowledge.js && node --check knowledge-model.js && npm run build`
Expected: 所有命令退出码 0，`dist/knowledge.html`、`dist/knowledge.css`、`dist/knowledge-model.js` 存在。

### Task 3: 隐藏二级页入口与正常跳转

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `assets/js/trace-rail.js`（只保留现有动态目录兼容改动）

**Interfaces:**
- Consumes: 现有头像两段拖动手势和 `#showcase` 二级页面。
- Produces: 二级页面内 `<a href="./knowledge.html">知识库</a>`；不产生首页、主导航或页脚入口。

- [ ] **Step 1: 写构建产物入口契约失败测试**

测试构建后的首页：公开导航区域没有知识库链接，`#showcase` 内存在指向 `./knowledge.html` 的链接；独立页返回地址为 `./#showcase`。

- [ ] **Step 2: 运行测试并确认当前内嵌页面使契约失败**

Run: `npm test`
Expected: FAIL，原因是 `index.html` 仍含内嵌 `data-page="knowledge"` 或缺少二级页链接。

- [ ] **Step 3: 移除首页中的内嵌知识页和知识对话框脚本**

保留信息中心原有分享对话框；知识认证和令牌管理移动到 `knowledge.html`，首页不再加载 `knowledge.js`。

- [ ] **Step 4: 恢复隐藏手势并增加二级页入口**

`finishAvatarDrag()` 达到原阈值后设置 `location.hash = "showcase"`。二级页新增与现有标签视觉一致的知识库链接，点击后由浏览器正常导航。

- [ ] **Step 5: 运行完整本地验证**

Run: `npm test && node --check app.js && node --check assets/js/trace-rail.js && npm run build && git diff --check`
Expected: 全部退出码 0。

### Task 4: Worker 与配置复核

**Files:**
- Review/Modify only if required: `src/worker.js`
- Review/Modify only if required: `wrangler.jsonc`

**Interfaces:**
- Consumes: 独立页发出的现有知识 API 请求。
- Produces: 与当前认证和只读数据合同一致的线上响应。

- [ ] **Step 1: 对照最新 Cloudflare 文档复核完整 Worker 和配置**

检查加密随机数、秘密比较、Cookie、KV TTL、请求体/响应体上限、浮动 Promise、跨请求全局状态、`run_worker_first`、绑定和兼容日期，不扩大本次功能范围。

- [ ] **Step 2: 为发现的真实缺陷先写可复现测试**

若复核发现会影响本次知识页的缺陷，先在 Node 测试中构造请求/输入并观察失败，再做最小修复；若无缺陷，不为了制造 diff 改 Worker。

- [ ] **Step 3: 运行 Worker 与配置检查**

Run: `node --check src/worker.js && npx --yes wrangler@latest deploy --dry-run`
Expected: 语法检查通过，dry-run 成功且没有缺失绑定或配置错误。

### Task 5: 真实浏览器验收、提交、推送与部署

**Files:**
- Modify: `docs/superpowers/plans/2026-09-25-standalone-knowledge-workbench.md`（勾选完成项）
- Verify: 所有本次变更文件

**Interfaces:**
- Consumes: 本地 `dist`、Git `main`、Cloudflare Worker `sqdwz-information-hub`。
- Produces: 已推送提交、已部署 Worker 版本和公网验收证据。

- [ ] **Step 1: 本地浏览器验收**

用 Playwright CLI 打开本地构建：在 1440 像素和 390 x 844 视口验证隐藏入口链、认证对话框、独立页空/未认证状态、无横向溢出、触控尺寸和可访问名称；保存截图到 `output/playwright/`。

- [ ] **Step 2: 完整验证并审阅 diff**

Run: `npm test && node --check app.js && node --check knowledge.js && node --check knowledge-model.js && node --check src/worker.js && npm run build && git diff --check`
Expected: 所有命令退出码 0；`git diff --stat` 只包含本次功能及已确认的同批未提交改动。

- [ ] **Step 3: 提交并推送 main**

```powershell
git add app.js assets/js/trace-rail.js index.html knowledge.html knowledge.css knowledge.js knowledge-model.js package.json scripts/build.mjs src/worker.js styles.css wrangler.jsonc tests docs/superpowers
git commit -m "feat: add standalone private knowledge workbench"
git push origin main
```

- [ ] **Step 4: 部署 Cloudflare Worker**

Run: `npx --yes wrangler@latest deploy`
Expected: 输出 Worker 名称、部署成功和新版本 ID。

- [ ] **Step 5: 公网浏览器验收**

在 `https://new.103535.xyz/` 重复隐藏入口和独立页验证，并确认 `/knowledge.html` 返回实际独立页面而非 SPA 首页；记录桌面/手机视口、控制台错误、页面宽度和关键交互结果。

- [ ] **Step 6: 核对发布状态**

Run: `git status --short; git rev-parse HEAD; git rev-parse origin/main`
Expected: 工作树干净，HEAD 与 `origin/main` 相同；最终报告提交哈希、Worker 版本、测试数量和仍需主人凭据才能验证的边界。
