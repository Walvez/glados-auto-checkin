# GLaDOS Auto Check-in

适用于 Surge 和 Quantumult X 的 GLaDOS 自动签到脚本。脚本会从你自己的浏览器请求中获取登录凭据，并保存在代理工具的本地持久化存储中；仓库和通知不会上传 Cookie。

签到通知包含账号、本次获得积分、累计积分和剩余天数，例如：

```text
账户：user@example.com
今日签到获得10积分，共128积分
剩余441天
```

默认在每天 `07:15` 和 `15:15` 各运行一次。重复运行时，GLaDOS 通常会返回“今日已签到”。

## Surge

### 1. 安装模块

在 Surge 中打开“模块”，选择“从 URL 安装”，粘贴：

```text
https://raw.githubusercontent.com/Walvez/glados-auto-checkin/main/Surge/glados-auto-checkin.sgmodule
```

启用模块，并确认 Surge 的“脚本”“重写”和“MITM”功能已开启。首次使用 MITM 时，需要先安装并信任 Surge CA 证书。

### 2. 获取登录凭据

保持 Surge 接管网络，在你平时使用的浏览器中登录 [glados.rocks](https://glados.rocks/)，然后刷新页面。看到“获取 GLaDOS 登录凭据成功”通知即表示完成。

Cookie 更新后，重新登录或刷新页面即可让 Surge 自动更新本地凭据。

### 3. 手动测试

Surge Mac 可在终端运行：

```bash
/Applications/Surge.app/Contents/Applications/surge-cli script evaluate glados.autosign.surge.js cron 20
```

命令中的文件名需要替换为脚本在本机的实际路径。若使用远程模块且没有本地脚本文件，可等待下一次定时任务触发，并在 Surge 的脚本日志中查看结果。

## Quantumult X

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

保持 Quantumult X 接管网络，在你平时使用的浏览器中登录 [glados.rocks](https://glados.rocks/) 并刷新页面。收到凭据获取成功通知后，在 Quantumult X 的定时任务列表中手动运行 `GLaDOS签到`。

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

不会。脚本只把 Cookie 和 Authorization 保存在 Surge 或 Quantumult X 的本地持久化存储中，并仅发送给 `glados.rocks` 的官方接口。请勿公开代理工具的配置文件、运行日志或持久化数据。

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
