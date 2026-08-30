# Industry Brief · 信息聚合中心

静态前端第一阶段：统一视觉框架、空域信息，以及行业日报与周汇总、城市更新、资料库的接入占位。

## 本地预览

```powershell
cd F:\A2\ppt创建\information-hub
python -m http.server 4173 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4173/`。

## 行业日报与周汇总

内容范围：城市更新 / GIS、AI 模型与工具、测绘 / 无人机。

```text
data/
├─ daily/          # 日报：YYYY-MM-DD.json
├─ weekly/         # 周报：YYYY-Www.json
├─ latest.json     # 最近一次生成结果
└─ index.json      # 日报/周报索引
```

- 非星期五：生成过去 24 小时行业日报
- 星期五：生成过去 7 天周汇总，并加入本周推荐阅读

## 空域数据接口

生产站点优先读取 Cloudflare KV 中的 `/data/airspace.json`。Cloudflare Worker 每 15 分钟从 `sqdwz/hainan-airspace` 主分支的 `data/latest.json` 同步一次：GitHub 用作可追溯的更新源，Cloudflare 保留一份可直接访问的最新副本。若 Cloudflare 首次同步失败，Worker 会回退到随站点发布的 `data/airspace.json`；浏览器端最后才会直连 GitHub。

每个空域事件都有独立 `sources` 数组，支持一个事件对应多个来源，且优先显示官方来源。
