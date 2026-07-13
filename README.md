# GLaDOS 自动签到（Chrome / Edge / Surge / Quantumult X）

本项目提供三种独立的 GLaDOS 自动签到方式：Chrome / Edge 浏览器使用 ScriptCat（脚本猫）脚本管理器，Surge 使用模块，Quantumult X 使用重写规则与定时任务。所有版本都支持 `glados.network` 和 `glados.rocks`，只访问 GLaDOS 官方接口，不会把 Cookie 上传到仓库或第三方服务。

## 选择安装方式

| 使用环境 | 安装方式 | 是否需要 MitM | 适合场景 |
| --- | --- | --- | --- |
| Chrome / Edge | ScriptCat（脚本猫）扩展 + 浏览器后台脚本 | 不需要 | 电脑浏览器经常开启，希望安装后自动运行 |
| Surge | 导入 `.sgmodule` 模块 | 需要 | 已使用 Surge 接管网络 |
| Quantumult X | 导入重写规则并添加定时任务 | 需要 | 已使用 Quantumult X 接管网络 |

签到通知会明确区分“本次签到成功”和“今天已经签过”。本次签到成功时例如：

```text
签到成功！
今日签到获得10积分，共128积分
剩余441天
```

如果今天已经签过，通知会以“今日已签到。”开头，下一行展示当天签到获得的积分和当前总积分。脚本会优先根据接口的状态码与本次获得积分判断，同时兼容 GLaDOS 新旧提示文案。

```text
今日已签到。
今日签到获得11积分，当前共271积分
剩余426天
```

Surge / Quantumult X 版本默认在每天 `07:15` 和 `15:15` 各运行一次；ScriptCat 浏览器版本采用下文所述的候选时间与每日一次成功锁定机制。

## Chrome / Edge 浏览器（ScriptCat 脚本管理器）

这是专门用于 ScriptCat（脚本猫）扩展的浏览器后台定时脚本，不是普通的网页前台脚本。Chrome 和 Edge 均可使用。它不需要抓包、MitM 或复制 Cookie，也不需要保持 GLaDOS 网页打开；只要你在同一个浏览器中登录过 GLaDOS，脚本就会使用该浏览器现有的登录状态在后台完成签到。

### 安装

