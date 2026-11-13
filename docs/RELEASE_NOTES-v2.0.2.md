# Offer猎手 v2.0.2

猎聘单平台桌面投递助手，基于 [loks666/get_jobs](https://github.com/loks666/get_jobs) 二次开发。

## 本次更新

- 修复投递分析页图表在部分电脑上全部空白的问题：图表库 Chart.js 改为随应用本地打包，不再依赖 `cdn.jsdelivr.net`。离线或网络受限的电脑也能正常显示「按城市 / 按公司 / 按行业 / 经验趋势」等图表。
- 其余功能与 v2.0.1 一致。

## 升级说明

- 直接替换程序即可，投递记录和登录态保存在 `%APPDATA%\GetJobs Liepin`，升级不会丢失，无需重新投递。
- 之前图表为空的那台电脑，升级后打开「投递分析」即可看到数据。

## 安装 / 运行要求

- Windows 10 / 11 x64
- Java 21（`JAVA_HOME` 或 PATH）
- Node.js 20+（浏览器驱动需要，PATH）

## Release 资产

- `OfferHunter-2.0.2-portable.exe`：单文件便携版。
- `OfferHunter-2.0.2-win-x64.zip`：解压后运行 `Offer猎手.exe`。
- `SHA256SUMS.txt`：校验文件。

## 注意

- 便携版没有代码签名，Windows SmartScreen 可能提示“未知发布者”。
- 自动投递可能触发平台风控，请小批量使用，风险自担。
- 仅限非商业用途，完整许可见仓库 `LICENSE`。
