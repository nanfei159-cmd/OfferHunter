<p align="center">
  <img src="docs/icon.png" width="112" alt="Offer猎手图标">
</p>

<h1 align="center">Offer猎手</h1>

<p align="center">
  <strong>猎聘投递助手 · 把重复操作交给程序，把时间留给值得的岗位。</strong>
</p>

<p align="center">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2F11%20x64-0F766E?style=flat-square">
  <img alt="Java" src="https://img.shields.io/badge/Java-21-F59E0B?style=flat-square">
  <img alt="Spring Boot" src="https://img.shields.io/badge/Spring%20Boot-3.5-6DB33F?style=flat-square">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-102033?style=flat-square">
  <img alt="Electron" src="https://img.shields.io/badge/Electron-45-14B8A6?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/License-PolyForm%20Noncommercial-E11D48?style=flat-square">
</p>

> **Offer猎手** 是一个只面向猎聘的 Windows 桌面投递助手。它基于 [loks666/get_jobs](https://github.com/loks666/get_jobs) 二次开发，保留了原项目的本地运行方式，去掉其它招聘平台，重做了桌面体验、投递筛选和多城市选择。

## 界面

| 配置界面 | 多选城市 |
| --- | --- |
| ![配置界面](docs/main.png) | ![多选城市](docs/city-select.png) |

| 投递分析 |
| --- |
| ![投递分析](docs/analysis.png) |

## 功能

- **只做猎聘**：登录、搜索、打招呼、发附件简历，不包含 BOSS / 智联 / 51job / 拉勾。
- **完整城市列表**：内置 374 个城市选项（含港澳及其它地级市），支持搜索和大城市多选，不选或选“全国”表示不限。
- **投递前二次过滤**：城市、公司规模、薪资、发布时间、HR 活跃度都会在投递前按抓取到的数据再校验一次，避免接口软过滤混入不匹配岗位。
- **自定义招呼语**：可选是否补发自定义招呼语；同一 HR 只打一次招呼；已投递岗位重跑自动跳过。
- **默认附件简历**：调用猎聘账号里已经设置好的默认附件简历，本工具不会上传本地文件。
- **实时日志**：发起、跳过、发送简历、异常都会写到右侧日志，便于随时停止和排查。
- **旧数据兼容**：启动时自动补齐数据库字段，并把城市选项同步到现有数据库。

## 快速开始

### 直接运行

运行环境：

- Windows 10 / 11 x64
- **Java 21**（Temurin / OpenJDK 21，`JAVA_HOME` 或 `PATH` 中可用）
- **Node.js 20+**（本地浏览器驱动需要，`PATH` 中可用）

使用步骤：

1. 从 [Releases](../../releases/latest) 下载 `OfferHunter-2.0.1-portable.exe`（单文件便携版），或下载 `OfferHunter-2.0.1-win-x64.zip`（解压后运行 `Offer猎手.exe`）。
2. 双击运行。首次启动会打开猎聘登录页，在浏览器窗口里完成登录。
3. 填写搜索关键词、选择城市和筛选条件，点击「保存配置」。
4. 点击「开始投递」，建议先用小批量关键词试跑；随时可以点「停止投递」。
5. 简历请在猎聘账号中提前上传并设为默认附件简历。

> 便携版没有代码签名，Windows SmartScreen 可能提示“未知发布者”；确认文件来源后再运行。

### 从源码构建

```bash
# 1. 浏览器驱动（Patchright）
./gradlew.bat installPatchrightDriver

# 2. 前端依赖（首次，Node.js 20+ 自带 corepack）
cd front
corepack pnpm install
cd ..

# 3. 后端 jar（会自动构建 front/ 并复制到 src/main/resources/dist）
./gradlew.bat bootJar

# 4. 打包桌面版（便携 exe）
cd desktop
npm install
npx electron-builder --win portable
```

前端已经有 `src/main/resources/dist` 时会跳过重建；需要强制重建时：

```bash
./gradlew.bat buildFrontend -PrebuildFrontend
./gradlew.bat bootJar
```

## 项目结构

```text
src/main/java/                 Spring Boot 后端与猎聘 Worker
src/main/resources/
  liepin-cities.tsv            城市种子数据（启动时同步到 SQLite）
front/                         Next.js 静态管理页面
desktop/                       Electron 桌面壳、图标、启动画面
db-template/getjobs.db         SQLite 空库模板
docs/                          README 截图与图标
```

## 数据与隐私

- 运行数据、Cookie、浏览器配置和投递记录保存在：
  `%APPDATA%\GetJobs Liepin`
- 如果需要彻底重置，先退出程序，再备份或删除该目录。
- 本工具不会把简历、账号 Cookie 或投递记录上传到第三方服务器；所有操作都在本机浏览器里完成。
- 公开仓库和 Release 包不包含你的本地配置、登录态或投递记录。

## 风险提示

- 自动投递、批量打招呼可能触发猎聘风控，存在账号受限风险，请先小批量试用，并自行承担使用后果。
- 本项目与猎聘官方无关，不提供任何“保证 Offer”或“绕过风控”的能力。
- 请遵守目标网站的用户协议和当地法律法规。

## License

本项目沿用上游的 **PolyForm Noncommercial License 1.0.0**，仅限非商业用途；商业使用需获得原作者书面授权。

- Required Notice: Copyright (c) 2024-2026 GET JOBS (https://github.com/loks666/get_jobs)
- 本项目基于 [loks666/get_jobs](https://github.com/loks666/get_jobs) 二次开发，完整许可文本见 [LICENSE](LICENSE)。
