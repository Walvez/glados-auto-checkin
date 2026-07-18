<div align="right">

[简体中文](README.md) | **English**

</div>

<div align="center">

# GLaDOS Auto Check-in

Check in automatically every day and receive clear result notifications<br>
Supports **ScriptCat · Surge · Quantumult X · GitHub Actions** and all 6 GLaDOS main-site domains: `glados.network`, `glados.rocks`, `glados.one`, `glados.space`, `glados.cloud`, `glados.vip`

[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](package.json)
[![ScriptCat](https://img.shields.io/badge/ScriptCat-Install-ff6b35)](https://scriptcat.org/en/script-show-page/7014)
[![Surge](https://img.shields.io/badge/Surge-Module-5b5bd6)](Surge/glados-auto-checkin.sgmodule)
[![Quantumult X](https://img.shields.io/badge/Quantumult%20X-Snippet-111111)](QuantumultX/glados-auto-checkin.snippet)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Check-in-2088FF)](.github/workflows/checkin.yml)

[Quick Start](#quick-start) · [Notifications](#notification-examples) · [FAQ](#faq) · [Security](#security-and-privacy)

</div>

> [!NOTE]
> This is an independent project for personal and educational use. It is not affiliated with GLaDOS. Changes to the website API or policies may cause the scripts to stop working.

## Highlights

- **Multiple platforms**: browsers, Surge, Quantumult X, and GitHub Actions
- **Multiple accounts**: ScriptCat checks different accounts logged in on different main-site domains; GitHub Actions accepts multiple cookies with per-account domains
- **No manual cookie entry** (local options): uses your browser session or captures credentials via your proxy app
- **Optional cloud run**: GitHub Actions accepts one or more account cookies via a Repository Secret
- **Smart fallback**: skips later local tasks after a successful day; within a single Actions run, successful/already-checked accounts are not checked in again
- **Reliable results**: distinguishes a new check-in from an already completed one and avoids false success reports
- **Limited retries**: retries network errors, HTTP 429, and 5xx responses once
- **Privacy-minded**: local credentials stay on device; Actions logs redact cookies and never echo secrets

## Quick Start

Choose one method for your environment. You do not need every option.

| Method | Account support | Key difference | Recommended use | MitM | Manual cookie | Install |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **This ScriptCat script** | Multiple accounts on different main-site domains | Reuses browser sessions without copying cookies | Multiple accounts; regular Chrome / Edge use | No | No | [View setup](#chrome--edge) |
| **Surge module** | One account; the latest captured account replaces the previous one | Runs locally without a background browser | Regular Surge use with one account | Yes | No | [View setup](#surge) |
| **Quantumult X config** | One account; the latest captured account replaces the previous one | Fits an existing Rewrite and scheduled-task setup | Regular Quantumult X use with one account | Yes | No | [View setup](#quantumult-x) |
| **GitHub Actions** | Multiple accounts with an optional domain per account | Runs in the cloud without a browser or proxy app | Multiple accounts; no always-on local device | No | Yes (Secret) | [View setup](#github-actions) |

### Chrome / Edge

The browser version is a background scheduled script for [ScriptCat](https://docs.scriptcat.org/). It does not require packet capture, manual cookie entry, or an open GLaDOS tab.

1. Install ScriptCat from the [Chrome Web Store](https://chromewebstore.google.com/detail/scriptcat/ndcooeababalnlpkfedmmbbbgkljhpjf) or [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/scriptcat/liilgpjgabokdklappibcjfablkpcekh).
2. Open the [GLaDOS Auto Check-in script page](https://scriptcat.org/en/script-show-page/7014) and select Install.
3. Sign in to any GLaDOS main site in the same browser, for example [glados.network](https://glados.network/). Also supported: `glados.rocks`, `glados.one`, `glados.space`, `glados.cloud`, and `glados.vip` (not the defunct `glados.live` or the promo redirect `glados.top`).
4. For multiple accounts, sign in to a different account on each main-site domain—for example, account A on `glados.network` and account B on `glados.rocks`.
5. Make sure the script is enabled in ScriptCat. A manual first run is recommended.

The script schedules candidate runs every five minutes from `00:05` through `23:55`. Each run scans all six domains, deduplicates sessions by email, and checks in every discovered account. ScriptCat's `once` mechanism skips later candidates only after all discovered accounts complete; partial network failures remain eligible for a later retry.

ScriptCat does not store account cookies. Once you sign out of a domain or its session expires, that domain's account is no longer discovered or checked in.

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

> [!IMPORTANT]
> The Surge module currently stores one account. Capturing another account replaces the previous credentials; this release does not change that behavior.

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

> [!IMPORTANT]
> The Quantumult X setup currently stores one account. Capturing another account replaces the previous credentials; this release does not change that behavior.

### GitHub Actions

Use this when you do not keep a local browser or proxy running. The workflow natively supports multiple accounts: each entry can pin its own login domain or omit it for automatic probing. The check-in API body token is derived from the active request hostname (for example, `glados.rocks` for requests to `glados.rocks`).

#### 1. Fork or use this repository

1. [Fork](https://github.com/Walvez/glados-auto-checkin/fork) the repo, or configure Secrets on a repo you control.
2. Open **Settings → Secrets and variables → Actions**.
3. Create a Repository Secret:

| Secret name | Required | Description |
| :--- | :---: | :--- |
| `GLADOS_COOKIE` | Yes | One or more account cookies (formats below) |

#### 2. Obtain the cookie

1. Sign in to GLaDOS in a browser (preferred site today: [glados.cloud](https://glados.cloud); the other five main domains also work).
2. Open DevTools → Application / Storage → Cookies, or a cookie editor extension.
3. Copy the session cookie string, typically:

   ```text
   koa:sess=...; koa:sess.sig=...
   ```

4. Paste it into Secret `GLADOS_COOKIE`. **Do not** commit it to git or post it in issues.

#### 3. Multi-account formats (robust)

**Do not use `&` as an account separator** (cookie values may contain `&`). Prefer one of:

**JSON array (recommended)**

```json
["koa:sess=account1...; koa:sess.sig=...", "koa:sess=account2...; koa:sess.sig=..."]
```

Or with labels and the domain used by each account (recommended when different domains hold different accounts):

```json
[
  {"name": "primary", "origin": "https://glados.cloud", "cookie": "koa:sess=...; koa:sess.sig=..."},
  {"name": "secondary", "origin": "https://glados.rocks", "cookie": "koa:sess=...; koa:sess.sig=..."}
]
```

`origin` is optional. When present, that account's credentials are sent only to the selected supported GLaDOS domain. Without it, the CLI probes all six supported domains in its normal order.

**One full cookie per line**

```text
koa:sess=account1...; koa:sess.sig=...
koa:sess=account2...; koa:sess.sig=...
```

Empty secrets, comment-only input, and invalid JSON fail fast with exit code `1`. Logs redact cookie material.

#### 4. Enable and verify

1. Open **Actions** → **GLaDOS Check-in**.
2. Enable workflows if GitHub prompts you.
3. Click **Run workflow** once and confirm a green success.
4. Default schedule (GitHub `schedule` is **UTC**):

| Cron (UTC) | Beijing time (UTC+8) | Role |
| :--- | :--- | :--- |
| `15 23 * * *` | **07:15** | Morning candidate |
| `15 7 * * *` | **15:15** | Afternoon fallback |

Within **one run**, an account that already succeeded or was already checked in is not checked in again. Across the two daily schedules, a second run that receives “already checked in” still exits `0`.

> [!WARNING]
> GitHub may delay or skip `schedule` on new or inactive forks. `workflow_dispatch` always works. For more reliable timing, an external cron can call the [workflow_dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).

#### 5. Local / CLI (optional)

Requires Node.js 18+ (Actions pins current LTS major **24**):

```bash
export GLADOS_COOKIE='koa:sess=...; koa:sess.sig=...'
npm run checkin
# or: node cli/checkin.js
```

Optional: `GLADOS_ORIGIN=https://glados.cloud` supplies a default domain for entries without `origin`; a per-account `origin` takes priority.

#### 6. Notifications

Actions **does not** embed third-party push services (no extra secrets or data egress). Rely on:

- Job success/failure status (any account failure → exit code `1`, red job)
- Your GitHub notification settings for Actions

If you add push yourself, keep it optional, minimize payload fields, and add tests.

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

- ScriptCat scans all 6 main-site domains (`glados.network` → `glados.rocks` → `glados.one` → `glados.space` → `glados.cloud` → `glados.vip`), collects active sessions, deduplicates them by email, and checks each account in on its original domain before sending one summary notification.
- Surge and Quantumult X capture credentials and the active origin from any of those main sites via MitM, and always send check-in requests to that same domain. Both remain single-account methods: newly captured credentials replace the previous account. They run at `07:15` and `15:15` by default.
- GitHub Actions / CLI use the cookie secret. An account object with `origin` uses only that domain; entries without one probe all 6 domains with `glados.cloud` first. Each account checks in on its own logged-in origin, and the body token always matches the actual request hostname.
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
> Do not publish proxy configuration files, logs, Actions log screenshots, or Secret values. They may contain authentication credentials.

- ScriptCat uses your existing browser session and does not explicitly read, store, or upload your GLaDOS cookies.
- Surge and Quantumult X store the cookie, authorization value, and active domain only in the proxy app's local persistent storage, and send them only to the corresponding official GLaDOS main-site domain (one of the 6 listed above).
- Surge and Quantumult X do not call third-party notification services.
- When explicitly enabled, ScriptCat remote notifications contain only a masked email, check-in result, points, and remaining days. They never include GLaDOS cookies or authorization values.
- **GitHub Actions**: cookies live only in Repository Secret `GLADOS_COOKIE`; workflow permissions are minimal (`contents: read`); the CLI redacts cookies/Bearer tokens and the workflow never echoes the Secret. After forking, set Secrets on **your** repository—never put cookies in code or pull requests.
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

Local options: credentials stay in the browser or proxy app and are sent only to the matching official GLaDOS domain.

GitHub Actions: credentials stay in your repository Secret and are sent only to official GLaDOS domains at runtime—they are not committed to git. See [Security and Privacy](#security-and-privacy).

</details>

<details>
<summary><strong>GitHub Actions keeps failing / asks me to sign in</strong></summary>

The cookie may have expired (often after several weeks) or been copied incompletely. Sign in again at [glados.cloud](https://glados.cloud) (or another main site), update Secret `GLADOS_COOKIE`, and **Run workflow** manually. Cookies usually do not work across domains; the CLI probes all 6.

</details>

<details>
<summary><strong>I see “please checkin via ...”</strong></summary>

This usually means the check-in body token does not match the current request hostname. The official GLaDOS client sends a domain-specific token—for example, `glados.network` on `glados.network` and `glados.rocks` on `glados.rocks`. Every script in this repository now derives the token from the actual origin.

</details>

<details>
<summary><strong>The Actions schedule never runs</strong></summary>

GitHub may not fire `schedule` on new or inactive forks. Use **Run workflow** to validate, or trigger `workflow_dispatch` from an external cron. Workflow comments and the table above document UTC vs Beijing time.

</details>

## Development and Testing

Node.js 18+ is required. After cloning the repository, run:

```bash
npm test
```

Tests cover ScriptCat cross-domain multi-account discovery, same-account deduplication and partial-failure isolation, all 6 main-site domains, single-account Surge and Quantumult X runtimes, GitHub Actions / CLI (multi-account, per-account origin, missing secrets, domain fallback, cookie redaction, success / already-checked / failure exit codes), invalid JSON, 401/403 handling, 429 retries, 5xx handling, config hostname/regex coverage, stable update URLs, and notification boundaries.

### Project Structure

```text
.
├── glados.auto-checkin.scriptcat.user.js  # ScriptCat browser script
├── glados.autosign.surge.js               # Shared Surge / Quantumult X script
├── lib/glados-core.js                     # Shared validation and credential parsing
├── cli/checkin.js                         # Node.js CLI / Actions entry
├── .github/workflows/
│   ├── checkin.yml                        # Scheduled + manual check-in
│   └── test.yml                           # Push / PR tests
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
