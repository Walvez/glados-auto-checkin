<div align="right">

**简体中文** | [English](README_EN.md)

</div>

<div align="center">

# GLaDOS 自动签到

每天自动完成签到，及时通知结果<br>
支持 **ScriptCat · Surge · Quantumult X · GitHub Actions**，兼容 6 个 GLaDOS 主站域名：`glados.network`、`glados.rocks`、`glados.one`、`glados.space`、`glados.cloud`、`glados.vip`

[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.5-blue.svg)](package.json)
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
- **多账号签到**：ScriptCat 可为不同主站域名中的不同账号逐一签到；GitHub Actions 支持多组 Cookie 与每账号独立域名
- **无需手填 Cookie**（本地方案）：自动使用浏览器登录状态，或由代理工具在本机获取凭据
- **云端可选**：GitHub Actions 通过 Repository Secret 传入 Cookie，适合无本机常驻环境
- **智能补签**：当天成功后自动跳过后续任务；同一次 Actions 运行内成功/已签到后不再重复请求
- **结果可靠**：区分“签到成功”与“今日已签到”，异常响应不会误报成功
- **失败重试**：网络错误、HTTP 429 和 5xx 最多自动重试一次
- **隐私友好**：本机凭据不离开设备；Actions 日志对 Cookie 脱敏，且不打印 Secret

## 快速开始

按使用环境选择一种方案即可，不需要同时安装多种方式。

