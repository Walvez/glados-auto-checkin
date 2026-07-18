<div align="right">

[简体中文](README.md) | **English**

</div>

<div align="center">

# GLaDOS Auto Check-in

Check in automatically every day and receive clear result notifications<br>
Supports **ScriptCat · Surge · Quantumult X** and all 6 GLaDOS main-site domains: `glados.network`, `glados.rocks`, `glados.one`, `glados.space`, `glados.cloud`, `glados.vip`

[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](package.json)
[![ScriptCat](https://img.shields.io/badge/ScriptCat-Install-ff6b35)](https://scriptcat.org/en/script-show-page/7014)
[![Surge](https://img.shields.io/badge/Surge-Module-5b5bd6)](Surge/glados-auto-checkin.sgmodule)
[![Quantumult X](https://img.shields.io/badge/Quantumult%20X-Snippet-111111)](QuantumultX/glados-auto-checkin.snippet)

[Quick Start](#quick-start) · [Notifications](#notification-examples) · [FAQ](#faq) · [Security](#security-and-privacy)

</div>

> [!NOTE]
> This is an independent project for personal and educational use. It is not affiliated with GLaDOS. Changes to the website API or policies may cause the scripts to stop working.

## Highlights

- **Three platforms**: standalone support for browsers, Surge, and Quantumult X
- **No manual cookie entry**: uses your browser session or captures credentials locally through your proxy app
- **Smart fallback**: skips later runs after a successful check-in on the same day
- **Reliable results**: distinguishes a new check-in from an already completed one and avoids false success reports
- **Limited retries**: retries network errors, HTTP 429, and 5xx responses once
- **Privacy-minded**: credentials stay on your device; proxy versions use only built-in notifications

## Quick Start

Choose one method for your environment. You do not need to install all three.

| Environment | Best for | MitM | Install |
| :--- | :--- | :---: | :--- |
| **Chrome / Edge** | Simple setup and background browser automation | No | [View setup](#chrome--edge) |
| **Surge** | Users who already route traffic through Surge | Yes | [View setup](#surge) |
| **Quantumult X** | Users who already route traffic through Quantumult X | Yes | [View setup](#quantumult-x) |

### Chrome / Edge

The browser version is a background scheduled script for [ScriptCat](https://docs.scriptcat.org/). It does not require packet capture, manual cookie entry, or an open GLaDOS tab.

1. Install ScriptCat from the [Chrome Web Store](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf) or [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/scriptcat/liilgpjgabokdklappibcjfablkpcekh).
2. Open the [GLaDOS Auto Check-in script page](https://scriptcat.org/en/script-show-page/7014) and select Install.
3. Sign in to any GLaDOS main site in the same browser, for example [glados.network](https://glados.network/). Also supported: `glados.rocks`, `glados.one`, `glados.space`, `glados.cloud`, and `glados.vip` (not the defunct `glados.live` or the promo redirect `glados.top`).
4. Make sure the script is enabled in ScriptCat. A manual first run is recommended.

The script schedules candidate runs every five minutes from `00:05` through `23:55`. After the first successful run, ScriptCat's `once` mechanism skips the remaining candidates. It will normally catch up within five minutes after the browser starts, or within ten minutes around the top of an hour.

> [!TIP]
> If your session expires, click the notification to open the GLaDOS sign-in page. ScriptCat's run status contains logs for troubleshooting failed runs.

### Surge

1. Open Modules in Surge, select Install Module from URL, and paste:

   ```text
   https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/Surge/glados-auto-checkin.sgmodule
   ```

2. Enable the module and make sure scripting, rewrite, and MitM are enabled. Install and trust the Surge CA certificate if this is your first time using MitM.
3. Keep Surge active, sign in to GLaDOS in your browser, and refresh the page.
4. Setup is complete when you receive the credential capture notification.

The default schedule checks in at `07:15`, with a fallback run at `15:15` only if the morning run did not succeed. Sign in again or refresh GLaDOS whenever your credentials change.

<details>
<summary><strong>Run an immediate manual test</strong></summary>

`surge-cli script evaluate` accepts a local file path only. Download the current script before evaluating it:

```bash
curl -fsSL 'https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/glados.autosign.surge.js' -o /tmp/glados.autosign.surge.js
/Applications/Surge.app/Contents/Applications/surge-cli script evaluate /tmp/glados.autosign.surge.js cron 20
```

</details>

### Quantumult X

1. Add and enable this URL as a Rewrite resource:

   ```text
   https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/QuantumultX/glados-auto-checkin.snippet
   ```

2. Enable Rewrite and MitM, then install and trust the MitM certificate.
3. Add this scheduled task under `[task_local]`:

   ```ini
   15 7,15 * * * https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/glados.autosign.surge.js, tag=GLaDOS签到, enabled=true
   ```

4. Keep Quantumult X active, sign in to GLaDOS in your browser, and refresh the page.
5. After the credential capture notification appears, run `GLaDOS签到` once from the scheduled tasks list.

## Notification Examples

The scripts distinguish a new successful check-in from one already completed earlier that day.

| New check-in | Already checked in |
| :--- | :--- |
| `Check-in successful!` | `Already checked in today.` |
| Earned 10 points today, 128 total | Earned 11 points today, 271 total |
| 441 days remaining | 426 days remaining |

ScriptCat uses browser notifications by default and optionally supports PushDeer, ServerChan, Telegram, WeCom, DingTalk, Feishu, PushMe, and Bark. Surge and Quantumult X use their built-in notifications only.

<details>
<summary><strong>Configure ScriptCat remote notifications</strong></summary>

Open the script menu in ScriptCat and enter credentials for any channels you want to use. Multiple channels can be active at the same time; save an empty value to disable one.

- WeCom, DingTalk, and Feishu accept either a key/token or a complete webhook URL
- Set the DingTalk custom keyword to `GLaDOS` if keyword validation is enabled
- Notification credentials are stored only in ScriptCat's local storage
- Use the Test Remote Notifications menu command to verify your setup

</details>

## How It Works

```text
Detect session → Request check-in → Validate response → Read points and expiry → Notify locally
      ↓                 ↓
 Multi-domain      Limited retries
```

- ScriptCat probes the 6 main-site domains in order (`glados.network` → `glados.rocks` → `glados.one` → `glados.space` → `glados.cloud` → `glados.vip`) and completes the check-in on the same domain where it finds an active session.
- Surge and Quantumult X capture credentials and the active origin from any of those main sites via MitM, and always send check-in requests to that same domain. They run at `07:15` and `15:15` by default. A successful morning run records the local daily state, so the afternoon run exits silently.
- Unknown responses, HTML error pages, 401/403, 429, and 5xx responses are handled separately. Success is reported only when the script recognizes a check-in record or an explicit success state.

## Custom Schedule

The default Cron expression is `15 7,15 * * *`, meaning 07:15 and 15:15 every day. To run only once at 07:15, use:

```cron
15 7 * * *
```

- **Surge**: download the module, change `cronexp`, and install it as a local module.
- **Quantumult X**: edit the Cron expression under `[task_local]`.

## Security and Privacy

> [!IMPORTANT]
> Do not publish proxy configuration files, logs, or persistent data. They may contain authentication credentials.

- ScriptCat uses your existing browser session and does not explicitly read, store, or upload your GLaDOS cookies.
- Surge and Quantumult X store the cookie, authorization value, and active domain only in the proxy app's local persistent storage, and send them only to the corresponding official GLaDOS main-site domain (one of the 6 listed above).
- Surge and Quantumult X do not call third-party notification services.
- When explicitly enabled, ScriptCat remote notifications contain only a masked email, check-in result, points, and remaining days. They never include GLaDOS cookies or authorization values.
- The project includes no analytics, advertisements, referral links, or third-party executable code.

<details>
<summary><strong>ScriptCat permission details</strong></summary>

| Permission | Purpose |
| :--- | :--- |
| `GM_xmlhttpRequest` | Access GLaDOS session and check-in APIs, plus user-configured notification APIs |
| `GM_notification` | Show results and error notifications |
| `GM_openInTab` | Open the GLaDOS sign-in page when an expired-session notification is clicked |
| `GM_log` | Record essential runtime state for troubleshooting |
| `GM_getValue` / `GM_setValue` | Store optional notification credentials locally |
| `GM_registerMenuCommand` | Provide notification setup and testing commands |

</details>

## FAQ

<details>
<summary><strong>Why does it keep asking me to sign in?</strong></summary>

Make sure your proxy app is handling the browser traffic, MitM and Rewrite are enabled, and the CA certificate is trusted. Then sign in to GLaDOS again and refresh the page.

</details>

<details>
<summary><strong>Why are there two runs per day?</strong></summary>

The second run is a fallback. It exits silently if the morning check-in succeeded or was already completed, and retries only when the morning run failed. See [Custom Schedule](#custom-schedule) to change it to one run per day.

</details>

<details>
<summary><strong>Do I need to configure every domain?</strong></summary>

No. The scripts support all 6 GLaDOS main-site domains (`glados.network`, `glados.rocks`, `glados.one`, `glados.space`, `glados.cloud`, `glados.vip`), detect your active session, and use the same domain for check-in. Cookies are usually not shared across those domains, but each is detected independently. The defunct `glados.live` and the promo redirect `glados.top` are not included.

</details>

<details>
<summary><strong>Are my credentials uploaded?</strong></summary>

No. Credentials are used only inside your browser or proxy app and are sent only to the corresponding official GLaDOS domain. See [Security and Privacy](#security-and-privacy) for details.

</details>

## Development and Testing

Node.js is required. After cloning the repository, run:

```bash
npm test
```

Tests cover all 6 main-site domains, Surge and Quantumult X runtimes, already-completed responses, invalid JSON, 401/403 handling, 429 retries, partial success with 5xx responses, daily skips, config hostname/regex coverage, stable update URLs, and notification boundaries.

### Project Structure

```text
.
├── glados.auto-checkin.scriptcat.user.js  # ScriptCat browser script
├── glados.autosign.surge.js               # Shared Surge / Quantumult X script
├── Surge/
│   └── glados-auto-checkin.sgmodule       # Surge module
├── QuantumultX/
│   └── glados-auto-checkin.snippet        # Quantumult X rewrite rules
└── test-*.js                              # Automated tests
```

All remote install URLs track the `main` branch. Update the existing resource to receive new code; semantic version tags are retained as release snapshots only.

## Acknowledgements

This project was initially inspired by [ddgksf2013's public script resources](https://ddgksf2013.top/), then rewritten and tested for Surge, Quantumult X, points display, and local credential management.

## License

Released under the [MIT License](LICENSE).