1. 安装并启用 ScriptCat（脚本猫）脚本管理器扩展：

   - Chrome：[Chrome 应用商店正式版](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf)
   - Edge：[Microsoft Edge 加载项正式版](https://microsoftedge.microsoft.com/addons/detail/scriptcat/liilgpjgabokdklappibcjfablkpcekh)
   - 其他安装方式：[ScriptCat 官方安装文档](https://docs.scriptcat.org/docs/use/use/)

2. 打开下面的脚本发布页，点击“安装脚本”：

```text
https://scriptcat.org/zh-CN/script-show-page/7014
```

3. 在同一个 Chrome 或 Edge 中登录当前官网 [glados.network](https://glados.network/)；如果你仍在使用旧域名 `glados.rocks`，脚本也可以自动识别。
4. 在脚本猫的脚本列表中确认“GLaDOS 自动签到（脚本猫）”已启用。

脚本源文件为 [`glados.auto-checkin.scriptcat.user.js`](glados.auto-checkin.scriptcat.user.js)，发布版本采用 MIT 许可证。

### 使用与定时规则

脚本每天 `00:05–23:55` 设置候选运行时间（每小时的 `05、10、15……55` 分）；当天第一次成功后，脚本猫的 `once` 机制会跳过其余候选时间。因此正常情况下每天只执行一次，无论什么时候打开浏览器，通常 5 分钟内、跨整点时最多 10 分钟就会自动补签。

签到成功时，通知首行显示“签到成功！”；今天已经签过时，通知首行显示“今日已签到。”。通知还会显示累计积分和剩余天数。登录失效时，通知会提示并可点击打开登录页。

脚本会先检查 `glados.network`，未登录时再检查 `glados.rocks`，并始终使用检测到登录状态的同一域名完成签到。两个域名的 Cookie 不互通，但脚本可以分别识别，因此无需手动选择域名。

首次安装后，建议在脚本猫的脚本列表中手动运行一次。若成功，会收到签到结果通知；若失败，可点击该脚本的运行状态查看日志。

### 浏览器脚本权限

- `GM_xmlhttpRequest`：只访问 `glados.network` 和 `glados.rocks` 的登录状态与签到接口。
- `GM_notification`：显示签到结果和错误提醒。
- `GM_openInTab`：仅在点击登录失效通知时打开 GLaDOS 登录页。
- `GM_log`：记录必要的运行状态，方便排查问题。

脚本不会读取、保存或上传 Cookie，不包含统计、广告、返利链接或第三方执行代码。

## Surge（模块方式）

### 1. 安装模块

在 Surge 中打开“模块”，选择“从 URL 安装”，粘贴：

```text
https://raw.githubusercontent.com/Walvez/glados-auto-checkin/main/Surge/glados-auto-checkin.sgmodule
```

启用模块，并确认 Surge 的“脚本”“重写”和“MITM”功能已开启。首次使用 MITM 时，需要先安装并信任 Surge CA 证书。

### 2. 获取登录凭据

保持 Surge 接管网络，在你平时使用的浏览器中登录 [glados.network](https://glados.network/) 或 `glados.rocks`，然后刷新页面。看到“获取 GLaDOS 登录凭据成功”通知即表示完成。脚本会记住实际登录的域名，并使用同一域名签到。

Cookie 更新后，重新登录或刷新页面即可让 Surge 自动更新本地凭据。

### 3. 手动测试

Surge Mac 可在终端运行：

```bash
/Applications/Surge.app/Contents/Applications/surge-cli script evaluate glados.autosign.surge.js cron 20
```

命令中的文件名需要替换为脚本在本机的实际路径。若使用远程模块且没有本地脚本文件，可等待下一次定时任务触发，并在 Surge 的脚本日志中查看结果。

## Quantumult X（重写 + 定时任务方式）

### 1. 导入凭据获取规则

进入“重写”资源，添加以下 URL 并启用：

```text
https://raw.githubusercontent.com/Walvez/glados-auto-checkin/main/QuantumultX/glados-auto-checkin.snippet
```

确认 Quantumult X 已启用重写和 MitM，并已安装、信任 MitM 证书。

### 2. 添加定时任务

在配置文件的 `[task_local]` 段加入：

```ini
15 7,15 * * * https://raw.githubusercontent.com/Walvez/glados-auto-checkin/main/glados.autosign.surge.js, tag=GLaDOS签到, enabled=true
```

如果使用可视化界面，也可以在“定时任务”中添加同一个脚本 URL，Cron 表达式填写 `15 7,15 * * *`。

### 3. 获取登录凭据并测试

保持 Quantumult X 接管网络，在你平时使用的浏览器中登录 [glados.network](https://glados.network/) 或 `glados.rocks` 并刷新页面。收到凭据获取成功通知后，在 Quantumult X 的定时任务列表中手动运行 `GLaDOS签到`。脚本会记住实际登录的域名，并使用同一域名签到。

## 自定义运行时间

Cron 表达式 `15 7,15 * * *` 表示每天 07:15 和 15:15。若只想每天 07:15 运行一次，可改为：

```text
15 7 * * *
```

Surge 用户需要下载模块并修改 `cronexp` 后作为本地模块安装；Quantumult X 用户直接修改 `[task_local]` 中的 Cron 表达式即可。

## 常见问题

### 一直提示需要登录

请确认代理工具正在接管浏览器流量、MitM 与重写已开启，并已信任 CA 证书。之后在自己的浏览器中重新登录 GLaDOS 并刷新页面。

### 为什么一天运行两次

这是默认配置，用于在早晚各尝试一次。GLaDOS 已签到时通常会返回“今日已签到”。你可以按上面的说明改为每天一次。

### 凭据是否会上传

不会。浏览器版本由 ScriptCat 使用浏览器现有登录状态；Surge / Quantumult X 版本只把 Cookie、Authorization 和实际登录域名保存在代理工具的本地持久化存储中，并仅发送给对应的 GLaDOS 官方域名。请勿公开代理工具的配置文件、运行日志或持久化数据。

## 开发

需要 Node.js：

```bash
npm test
```

## 免责声明

本项目仅供学习和个人使用，与 GLaDOS 官方无关。网站接口或策略变化可能导致脚本失效，请遵守相关服务条款并自行承担使用风险。

本项目最初由 [ddgksf2013 的公开脚本资源](https://ddgksf2013.top/)启发，之后针对 Surge、Quantumult X、积分展示和本地凭据管理进行了重写与测试。

## License

[MIT](LICENSE)