| 使用方式 | 账号能力 | 优势或不同点 | 建议使用场景 | MitM | 手填 Cookie | 安装入口 |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **浏览器（ScriptCat）** | 多账号；每个账号登录不同主站域名 | 无需复制 Cookie，自动使用浏览器中各域名的独立登录状态 | 有多账号需求、日常使用 Chrome / Edge / Firefox | 不需要 | 不需要 | [查看安装步骤](#chrome--edge--firefox) |
| **Surge 模块** | 单账号；后捕获的账号会覆盖前一个 | 代理工具本机定时，不依赖浏览器后台运行 | 日常使用 Surge、只有一个账号 | 需要 | 不需要 | [查看安装步骤](#surge) |
| **Quantumult X 配置** | 单账号；后捕获的账号会覆盖前一个 | 适合已有 Quantumult X 重写与定时任务环境 | 日常使用 Quantumult X、只有一个账号 | 需要 | 不需要 | [查看安装步骤](#quantumult-x) |
| **GitHub Actions** | 多账号；可为每个账号指定域名 | 云端运行，不依赖浏览器、Surge 或 Quantumult X 常驻 | 多账号需求、希望完全脱离本机运行 | 不需要 | 需要（Secret） | [查看安装步骤](#github-actions) |

### Chrome / Edge / Firefox

浏览器方案使用 [ScriptCat（脚本猫）](https://docs.scriptcat.org/docs/use/use/)后台定时脚本，不需要抓包、复制 Cookie 或保持 GLaDOS 网页打开。

1. 安装 ScriptCat：[Chrome 应用商店](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf) / [Edge 加载项](https://microsoftedge.microsoft.com/addons/detail/scriptcat/liilgpjgabokdklappibcjfablkpcekh) / [Firefox 附加组件](https://addons.mozilla.org/zh-CN/firefox/addon/scriptcat/)。
2. 打开 [GLaDOS 自动签到脚本发布页](https://scriptcat.org/zh-CN/script-show-page/7014)，点击“安装脚本”。
3. 在同一个浏览器中登录任一 GLaDOS 主站，例如 [glados.network](https://glados.network/)。另支持 `glados.rocks`、`glados.one`、`glados.space`、`glados.cloud`、`glados.vip`（不含已失效的 `glados.live` 与推广入口 `glados.top`）。
4. 如需多账号，在不同主站域名中分别登录不同账号。例如账号 A 登录 `glados.network`，账号 B 登录 `glados.rocks`；脚本会扫描全部主站并逐个签到。
5. 在脚本猫列表中确认脚本已启用，建议首次安装后手动运行一次。

脚本菜单顶部提供“立即手动签到”和“查看当前登录账号”：前者会立即执行一次完整签到并发送现有通知；后者只在浏览器本机通知中逐行显示“登录域名：脱敏邮箱”，不会读取或展示 Cookie 内容，也不会发送远程通知。

脚本每天在 `00:05–23:55` 之间设置候选运行时间（每 5 分钟一次）。全部已发现账号完成签到后，其余任务会由 ScriptCat 的 `once` 机制跳过；如果部分账号或域名发生网络异常，脚本会保留失败状态，等待下一个候选时间重试。

同一账号如果在多个域名都处于登录状态，会按邮箱自动去重，只签到一次。ScriptCat 不保存账号 Cookie；退出某个域名或让其登录状态失效后，该域名下的账号便不会再被发现和签到。

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

> [!IMPORTANT]
> Surge 模块当前只保存一个账号。若在另一个域名登录并触发凭据捕获，后捕获的账号会覆盖旧账号；本次更新不改变该行为。

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

> [!IMPORTANT]
> Quantumult X 配置当前只保存一个账号。若再次捕获另一账号，后捕获的账号会覆盖旧账号；本次更新不改变该行为。

### GitHub Actions

适合不想依赖浏览器、Surge 或 Quantumult X 常驻的用户。配置完成后，GitHub 会在云端定时执行；单账号和多账号最终都只需要创建一个名为 `GLADOS_COOKIE` 的 Repository Secret。

> [!NOTE]
> Fork 不会继承原仓库的 Secret。Cookie 必须配置在**你自己 Fork 后的仓库**中，不能填在本项目的 Issue、代码或公开日志里。

#### 1. Fork 并启用工作流

1. 点击 [Fork 本仓库](https://github.com/Walvez/glados-auto-checkin/fork)，创建到自己的 GitHub 账号下。
2. 进入 Fork 后的仓库，确认页面左上角显示的是 `你的用户名/glados-auto-checkin`。
3. 打开仓库顶部的 **Actions**。公开仓库的 Fork 默认可能停用定时工作流；若页面出现提示，请点击启用工作流。

#### 2. 获取每个账号的 Cookie

对每个账号分别执行一次：

1. 在准备使用的主站域名登录该账号，例如 [glados.cloud](https://glados.cloud) 或 [glados.rocks](https://glados.rocks)。
2. 按 `F12` 打开开发者工具，切换到 **Network（网络）**。
3. 刷新 GLaDOS 页面，点开 `/api/user/status`、`/console` 等发送到当前 GLaDOS 域名的请求。
4. 在 **Request Headers（请求标头）** 中找到 `Cookie`，复制它的**值**，不要带 `Cookie:` 前缀。通常类似：

   ```text
   koa:sess=……; koa:sess.sig=……
   ```

5. 同时记下当前域名。多个账号应分别登录不同域名并分别复制，例如主号来自 `glados.cloud`、小号来自 `glados.rocks`。

Cookie 相当于登录凭据，并且可能在数周后失效。不要截图公开，也不要发送给其他人。

#### 3. 创建 `GLADOS_COOKIE` Secret

1. 在**你 Fork 后的仓库**打开 **Settings → Secrets and variables → Actions**。
2. 在 **Repository secrets** 区域点击 **New repository secret**。
3. **Name** 必须填写 `GLADOS_COOKIE`，区分大小写。
4. **Secret** 中粘贴下面的 JSON。即使只有一个账号，也推荐使用这种格式：

```json
[
  {"name": "主号", "origin": "https://glados.cloud", "cookie": "koa:sess=...; koa:sess.sig=..."},
  {"name": "小号", "origin": "https://glados.rocks", "cookie": "koa:sess=...; koa:sess.sig=..."}
]
```

5. 点击 **Add secret**。多个账号也只创建这一个 Secret，不要建立 `GLADOS_COOKIE_1`、`GLADOS_COOKIE_2`。

字段说明：

| 字段 | 必需 | 说明 |
| :--- | :---: | :--- |
| `name` | 否 | 仅用于在脱敏日志中区分账号，例如“主号”“小号” |
| `origin` | 推荐 | 该 Cookie 实际来自哪个主站；填写后只向这个官方域名发送凭据 |
| `cookie` | 是 | 从浏览器请求标头复制的完整 Cookie 值 |

`origin` 只接受本项目支持的 6 个 HTTPS 主站。省略后会自动探测全部主站，但不同域名分别登录不同账号时，建议明确填写。

<details>
<summary><strong>兼容的其它 Secret 格式</strong></summary>

单账号可以直接填写一整段 Cookie；多账号也支持 Cookie 字符串 JSON 数组或每行一个完整 Cookie：

```json
["koa:sess=账号1...; koa:sess.sig=...", "koa:sess=账号2...; koa:sess.sig=..."]
```

```text
koa:sess=账号1...; koa:sess.sig=...
koa:sess=账号2...; koa:sess.sig=...
```

不要使用 `&` 分隔账号，因为 Cookie 值本身可能包含 `&`。空 Secret、非法 JSON 或缺少凭据会直接报错，日志不会打印完整 Cookie。

</details>

#### 4. 手动运行并确认成功

1. 打开仓库顶部 **Actions**。
2. 在左侧选择 **GLaDOS Check-in**；若看到 **Enable workflow**，先点击启用。
3. 点击右侧 **Run workflow**，分支保持 `main`，再次点击绿色 **Run workflow**。
4. 打开刚出现的运行记录，等待 `Run GLaDOS check-in` 完成。
5. 绿色对勾表示全部账号成功或今日已签到。日志开头会显示识别到的账号数量，但 Cookie 会被脱敏。

一个账号失败时，脚本仍会继续处理其余账号，但整个任务会显示红色，方便及时发现失效 Cookie。

#### 5. 自动运行时间

工作流默认每天运行两次；GitHub `schedule` 使用 **UTC**：

| Cron（UTC） | 北京时间（UTC+8） | 说明 |
| :--- | :--- | :--- |
| `15 23 * * *` | **07:15** | 早间候选 |
| `15 7 * * *` | **15:15** | 下午补签候选 |

同一账号在**同一次运行**内若已成功或已签到，不会再次请求签到。跨两次 schedule 时，若当天已签到，接口会返回“已签到”，退出码仍为 `0`。

> [!WARNING]
> GitHub 官方说明：公开仓库 Fork 的定时工作流默认停用，且公开仓库连续 60 天无活动时也可能自动停用。若定时任务没有执行，请到 Actions 中重新启用并手动运行一次。定时任务还可能排队延迟，不保证精确到分钟。参见 [GitHub 官方说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)。

#### 6. Cookie 失效后如何更新

重新登录对应域名并复制新 Cookie，然后进入 **Settings → Secrets and variables → Actions**，编辑原来的 `GLADOS_COOKIE`，替换该账号的 `cookie` 字段并保存。无需修改工作流文件，也不要新建第二个同名 Secret。

#### 7. 本地 / CLI 调试（可选）

需要 Node.js 18+（Actions 固定当前 LTS 大版本 **24**）：

```bash
export GLADOS_COOKIE='koa:sess=...; koa:sess.sig=...'
npm run checkin
# 或：node cli/checkin.js
```

可选环境变量 `GLADOS_ORIGIN=https://glados.cloud` 可为未填写 `origin` 的账号指定默认域名；账号对象中的 `origin` 优先。

#### 8. 通知方式

Actions **不内置第三方推送**（避免额外密钥与数据外传）。请依赖：

- Actions 运行成败状态（失败时 job 为红色，退出码 `1`）
- 仓库 **Settings → Notifications** / 关注 Actions 邮件（按你的 GitHub 通知设置）

若自行扩展推送，请保持可选、最小化字段，并补充测试。

## 通知效果

脚本会准确区分本次签到成功与当天已经签到，并使用适合系统通知宽度的单行格式。

| 本次签到成功 | 今日已经签到 |
| :--- | :--- |
| `.network: 14**5@qq.com, ✅, +7; 316积分, 411天.` | `.rocks: qq**5@gmail.com, 已签, +10; 271积分, 426天.` |

`✅` 表示本次首次签到成功，“已签”表示当天已经签到。多账号时每个域名占一行，不再附加冗长的汇总句。

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

- ScriptCat 会检测全部 6 个主站域名（`glados.network` → `glados.rocks` → `glados.one` → `glados.space` → `glados.cloud` → `glados.vip`），收集各域名中的登录账号，按邮箱去重后逐个在原域名签到，并汇总通知结果。
- Surge / Quantumult X 通过 MitM 从上述任一主站捕获登录凭据与实际 origin，签到请求始终发往捕获到的同一域名；两者当前均为单账号，后捕获的凭据会覆盖前一账号。默认在每天 `07:15` 和 `15:15` 触发。
- GitHub Actions / CLI 使用 Cookie Secret；账号对象带 `origin` 时只使用该域名，未填写时按 `glados.cloud` 优先的顺序探测 6 个域名。每个账号都在自己的已登录域名签到，body token 始终与实际请求域名一致。
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
| `GM_registerMenuCommand` | 提供手动签到、登录账号查看、通知配置与测试菜单 |

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

测试覆盖 ScriptCat 跨域多账号、同账号跨域去重与部分失败隔离，全部 6 个主站域名、Surge / Quantumult X 单账号运行时、GitHub Actions / CLI（多账号、每账号 origin、Secret 缺失、域名回退、Cookie 脱敏、成功/已签到/失败退出码）、无效 JSON、401/403、429 重试、5xx、配置文件 hostname/正则、固定更新地址和通知边界。

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
