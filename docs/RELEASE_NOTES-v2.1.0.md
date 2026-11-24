# Offer猎手 v2.1.0

发布日：2026-11-24

## 这版做了什么

- **移除三 Agent 流水线**：删除流水线页面/API、匹配评分、career-ops 桥接、approved 模式、4.5+ 清单和相关脚本。
- **回归海量投递**：保留「猎聘平台配置 → 搜索/过滤 → 自动投递 → 投递分析」主链路。
- **侧边栏两个入口**：猎聘平台配置（`/liepin`）、猎聘投递分析（`/liepin/analysis`），移除页内 tab。
- **投递进度实时化**：逐岗跳过/投递成功/加载进度通过 SSE 推到前端日志面板。
- **一键发简历**：投递成功后出现「为你推荐以下职位」弹窗时，自动点击右下角「一键发简历(N)」。
- **招呼语修复**：发送前等待聊天输入框可见；补发成功/失败都有日志；直接投递后若按钮变成「继续聊」，进入聊天补发自定义招呼语。
- **修复批量插入越界**：移除匹配列后参数序号未对齐，导致 `Index 21 out of bounds`；已修正。
- **数据兼容**：不删除历史 `delivered` / `stage` / 匹配字段；新代码只使用投递状态四态 `discovered/applied/failed/skipped`。

## 升级说明

- 覆盖安装即可，用户数据仍在 `%APPDATA%\GetJobs Liepin`，不会清空。
- 旧的三 Agent 流水线入口和「投递已批准」按钮已移除。
- 如需重新启用 allowlist，在 `%APPDATA%\GetJobs Liepin\allowlist.json` 放 job_id 数组；文件不存在表示不过滤。

## 产物

- `OfferHunter-2.1.0-portable.exe`
- `OfferHunter-2.1.0-win-x64.zip`
- `win-unpacked/Offer猎手.exe`
