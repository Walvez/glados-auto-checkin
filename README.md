<div align="right">

**简体中文** | [English](README_EN.md)

</div>

<div align="center">

# GLaDOS 自动签到

每天自动完成签到，及时通知结果<br>
支持 **ScriptCat · Surge · Quantumult X · GitHub Actions**，兼容 6 个 GLaDOS 主站域名：`glados.network`、`glados.rocks`、`glados.one`、`glados.space`、`glados.cloud`、`glados.vip`

[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.4.1-blue.svg)](package.json)
[![ScriptCat](https://img.shields.io/badge/ScriptCat-安装脚本-ff6b35)](https://scriptcat.org/zh-CN/script-show-page/7014)
[![Surge](https://img.shields.io/badge/Surge-Module-5b5bd6)](Surge/glados-auto-checkin.sgmodule)
[![Quantumult X](https://img.shields.io/badge/Quantumult%20X-Snippet-111111)](QuantumultX/glados-auto-checkin.snippet)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-自动签到-2088FF)](.github/workflows/checkin.yml)

[快速开始](#快速开始) · [通知效果](#通知效果) · [常见问题](#常见问题) · [安全与隐私](#安全与隐私)

</div>

> [!NOTE]
> 本项目与 GLaDOS 官方无关，仅供学习与个人使用。网站接口或策略变化可能导致脚本失效。

## 功能亮点

- **多端支持**：浏览器、Surge、Quantumult X 与 GitHub Actions 均可独立使用
- **无需手填 Cookie**（本地方案）：自动使用浏览器登录状态，或由代理工具在本机获取凭据
- **云端可选**：GitHub Actions 通过 Repository Secret 传入 Cookie，适合无本机常驻环境
- **智能补签**：当天成功后自动跳过后续任务；同一次 Actions 运行内成功/已签到后不再重复请求
- **结果可靠**：区分“签到成功”与“今日已签到”，异常响应不会误报成功
- **失败重试**：网络错误、HTTP 429 和 5xx 最多自动重试一次
- **隐私友好**：本机凭据不离开设备；Actions 日志对 Cookie 脱敏，且不打印 Secret

## 快速开始

按使用环境选择一种方案即可，不需要同时安装多种方式。

| 使用环境 | 推荐场景 | MitM | 手填 Cookie | 安装入口 |
| :--- | :--- | :---: | :---: | :--- |
| **Chrome / Edge** | 希望安装简单、浏览器后台自动运行 | 不需要 | 不需要 | [查看安装步骤](#chrome--edge) |
| **Surge** | 日常已使用 Surge 接管网络 | 需要 | 不需要 | [查看安装步骤](#surge) |
| **Quantumult X** | 日常已使用 Quantumult X | 需要 | 不需要 | [查看安装步骤](#quantumult-x) |
| **GitHub Actions** | 无本机常驻、希望云端定时签到 | 不需要 | 需要（Secret） | [查看安装步骤](#github-actions) |

### Chrome / Edge

浏览器方案使用 [ScriptCat（脚本猫）](https://docs.scriptcat.org/docs/use/use/)后台定时脚本，不需要抓包、复制 Cookie 或保持 GLaDOS 网页打开。

1. 安装 ScriptCat：[Chrome 应用商店](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf) / [Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/scriptcat/liilgpjgabokdklappibcjfablkpcekh)。
2. 打开 [GLaDOS 自动签到脚本发布页](https://scriptcat.org/zh-CN/script-show-page/7014)，点击“安装脚本”。
3. 在同一个浏览器中登录任一 GLaDOS 主站，例如 [glados.network](https://glados.network/)。另支持 `glados.rocks`、`glados.one`、`glados.space`、`glados.cloud`、`glados.vip`（不含已失效的 `glados.live` 与推广入口 `glados.top`）。
4. 在脚本猫列表中确认脚本已启用，建议首次安装后手动运行一次。

脚本每天在 `00:05–23:55` 之间设置候选运行时间（每 5 分钟一次）。当天第一次成功后，其余任务会由 ScriptCat 的 `once` 机制跳过。因此无论何时打开浏览器，通常 5 分钟内、跨整点时最多 10 分钟即可补签。

> [!TIP]
> 登录失效时，点击通知可直接打开 GLaDOS 登录页。运行失败时，可在脚本猫中打开该脚本的运行状态查看日志。

### Surge

1. 在 Surge 中进入“模块” → “从 URL 安装”，粘贴以下地址：

   ```text
   https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/Surge/glados-auto-checkin.sgmodule
   ```

2. 启用模块，并确认 Surge 的脚本、重写和 MitM 功能已开启。首次使用 MitM 时，请先安装并信任 Surge CA 证书。
3. 保持 Surge 接管网络，在浏览器中登录 GLaDOS 并刷新页面。
4. 收到“获取 GLaDOS 登录凭据成功”通知后即配置完成。

默认每天 `07:15` 签到；若早上未成功，则在 `15:15` 补签。凭据更新后，重新登录或刷新 GLaDOS 页面即可同步到本机。

<details>
<summary><strong>立即手动测试</strong></summary>

`surge-cli script evaluate` 只接受本地文件路径，可先下载脚本再运行：

```bash
curl -fsSL 'https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/glados.autosign.surge.js' -o /tmp/glados.autosign.surge.js
/Applications/Surge.app/Contents/Applications/surge-cli script evaluate /tmp/glados.autosign.surge.js cron 20
```

</details>

### Quantumult X

1. 在“重写”资源中添加并启用以下地址：

   ```text
   https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/QuantumultX/glados-auto-checkin.snippet
   ```

2. 确认重写和 MitM 已启用，并已安装、信任 MitM 证书。
3. 在配置文件的 `[task_local]` 段添加定时任务：

   ```ini
   15 7,15 * * * https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/glados.autosign.surge.js, tag=GLaDOS签到, enabled=true
   ```

4. 保持 Quantumult X 接管网络，在浏览器中登录 GLaDOS 并刷新页面。
5. 收到凭据获取成功通知后，在定时任务列表中手动运行一次 `GLaDOS签到`。

### GitHub Actions

适合没有常开电脑/手机代理的场景。工作流使用 Node.js CLI，复用与本仓库一致的响应校验、有限重试与同域名签到逻辑；签到 API 的 body token 会自动使用当前请求域名（例如请求 `glados.rocks` 时使用 `glados.rocks`）。

#### 1. 使用本仓库或 Fork

1. [Fork](https://github.com/Walvez/glados-auto-checkin/fork) 本仓库，或直接在本仓库（若你有写权限）配置 Secrets。
2. 打开仓库 **Settings → Secrets and variables → Actions**。
3. 新建 Repository Secret：

| Secret 名称 | 必需 | 说明 |
| :--- | :---: | :--- |
| `GLADOS_COOKIE` | 是 | 一个或多个账号的 Cookie（格式见下） |

#### 2. 获取 Cookie

1. 在浏览器登录 GLaDOS（推荐当前主站 [glados.cloud](https://glados.cloud)，其它 5 个主站域名也可）。
2. 打开开发者工具 → Application / 存储 → Cookies，或使用 Cookie 编辑扩展。
3. 复制与会话相关的 Cookie 字符串，通常类似：

   ```text
   koa:sess=……; koa:sess.sig=……
   ```

4. 粘贴到 Secret `GLADOS_COOKIE`。**不要**提交到代码仓库或发到 Issue。

#### 3. 多账号格式（稳健）

**不要使用 `&` 作为账号分隔符**（Cookie 值本身可能包含 `&`）。请使用下列之一：

**JSON 数组（推荐）**

```json
["koa:sess=账号1...; koa:sess.sig=...", "koa:sess=账号2...; koa:sess.sig=..."]
```

或带名称：

```json
[
  {"name": "主号", "cookie": "koa:sess=...; koa:sess.sig=..."},
  {"name": "小号", "cookie": "koa:sess=...; koa:sess.sig=..."}
]
```

**逐行（每行一个完整 Cookie）**

```text
koa:sess=账号1...; koa:sess.sig=...
koa:sess=账号2...; koa:sess.sig=...
```

空 Secret、空行-only、非法 JSON 会快速失败并退出码为 `1`；日志会脱敏，不会打印完整 Cookie。

#### 4. 启用并验证

1. 打开 **Actions**，选择 **GLaDOS Check-in**。
2. 若提示启用工作流，先启用。
3. 点击 **Run workflow** 手动跑一次，确认为绿色成功。
4. 默认定时（GitHub `schedule` 使用 **UTC**）：

| Cron（UTC） | 北京时间（UTC+8） | 说明 |
| :--- | :--- | :--- |
| `15 23 * * *` | **07:15** | 早间候选 |
| `15 7 * * *` | **15:15** | 下午补签候选 |

同一账号在**同一次运行**内若已成功或已签到，不会再次请求签到。跨两次 schedule 时，若当天已签到，接口会返回“已签到”，退出码仍为 `0`。

> [!WARNING]
> GitHub 对不活跃或新建 Fork 的 `schedule` 可能延迟甚至不触发；手动 `workflow_dispatch` 始终可用。需要更高可靠度时，可用外部 cron 调用 [workflow_dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)。

#### 5. 本地 / CLI 调试（可选）

需要 Node.js 18+（Actions 固定当前 LTS 大版本 **24**）：

```bash
export GLADOS_COOKIE='koa:sess=...; koa:sess.sig=...'
npm run checkin
# 或：node cli/checkin.js
```

可选环境变量 `GLADOS_ORIGIN=https://glados.cloud` 可强制只使用单一域名。

#### 6. 通知方式

Actions **不内置第三方推送**（避免额外密钥与数据外传）。请依赖：

- Actions 运行成败状态（失败时 job 为红色，退出码 `1`）
- 仓库 **Settings → Notifications** / 关注 Actions 邮件（按你的 GitHub 通知设置）

若自行扩展推送，请保持可选、最小化字段，并补充测试。

## 通知效果

脚本会准确区分本次签到成功与当天已经签到。

| 本次签到成功 | 今日已经签到 |
| :--- | :--- |
| `签到成功！` | `今日已签到。` |
| 今日签到获得 10 积分，共 128 积分 | 今日签到获得 11 积分，当前共 271 积分 |
| 剩余 441 天 | 剩余 426 天 |

ScriptCat 默认使用浏览器通知，也可以按需配置 PushDeer、Server酱、Telegram、企业微信、钉钉、飞书、PushMe 或 Bark。Surge 与 Quantumult X 仅使用应用自带通知。

<details>
<summary><strong>配置 ScriptCat 远程通知</strong></summary>

在脚本猫的脚本菜单中填写所需通知渠道的密钥，多个渠道可以同时开启，留空并保存即关闭对应渠道。

- 企业微信、钉钉和飞书可填写 Key / Token，也可粘贴完整 Webhook URL
- 钉钉机器人启用自定义关键词时，请将关键词设为 `GLaDOS`
- 密钥仅保存在脚本猫本地存储中
- 可通过“测试远程通知”菜单检查配置

</details>

## 工作方式

```text
检测登录状态 → 请求签到接口 → 校验响应 → 获取积分与剩余天数 → 本机通知
      ↓              ↓
  多域名兼容     失败时有限重试
```

- ScriptCat 按顺序检测 6 个主站域名（`glados.network` → `glados.rocks` → `glados.one` → `glados.space` → `glados.cloud` → `glados.vip`），并始终在检测到登录状态的同一域名完成签到。
- Surge / Quantumult X 通过 MitM 从上述任一主站捕获登录凭据与实际 origin，签到请求始终发往捕获到的同一域名；默认在每天 `07:15` 和 `15:15` 触发。早上成功后会记录当天状态，下午静默跳过。
- GitHub Actions / CLI 使用 Cookie Secret，按 `glados.cloud` 优先的顺序探测 6 个域名，在**同一已登录域名**上完成签到；body token 始终与实际请求域名一致。
- 未知响应、HTML 错误页、401/403、429 和 5xx 均会分别处理，只有识别到签到记录或明确成功状态时才会显示成功。

## 自定义运行时间

默认 Cron 表达式为 `15 7,15 * * *`，表示每天 07:15 和 15:15 运行。若只需每天 07:15 运行一次，改为：

```cron
15 7 * * *
```

- **Surge**：下载模块，修改 `cronexp` 后作为本地模块安装。
- **Quantumult X**：直接修改 `[task_local]` 中的 Cron 表达式。

## 安全与隐私

> [!IMPORTANT]
> 请勿公开代理工具的配置文件、运行日志、GitHub Actions 日志截图或 Secret 内容，其中可能包含登录凭据。

- ScriptCat 使用浏览器现有登录状态，不会显式读取、保存或上传 GLaDOS Cookie。
- Surge / Quantumult X 仅将 Cookie、Authorization 和实际登录域名保存在代理工具的本地持久化存储中，并只发送给对应的 GLaDOS 官方主站域名（上述 6 个之一）。
- Surge / Quantumult X 不请求任何第三方通知接口。
- ScriptCat 仅在用户主动开启远程通知后，发送脱敏邮箱、签到结果、积分和剩余天数；请求不包含 GLaDOS Cookie 或 Authorization。
- **GitHub Actions**：Cookie 仅存放在 Repository Secret `GLADOS_COOKIE` 中；工作流权限最小为 `contents: read`；CLI 日志对 Cookie / Bearer 脱敏，且 workflow 不会 `echo` Secret。Fork 后请在**自己的仓库**配置 Secret，勿把 Cookie 写进代码或 PR。
- 项目不包含统计、广告、返利链接或第三方执行代码。

<details>
<summary><strong>ScriptCat 权限说明</strong></summary>

| 权限 | 用途 |
| :--- | :--- |
| `GM_xmlhttpRequest` | 访问 GLaDOS 登录状态与签到接口；按用户配置访问通知 API |
| `GM_notification` | 显示签到结果和错误提醒 |
| `GM_openInTab` | 点击登录失效通知时打开 GLaDOS 登录页 |
| `GM_log` | 记录必要运行状态，便于排查问题 |
| `GM_getValue` / `GM_setValue` | 在本机保存可选的通知密钥 |
| `GM_registerMenuCommand` | 提供通知配置与测试菜单 |

</details>

## 常见问题

<details>
<summary><strong>一直提示需要登录</strong></summary>

请确认代理工具正在接管浏览器流量，MitM 与重写已开启，并且 CA 证书已经受信任。随后在浏览器中重新登录 GLaDOS 并刷新页面。

</details>

<details>
<summary><strong>为什么一天触发两次</strong></summary>

这是默认补签机制。早上签到成功或已经签到后，下午任务会静默跳过；只有早上失败时才会再次尝试。也可以按[自定义运行时间](#自定义运行时间)改为每天一次。

</details>

<details>
<summary><strong>多个域名需要分别配置吗</strong></summary>

不需要。脚本兼容 6 个 GLaDOS 主站域名（`glados.network`、`glados.rocks`、`glados.one`、`glados.space`、`glados.cloud`、`glados.vip`），会识别实际登录的域名并使用同一域名签到。各主站域名的 Cookie 通常不互通，但脚本可分别检测。不包含已失效的 `glados.live` 与推广跳转入口 `glados.top`。

</details>

<details>
<summary><strong>凭据会上传吗</strong></summary>

本地方案：凭据只在浏览器或代理工具本机使用，并仅发送给对应的 GLaDOS 官方域名。

GitHub Actions：凭据保存在你仓库的 Secret 中，运行时仅发送给 GLaDOS 官方域名；不会提交进 git。详细说明见[安全与隐私](#安全与隐私)。

</details>

<details>
<summary><strong>GitHub Actions 一直失败 / 提示需要登录</strong></summary>

Cookie 可能已过期（常见约数十天），或复制不完整。请重新登录 [glados.cloud](https://glados.cloud)（或其它主站），更新 Secret `GLADOS_COOKIE` 后手动 **Run workflow**。确认 Cookie 来自你实际能打开控制台的域名；各主站 Cookie 通常不互通，CLI 会自动探测 6 个域名。

</details>

<details>
<summary><strong>为何返回 please checkin via ...</strong></summary>

这通常表示签到请求 body 中的 token 与当前请求域名不一致。GLaDOS 官网会按域名发送对应 token，例如 `glados.network` 使用 `glados.network`、`glados.rocks` 使用 `glados.rocks`。本仓库所有脚本都会根据实际 origin 自动生成 token。

</details>

<details>
<summary><strong>Actions 定时没有跑</strong></summary>

GitHub `schedule` 在新建或不活跃 Fork 上可能不触发或严重延迟，这是平台限制。可先用 **Run workflow** 验证逻辑，或使用外部定时调用 `workflow_dispatch`。工作流注释与上文时间表已标明 UTC 与北京时间对应关系。

</details>

## 开发与测试

项目需要 Node.js 18+。克隆仓库后运行：

```bash
npm test
```

测试覆盖全部 6 个主站域名、Surge / Quantumult X 运行时、GitHub Actions / CLI（多账号、Secret 缺失、域名回退、Cookie 脱敏、成功/已签到/失败退出码）、已签到响应、无效 JSON、401/403、429 重试、5xx、当日跳过、配置文件 hostname/正则、固定更新地址和通知边界。

### 项目结构

```text
.
├── glados.auto-checkin.scriptcat.user.js  # ScriptCat 浏览器脚本
├── glados.autosign.surge.js               # Surge / Quantumult X 共用脚本
├── lib/glados-core.js                     # 共享签到校验与凭据解析
├── cli/checkin.js                         # Node.js CLI / Actions 入口
├── .github/workflows/
│   ├── checkin.yml                        # 定时 + 手动签到
│   └── test.yml                           # 推送 / PR 测试
├── Surge/
│   └── glados-auto-checkin.sgmodule       # Surge 模块
├── QuantumultX/
│   └── glados-auto-checkin.snippet        # Quantumult X 重写规则
└── test-*.js                              # 自动化测试
```

所有远程安装地址固定跟随 `main` 分支，更新现有资源即可获取新版本；语义化版本标签仅用于保留发布快照。

## 致谢

项目最初由 [ddgksf2013 的公开脚本资源](https://ddgksf2013.top/)启发，之后针对 Surge、Quantumult X、积分展示和本地凭据管理进行了重写与测试。

## License

基于 [MIT License](LICENSE) 开源。
