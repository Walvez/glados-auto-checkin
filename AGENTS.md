# AGENTS.md — GLaDOS 自动签到

## 项目定位

多端 GLaDOS 每日签到：ScriptCat 浏览器脚本、Surge / Quantumult X 本机模块、GitHub Actions / CLI。公开仓库 `Walvez/glados-auto-checkin`；现役版本以 `package.json` 与 `main` 为准（当前 **1.5.9**）。

## 怎么跑

```bash
npm test
npm run checkin   # 需 GLADOS_COOKIE；可选 GLADOS_ORIGIN
```

ScriptCat 安装页：`https://scriptcat.org/zh-CN/script-show-page/7014`  
远程模块/脚本 URL 跟随 `main` Raw，不跟语义化 tag。

## 技术栈

纯 Node.js 18+（无 npm 依赖）。Actions 签到固定 Node **24**；`test.yml` 用 Node 22。共享校验在 `lib/glados-core.js`，**仅** `cli/checkin.js` 引用；ScriptCat 与 Surge/QX 脚本是独立运行时，勿假设共用源码。

## 目录与约定

- `glados.auto-checkin.scriptcat.user.js`：多账号；扫描全部支持主站、按邮箱去重、原域名签到；不持久化 Cookie
- `glados.autosign.surge.js` + `Surge/` + `QuantumultX/`：单账号，后捕获覆盖前账号
- `.github/workflows/checkin.yml`：`GLADOS_COOKIE` Secret；`contents: read`；支持 JSON 多账号与每账号 `origin`
- 用户文档：`README.md` / `README_EN.md` / `SCRIPT_CAT.md`（对外以用户安装与隐私说明为主）
- 本机 `run-glados-now.*` 已 gitignore，含本机 Surge API 密钥，勿提交、勿写进文档

## 红线（下次必守）

1. **白名单域名**（当前 7 个，禁止 `glados.*` 通配）：  
   `glados.network` `glados.rocks` `glados.one` `glados.space` `glados.cloud` `glados.vip` `glados-facility.com`  
   新增域名须重新验证 DNS/API/资源指纹；`glados.live` 已失效、`glados.top` 为推广跳转，不进白名单。
2. Cookie / token **同 origin**：签到 body token = 实际请求 hostname；凭据只发往捕获或 Secret 指定的域名。
3. 版本三处一致：`package.json`、`// @version`、相关测试断言；改菜单/通知文案时同步测试。
4. 不把 Cookie、完整邮箱、本机 API Key 写进源码、Issue、日志示例或记忆。
5. 发布门禁：`git diff --check` + 完整 `npm test`；再按用户授权推 `main`/PR；公开面核对 Raw 与 ScriptCat `7014` 源码版本。勿默认操作 ScriptCat 管理后台（用户常自行同步）。
6. 上游仓库里 **GLaDOS Check-in** 工作流可能被维护者手动停用（缺 Secret）；**Test** 仍应保持可跑。文档描述的是 Fork 用户如何配置，不是本机维护者私有 Actions 状态。

## 当前状态

- 代码 / 文档 / GitHub Raw / ScriptCat 1.5.9 已对齐 `glados-facility.com`
- 无项目级 CLAUDE.md；本文件为 Codex/Agent 入口
- 发布细节见 `~/.codex/memories/skills/glados-auto-checkin-release/SKILL.md`
