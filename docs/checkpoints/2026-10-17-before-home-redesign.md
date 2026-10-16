# 改版前备份点 · 2026-10-17

- Git 标签：`backup-20261017-before-home-redesign`，已推送到 origin。
- 源码提交：`0c2875cf1a40321bafa7fcdb4b79472bf9048d5d`。
- 正式站点：https://new.103535.xyz/
- Cloudflare Worker：`sqdwz-information-hub`。
- 当前线上版本：`71d9a23c-a8f8-4156-99f8-e008c525a597`。
- 状态：星火欢迎页 → 信息首页 → 四个公开栏目；分享与私人知识库入口保持隐藏。
- 已有验收：13 项测试，线上桌面/手机/键盘交互，32 项静态资源、5 个公开 KV JSON 接口。

该标签保存源码与静态资源；访问令牌、密钥及外部业务数据未写入 Git。
可在新的工作目录检出该标签恢复旧版，不覆盖当前工作区：

```powershell
git worktree add ..\information-hub-before-redesign backup-20261017-before-home-redesign
```

本轮目标：人物开屏作为首页，点击浮现栏目入口，各栏目采用深色独立场景，隐藏入口保留。
