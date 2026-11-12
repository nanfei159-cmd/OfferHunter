# Offer猎手 · 猎聘投递助手 · 桌面版

在 `loks666/get_jobs` 的猎聘代码基础上做的单平台桌面版：

- 只保留猎聘，Boss / 智联 / 51job / 拉勾相关代码已删除
- 自定义招呼语（`sayHi`）：点「聊一聊」后补发
- 自动点「发简历 → 立即投递」，使用猎聘账号里的**默认附件简历**
- Electron 桌面窗口，一键启动后端 + 管理页，退出时自动关闭 Java/浏览器

## 直接用

双击：

```
desktop/release-offer/win-unpacked/Offer猎手.exe
```

> 桌面快捷方式「Offer猎手」已指向这个程序。

首次启动会复制初始数据库到：

```
%APPDATA%\GetJobs Liepin\db\getjobs.db
```

日志：

```
%APPDATA%\GetJobs Liepin\backend.log
```

浏览器登录态和 Playwright 数据在：

```
%APPDATA%\GetJobs Liepin\browser-data
```

当前版本要求本机已安装：

- Java 21（`JAVA_HOME` 或 PATH）
- Node.js（patchright 驱动需要）

## 重新构建

```powershell
# 1. 构建前端 + 后端 jar
.\gradlew.bat buildFrontend -PrebuildFrontend
.\gradlew.bat installPatchrightDriver
.\gradlew.bat bootJar

# 2. 打包 Electron
cd desktop
npm install
npm run dist
```

国内网络如果 electron-builder 下载超时：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm run dist
```

## 说明

- 数据库迁移在启动时自动执行（`DbMigration`），旧库缺 `say_hi` / `company_scale` 等列会自动补。
- 招呼语在「猎聘配置 → 自定义招呼语」填写，保存后立即生效。
- 猎聘点「聊一聊」会先发账号里的默认招呼语。只想要一条：取消勾选「补发自定义招呼语」，或者在猎聘设置里清空默认招呼语后保留补发。
- 「同一 HR 只打一次招呼」默认开启；已投递岗位重跑会自动跳过，避免重复发消息。
- 活跃度过滤：默认跳过发布超过 90 天的岗位，以及超过 30 天没活跃的 HR；阈值可在配置页调整，0 表示不限。
- 简历不会上传本地文件；请先在猎聘网页端上传附件简历并设为默认。
- 同一时间只运行一个账号；先小批量、低频率试，自动投递有风控/封号风险。
- 当前版本使用本机 Java 21 + Node.js。要发给别人时，下一步用 jlink 打包运行时并内置 `node.exe`。
