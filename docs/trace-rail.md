# 循迹

适用页面：空域信息（`#airspace`）、行业简报（`#ai`）、城市更新（`#urban`）、资料库（`#policy`）、演示与分享（`#showcase`）。保留现有页头、背景、顶部导航和当前内容，归档改为纵向阅读。

## 公共组件

- `assets/js/trace-rail.js`：日期分组、循迹导航、滚动联动和手机抽屉。
- `assets/css/trace-rail.css`：组件及各功能页的归档样式；首页和独立文件正文保持原有阅读方式。
- 构建脚本原本就复制 `assets/`，无需增加前端依赖。

```js
archiveContainer.innerHTML = TraceArchive.render([
  // date 来自实际数据；html 必须先转义所有外部文本。
  { date: record.published_at, label: "日报", html: renderCard(record) }
], "archive");

const trace = initTraceRail({
  page: document.querySelector("#ai"),
  sections: [
    { element: overview, label: "概览" },
    { element: filters, label: "标签筛选" },
    { element: currentContent, label: "本期内容" },
    { element: archiveContainer, label: "循迹" }
  ],
  archiveTrigger: archiveContainer
});

// 归档数据更新或搜索结果变化后调用，普通滚动不重建节点。
trace.refresh();
// 页面整体销毁时释放事件、观察器及抽屉。
trace.destroy();
```

归档按实际发布日期降序排列，相同日期的多条公告、日报和周报共用一个日期节点。缺少有效发布日期的内容保留在正文末尾，不编造日期。空域范围沿用现有数据中的结束公告，组件本身不新增历史数据源。

## 导航与阅读

桌面保留固定细轨；768px 以下使用右侧中部竖向入口和非模态浮层。600px 以下高度同样使用浮层。入口和标题继续显示当前区域名称。

年份、月份完整呈现，当前月份展开日期；不再使用“较新 / 更早”翻页。标题固定，`.trace-scroll` 独立原生纵向滚动，隐藏滚动条，边缘渐隐提示还有内容。桌面整体最高 70dvh / 720px。

IntersectionObserver 观察顶部导航下方的阅读位置。ResizeObserver 仅在布局变化时重设观察区域；普通滚动不重建日期树，仅在阅读位置落入区块间隙时确认相邻区域。归档展开、收起和节点渐显在 280–420ms 内完成，并遵循 `prefers-reduced-motion`。

日报与周报全文使用原生 `details` 原位展开，正文首次展开才生成。搜索覆盖整期数据，包括正文、项目提示、周报补充板块及来源，并同步更新循迹节点。归档读取并发上限为 4；单期读取失败保留其卡片并提供重试。

## Hash

- `#ai/archive-2026-09-07`：行业简报指定日期。
- `#archive-2026-09-07`：兼容简写，默认进入行业简报。
- `#airspace/airspace-archive-2026-08-17`：空域指定日期。
- `#ai/brief-archive`、`#airspace/airspace-archive`：归档入口。

日期必须存在于数据中。路由先显示所属页面，数据就绪及已有页面入场动画结束后定位；点击节点会更新地址，支持刷新和浏览器前进、后退。移动端选择节点后关闭抽屉，并把键盘焦点交还目标内容。

## 周报路径

前端和 Worker 同时接受日期命名的日报/周报，以及 `data/weekly/YYYY-Www.json` 格式的周报；周数限 01–53。继续拒绝其他目录、路径穿越及日报目录中的周编号文件。

## 本地验证

```powershell
node --check assets/js/trace-rail.js
node --check industry-brief.js
node --check app.js
node --check src/worker.js
git diff --check
npm run build
npx --yes wrangler@latest dev --local --ip 127.0.0.1 --port 4174 --persist-to output/playwright/trace-state
```

Windows 下先停止占用 `dist/` 的开发服务器再执行完整构建，以免目录锁导致 `EBUSY`。本次浏览器验收脚本和截图保存在忽略目录 `output/playwright/`，模拟归档通过浏览器请求拦截注入，不写入业务数据或线上 KV。

## 各功能页接入

手机胶囊、抽屉标题和侧栏当前节点使用实际区域名称，如项目筛选、资料缺口、信息来源、演示或分享。仅进入归档／文件档案时显示“循迹”。平板只显示当前区域节点。

城市更新保留当前／历史切换和所有筛选条件，筛选后的历史记录按发布日期分组，所有日期均可直接定位。资料库按 published_at 分组，内容要点及原文入口保持不变。演示与分享只提供区域导航，不生成日期树。

新增路由使用 `#urban/section/urban-archive-YYYY-MM-DD`、`#policy/section/policy-archive-YYYY-MM-DD` 和 `#showcase/section/showcase-share-page`；与既有 `#policy/<文件ID>` 详情路由分离。`archiveTrigger` 可省略；`beforeJump(target)` 用于先展开目标所在的原有标签页。

## 滚动与手势

- 滚轮、触控板使用原生 overflow；手机轨迹采用 Pointer Events 滑选。overscroll-behavior: contain 防止在列表边界带动正文。
- 鼠标超过 8px 纵移才进入拖动，pointermove 同步 scrollTop；拖动后的 click 被抑制。Pointer capture、cancel 和失去捕获均清理状态。
- 手动浏览期间冻结展开月份并暂停内部定位；最后一次滚动／手势结束 1000ms 后恢复，只调整列表 scrollTop，让 active 最近可见，不滚动正文。
- 手机左拖／右拖以横纵位移比例 1.2 区分方向；横向位移实时控制浮层位置，纵向实时滚动列表并高亮手指附近的候选节点，松手才沿用既有 jump 跳转；取消手势不跳转。浮层不阻挡正文，正文 pointerdown 会关闭它，点击日期和 Escape 同样收起。
- 首页手机横向卡片采用原生滚动、proximity snap，80vw 卡宽及 14px 间距露出下一张；关闭手机自动轮播以免干扰触摸惯性。桌面维持原有 3D 排列，拖动时卡片同步偏移，松手换卡。

## 轻量滑选

手机展开宽度 126px，去掉大底板和关闭按钮，保留区域标题、节点与键盘 Escape。轻点入口展开；按住入口 240ms 后可直接滑选。超过 8px 区分拖动，边缘停留继续滚动，移动期间不执行节点点击；松手仅提交高亮候选。桌面拖动仍只浏览、不提交跳转。手动交互期间暂停 ScrollSpy 内部滚动，结束后 1000ms 恢复。
