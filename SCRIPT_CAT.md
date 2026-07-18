> 无需复制 Cookie，也无需保持 GLaDOS 网页打开。登录一次，之后由 ScriptCat 在浏览器后台自动完成每日签到。

## ✨ 功能亮点

- 自动兼容 6 个 GLaDOS 主站域名：`glados.network`、`glados.rocks`、`glados.one`、`glados.space`、`glados.cloud`、`glados.vip`
- 在检测到登录状态的同一域名完成签到
- 准确区分签到成功、今日已签到、登录失效和接口异常
- 通知展示脱敏账号、积分与剩余天数
- 网络错误、HTTP 429 和服务异常自动重试一次
- 当天成功后自动跳过其余候选任务
- 不包含统计、广告、返利链接或第三方执行代码

## 🚀 三步开始

### 1. 安装扩展

安装并启用 ScriptCat 扩展。

### 2. 登录账号

在同一浏览器中登录任一 GLaDOS 主站，例如 [glados.network](https://glados.network/)。

### 3. 启用脚本

安装并启用本脚本，首次使用建议手动运行一次。

> 完成后不需要保持 GLaDOS 网页打开。

## 🔔 通知效果

### 本次签到成功

```text
签到成功！
今日签到获得 10 积分，共 128 积分
剩余 441 天
```

### 今天已经签到

```text
今日已签到。
今日签到获得 11 积分，当前共 271 积分
剩余 426 天
```

## 📮 可选远程通知

默认全部关闭，可在脚本菜单中按需开启：
`PushDeer` · `Server酱` · `Telegram` · `企业微信` · `钉钉` · `飞书` · `PushMe` · `Bark`

### 配置说明

多个渠道可以同时使用。企业微信、钉钉和飞书支持填写 Key / Token 或完整 Webhook URL；通知密钥仅保存在 ScriptCat 本地，可通过“测试远程通知”菜单检查配置。

## 🛡️ 隐私说明

- 不会显式读取、保存或上传 GLaDOS Cookie
- 远程通知不包含 Cookie、Authorization 或完整邮箱
- 仅向上述 6 个 GLaDOS 主站域名和用户主动配置的通知平台发送请求

## ⏰ 定时规则

脚本每天设置多个候选运行时间。当天第一次成功后，ScriptCat 的 `once` 机制会自动跳过其余候选任务。

## 📦 完整开源项目

欢迎访问 [Walvez/glados-auto-checkin](https://github.com/Walvez/glados-auto-checkin) 查看完整源码、详细文档与版本更新。

| 平台 | 使用方式 |
| :--- | :--- |
| **Surge 模块** | 导入模块后自动获取登录凭据并定时签到 |
| **Quantumult X 配置** | 通过重写规则与定时任务完成自动签到 |

### 支持项目

> ⭐ 如果这个项目对你有帮助，欢迎在 GitHub 点一个 Star，你的支持是项目持续维护的动力。

### 免责声明

本脚本仅供学习和个人使用，与 GLaDOS 官方无关。
