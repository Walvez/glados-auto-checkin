// ==UserScript==
// @name         GLaDOS自动签到
// @namespace    https://github.com/Walvez/glados-auto-checkin
// @version      1.5.8
// @description  在脚本猫后台为不同主站域名中的账号逐一签到；无需复制 Cookie，也无需保持网页打开。
// @author       Walvez
// @icon         https://glados.network/favicon.ico
// @crontab      5-55/5 * once * *
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_log
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      glados.network
// @connect      glados.rocks
// @connect      glados.one
// @connect      glados.space
// @connect      glados.cloud
// @connect      glados.vip
// @connect      glados-facility.com
// @connect      api2.pushdeer.com
// @connect      sctapi.ftqq.com
// @connect      api.telegram.org
// @connect      qyapi.weixin.qq.com
// @connect      oapi.dingtalk.com
// @connect      open.feishu.cn
// @connect      push.i-i.me
// @connect      api.day.app
// @license      MIT
// @tag          GLaDOS
// @tag          自动签到
// @tag          定时脚本
// @tag          后台脚本
// @homepage     https://github.com/Walvez/glados-auto-checkin
// @supportURL   https://github.com/Walvez/glados-auto-checkin/issues
// ==/UserScript==

const GLADOS_ORIGINS = [
  "https://glados.network",
  "https://glados.rocks",
  "https://glados.one",
  "https://glados.space",
  "https://glados.cloud",
  "https://glados.vip",
  "https://glados-facility.com",
];
const LOGIN_URL = "https://glados.network/login";
const REQUEST_TIMEOUT = 15000;
const MAX_REQUEST_ATTEMPTS = 2;
const RETRY_DELAY = 2000;
const NOTIFY_KEYS = {
  pushdeer: "glados_notify_pushdeer",
  serverchan: "glados_notify_serverchan",
  telegramBot: "glados_notify_telegram_bot",
  telegramChat: "glados_notify_telegram_chat",
  wecom: "glados_notify_wecom",
  dingtalk: "glados_notify_dingtalk",
  feishu: "glados_notify_feishu",
  pushme: "glados_notify_pushme",
  bark: "glados_notify_bark",
};

function log(message, level = "info") {
  GM_log(`[GLaDOS] ${message}`, level);
}

function parseResponse(response) {
  if (response.response && typeof response.response === "object") {
    return response.response;
  }

  const raw = response.responseText || response.response || "";
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("GLaDOS 返回了无法解析的数据");
  }
}

function request(options) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      ...options,
      timeout: REQUEST_TIMEOUT,
      responseType: "json",
      anonymous: false,
      onload(response) {
        if (response.status < 200 || response.status >= 300) {
          const status = Number(response.status) || 0;
          let message = `请求失败（HTTP ${status || "未知"}）`;
          if (status === 401 || status === 403) {
            message = "登录凭据已失效";
          } else if (status === 429) {
            message = "请求过于频繁（HTTP 429）";
          } else if (status >= 500) {
            message = `GLaDOS 服务暂时异常（HTTP ${status}）`;
          }
          const error = new Error(message);
          error.status = response.status;
          reject(error);
          return;
        }

        try {
          resolve(parseResponse(response));
        } catch (error) {
          reject(error);
        }
      },
      onerror: () => reject(new Error("网络请求失败")),
      ontimeout: () => reject(new Error("网络请求超时")),
      onabort: () => reject(new Error("网络请求被终止")),
    });
  });
}

function remoteRequest(options) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      ...options,
      timeout: REQUEST_TIMEOUT,
      anonymous: true,
      onload(response) {
        if (response.status >= 200 && response.status < 300) {
          resolve();
        } else {
          reject(new Error(`通知接口返回 HTTP ${response.status}`));
        }
      },
      onerror: () => reject(new Error("通知网络请求失败")),
      ontimeout: () => reject(new Error("通知网络请求超时")),
      onabort: () => reject(new Error("通知网络请求被终止")),
    });
  });
}

async function storedValue(key) {
  if (typeof GM_getValue !== "function") return "";
  return String((await GM_getValue(key, "")) || "").trim();
}

function queryCredential(value, parameter) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return text;
  try {
    return new URL(text).searchParams.get(parameter) || "";
  } catch (error) {
    return "";
  }
}

function pathCredential(value, marker) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return text;
  try {
    const pathname = new URL(text).pathname;
    const index = pathname.indexOf(marker);
    return index >= 0 ? decodeURIComponent(pathname.slice(index + marker.length).split("/")[0] || "") : "";
  } catch (error) {
    return "";
  }
}

async function sendRemoteNotifications(title, content) {
  if (typeof GM_getValue !== "function") return;

  const [
    pushdeer,
    serverchan,
    telegramBot,
    telegramChat,
    wecomInput,
    dingtalkInput,
    feishuInput,
    pushmeInput,
    barkInput,
  ] = await Promise.all([
    storedValue(NOTIFY_KEYS.pushdeer),
    storedValue(NOTIFY_KEYS.serverchan),
    storedValue(NOTIFY_KEYS.telegramBot),
    storedValue(NOTIFY_KEYS.telegramChat),
    storedValue(NOTIFY_KEYS.wecom),
    storedValue(NOTIFY_KEYS.dingtalk),
    storedValue(NOTIFY_KEYS.feishu),
    storedValue(NOTIFY_KEYS.pushme),
    storedValue(NOTIFY_KEYS.bark),
  ]);
  const wecom = queryCredential(wecomInput, "key");
  const dingtalk = queryCredential(dingtalkInput, "access_token");
  const feishu = pathCredential(feishuInput, "/open-apis/bot/v2/hook/");
  const pushme = queryCredential(pushmeInput, "push_key");
  const bark = pathCredential(barkInput, "/");
  const jobs = [];

  if (pushdeer) {
    jobs.push({
      name: "PushDeer",
      request: remoteRequest({
        method: "POST",
        url: "https://api2.pushdeer.com/message/push",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ pushkey: pushdeer, text: `${title}\n\n${content}`, type: "text" }),
      }),
    });
  }

  if (serverchan) {
    jobs.push({
      name: "Server酱",
      request: remoteRequest({
        method: "POST",
        url: `https://sctapi.ftqq.com/${encodeURIComponent(serverchan)}.send`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: `title=${encodeURIComponent(title)}&desp=${encodeURIComponent(content)}`,
      }),
    });
  }

  if (telegramBot && telegramChat) {
    jobs.push({
      name: "Telegram",
      request: remoteRequest({
        method: "POST",
        url: `https://api.telegram.org/bot${encodeURIComponent(telegramBot)}/sendMessage`,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify({ chat_id: telegramChat, text: `${title}\n\n${content}`.slice(0, 4000) }),
      }),
    });
  }

  if (wecom) {
    jobs.push({
      name: "企业微信",
      request: remoteRequest({
        method: "POST",
        url: `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(wecom)}`,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        data: JSON.stringify({ msgtype: "text", text: { content: `${title}\n${content}` } }),
      }),
    });
  }

  if (dingtalk) {
    jobs.push({
      name: "钉钉",
      request: remoteRequest({
        method: "POST",
        url: `https://oapi.dingtalk.com/robot/send?access_token=${encodeURIComponent(dingtalk)}`,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        data: JSON.stringify({
          msgtype: "markdown",
          markdown: { title, text: `# ${title}\n\n${content}` },
        }),
      }),
    });
  }

  if (feishu) {
    jobs.push({
      name: "飞书",
      request: remoteRequest({
        method: "POST",
        url: `https://open.feishu.cn/open-apis/bot/v2/hook/${encodeURIComponent(feishu)}`,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        data: JSON.stringify({ msg_type: "text", content: { text: `${title}\n${content}` } }),
      }),
    });
  }

  if (pushme) {
    jobs.push({
      name: "PushMe",
      request: remoteRequest({
        method: "POST",
        url: `https://push.i-i.me/?push_key=${encodeURIComponent(pushme)}`,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        data: JSON.stringify({ type: "markdown", title, content }),
      }),
    });
  }

  if (bark) {
    jobs.push({
      name: "Bark",
      request: remoteRequest({
        method: "POST",
        url: `https://api.day.app/${encodeURIComponent(bark)}`,
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        data: JSON.stringify({
          title,
          body: content,
          group: "GLaDOS",
          icon: "https://glados.network/favicon.ico",
        }),
      }),
    });
  }

  const results = await Promise.allSettled(jobs.map((job) => job.request));
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failed += 1;
      log(`${jobs[index].name} 远程通知发送失败：${result.reason.message}`, "warn");
    }
  });
  return { configured: jobs.length, succeeded: jobs.length - failed, failed };
}

function registerNotificationMenus() {
  if (typeof GM_registerMenuCommand !== "function" || typeof GM_setValue !== "function") return;

  const ask = (message) => (typeof prompt === "function" ? prompt(message, "") : null);
  GM_registerMenuCommand("立即手动签到", async () => {
    try {
      await run();
    } catch (error) {
      await handleRunError(error, false, true);
    }
  });
  GM_registerMenuCommand("查看当前登录账号", async () => {
    await notifyCurrentAccounts();
  });
  GM_registerMenuCommand("配置 PushDeer 通知", async () => {
    const value = ask("输入 PushDeer PushKey；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.pushdeer, value.trim());
  });
  GM_registerMenuCommand("配置 Server酱通知", async () => {
    const value = ask("输入 Server酱 SendKey；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.serverchan, value.trim());
  });
  GM_registerMenuCommand("配置 Telegram 通知", async () => {
    const bot = ask("输入 Telegram Bot Token；留空并确定可关闭该通知：");
    if (bot === null) return;
    const chat = bot.trim() ? ask("输入 Telegram Chat ID：") : "";
    if (chat === null) return;
    await GM_setValue(NOTIFY_KEYS.telegramBot, bot.trim());
    await GM_setValue(NOTIFY_KEYS.telegramChat, chat.trim());
  });
  GM_registerMenuCommand("配置企业微信通知", async () => {
    const value = ask("输入企业微信群机器人 Webhook Key 或完整 Webhook URL；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.wecom, value.trim());
  });
  GM_registerMenuCommand("配置钉钉通知", async () => {
    const value = ask("输入钉钉群机器人 Access Token 或完整 Webhook URL；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.dingtalk, value.trim());
  });
  GM_registerMenuCommand("配置飞书通知", async () => {
    const value = ask("输入飞书群机器人 Webhook Key 或完整 Webhook URL；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.feishu, value.trim());
  });
  GM_registerMenuCommand("配置 PushMe 通知", async () => {
    const value = ask("输入 PushMe Key；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.pushme, value.trim());
  });
  GM_registerMenuCommand("配置 Bark 通知", async () => {
    const value = ask("输入 Bark Key 或完整推送 URL；留空并确定可关闭该通知：");
    if (value !== null) await GM_setValue(NOTIFY_KEYS.bark, value.trim());
  });
  GM_registerMenuCommand("测试远程通知", async () => {
    const result = await sendRemoteNotifications(
      "GLaDOS 通知测试",
      "配置成功后，你会在已启用的远程通知渠道收到这条消息。"
    );
    const text = result.configured === 0
      ? "尚未配置远程通知渠道。"
      : `已发送 ${result.configured} 个渠道：成功 ${result.succeeded} 个，失败 ${result.failed} 个。`;
    GM_notification({ title: "GLaDOS 通知测试", text });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestWithRetry(options) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      return await request(options);
    } catch (error) {
      lastError = error;
      const retryable = !error.status || error.status === 429 || error.status >= 500;
      if (!retryable || attempt === MAX_REQUEST_ATTEMPTS) {
        break;
      }
      log(`${error.message}，${RETRY_DELAY / 1000} 秒后重试`, "warn");
      await delay(RETRY_DELAY);
    }
  }

  throw lastError;
}

function formatPoints(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function maskEmail(email) {
  const text = String(email || "");
  const separator = text.lastIndexOf("@");
  if (separator <= 0) {
    return text || "未知账户";
  }

  const name = text.slice(0, separator);
  const domain = text.slice(separator + 1);
  const maskedName = name.length <= 2 ? "***" : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

function maskEmailCompact(email) {
  const text = String(email || "");
  const separator = text.lastIndexOf("@");
  if (separator <= 0) return text || "未知账户";

  const name = text.slice(0, separator);
  const domain = text.slice(separator + 1);
  const maskedName = name.length <= 2 ? "**" : `${name.slice(0, 2)}**${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

async function notifyCurrentAccounts() {
  const accounts = [];
  const failures = [];

  for (const origin of GLADOS_ORIGINS) {
    try {
      const status = await requestWithRetry({
        method: "GET",
        url: `${origin}/api/user/status`,
        headers: {
          Accept: "application/json, text/plain, */*",
          Referer: `${origin}/console`,
        },
      });
      if (status.code === 0 && status.data) {
        accounts.push({
          domain: new URL(origin).hostname,
          account: maskEmail(status.data.email),
        });
      }
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) {
        failures.push(`${new URL(origin).hostname}：${error.message}`);
      }
      log(`${origin} 当前账号查询失败：${error.message}`, "warn");
    }
  }

  const lines = accounts.map(({ domain, account }) => `${domain}：${account}`);
  let title = "GLaDOS 当前登录账号";
  let text;

  if (accounts.length > 0) {
    text = [`已发现 ${accounts.length} 个已登录域名`, ...lines].join("\n");
    if (failures.length > 0) {
      text += `\n另有 ${failures.length} 个域名查询失败`;
    }
  } else if (failures.length > 0) {
    title = "GLaDOS 登录状态查询失败";
    text = failures.join("\n");
  } else {
    title = "GLaDOS 未发现登录账号";
    text = "6 个主站域名均未发现已登录账号，请先登录 GLaDOS。";
  }

  GM_notification({ title, text });
  return { accounts, failures };
}

function isLoginError(result) {
  const message = String(result && result.message ? result.message : "").toLowerCase();
  const code = Number(result && result.code);
  return (
    !result ||
    code === -2 ||
    message.includes("token error") ||
    message.includes("not login") ||
    message.includes("not logged") ||
    message.includes("未登录")
  );
}

function notifyLogin(message) {
  GM_notification({
    title: "GLaDOS 需要重新登录",
    text: `${message}\n点击通知打开登录页。`,
    onclick: () => GM_openInTab(LOGIN_URL, true),
  });
}

function isAlreadyCheckedIn(result) {
  const message = String(result && result.message ? result.message : "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const code = Number(result && result.code);

  return (
    code === 1 ||
    message.includes("please try tomorrow") ||
    message.includes("today's observation logged") ||
    message.includes("return tomorrow") ||
    message.includes("already check") ||
    message.includes("今日已签到") ||
    message.includes("已经签到") ||
    message.includes("明天再试")
  );
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findCheckinRecord(result) {
  const records = Array.isArray(result && result.list)
    ? result.list.filter((record) => record && typeof record === "object")
    : [];
  const checkinRecords = records.filter((record) => record.business === "system:checkin");

  if (checkinRecords.length > 0) {
    return checkinRecords.find((record) => record.detail === localDateKey()) || checkinRecords[0];
  }

  // Older responses did not always include `business`. Keep that format
  // compatible, but never mistake a typed exchange/collect record for check-in.
  return records.some((record) => record.business) ? undefined : records[0];
}

function classifyCheckin(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("GLaDOS 返回的签到数据无效");
  }

  const record = findCheckinRecord(result);

  if (isLoginError(result)) {
    return { kind: "login_expired", message: result.message || "登录状态已失效" };
  }

  if (isAlreadyCheckedIn(result)) {
    const earned = record && record.change !== undefined
      ? `今日签到获得${formatPoints(record.change)}积分`
      : "";
    const total = record && record.balance !== undefined
      ? `当前共${formatPoints(record.balance)}积分`
      : "";
    const pointsText = [earned, total].filter(Boolean).join("，");
    return {
      kind: "already_checked",
      message: `今日已签到。${pointsText ? `\n${pointsText}` : ""}`,
      earnedPoints: record && record.change !== undefined ? formatPoints(record.change) : undefined,
      totalPoints: record && record.balance !== undefined ? formatPoints(record.balance) : undefined,
    };
  }

  if (record && record.change !== undefined) {
    const total = record.balance !== undefined ? `，共${formatPoints(record.balance)}积分` : "";
    return {
      kind: "success",
      message: `签到成功！\n今日签到获得${formatPoints(record.change)}积分${total}`,
      earnedPoints: formatPoints(record.change),
      totalPoints: record.balance !== undefined ? formatPoints(record.balance) : undefined,
    };
  }

  const code = Number(result.code);
  const detail = String(result.message || "").trim();
  if (code === 0 && /(?:success|成功)/i.test(detail)) {
    return { kind: "success", message: `签到成功！${detail ? `\n${detail}` : ""}` };
  }

  throw new Error(`签到接口返回异常${detail ? `：${detail}` : ""}`);
}

async function findLoggedInSessions() {
  const sessions = [];
  const seenAccounts = new Set();
  const probeErrors = [];
  let lastError;
  let authorizationError;
  let loginMessage = "";

  for (const origin of GLADOS_ORIGINS) {
    try {
      const status = await requestWithRetry({
        method: "GET",
        url: `${origin}/api/user/status`,
        headers: {
          Accept: "application/json, text/plain, */*",
          Referer: `${origin}/console`,
        },
      });

      if (status.code === 0 && status.data) {
        const email = String(status.data.email || "").trim().toLowerCase();
        const accountKey = email || origin;
        if (!seenAccounts.has(accountKey)) {
          seenAccounts.add(accountKey);
          sessions.push({ origin, status });
        } else {
          log(`${origin} 与已发现会话属于同一账号，跳过重复签到`);
        }
        continue;
      }

      loginMessage = status.message || loginMessage;
    } catch (error) {
      lastError = error;
      if (error.status === 401 || error.status === 403) {
        authorizationError = error;
      } else {
        probeErrors.push({ origin, error });
      }
      log(`${origin} 登录状态检查失败：${error.message}`, "warn");
    }
  }

  if (sessions.length > 0) {
    return { sessions, probeErrors };
  }

  if (authorizationError && !loginMessage) {
    const reason = authorizationError.message || "登录凭据已失效";
    notifyLogin(reason);
    throw new Error(`需要登录：${reason}`);
  }

  if (lastError && !loginMessage) {
    throw lastError;
  }

  const reason = loginMessage || "所有 GLaDOS 主站域名均未读取到登录状态";
  notifyLogin(reason);
  throw new Error(`需要登录：${reason}`);
}

async function checkinSession({ origin, status }) {
  const account = maskEmail(status.data.email);
  const compactAccount = maskEmailCompact(status.data.email);
  log(`${account} 使用已登录域名：${origin}`);
  const result = await requestWithRetry({
    method: "POST",
    url: `${origin}/api/user/checkin`,
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: origin,
      Referer: `${origin}/console/checkin`,
      "Content-Type": "application/json;charset=UTF-8",
    },
    data: JSON.stringify({ token: origin.slice("https://".length) }),
  });

  const checkin = classifyCheckin(result);
  if (checkin.kind === "login_expired") {
    throw new Error(`需要登录：${checkin.message}`);
  }

  const remaining = Number.parseInt(status.data.leftDays, 10);
  const remainingText = Number.isFinite(remaining) ? `\n剩余${remaining}天` : "";
  const message = checkin.message;

  log(`${account}：${message}${remainingText.replace("\n", "，")}`);
  return {
    account,
    compactAccount,
    kind: checkin.kind,
    message,
    earnedPoints: checkin.earnedPoints,
    totalPoints: checkin.totalPoints,
    remainingDays: Number.isFinite(remaining) ? remaining : undefined,
    remainingText,
    origin,
  };
}

function resultLine(result) {
  const domain = new URL(result.origin).hostname.replace(/^glados/, "");
  const status = result.kind === "success" ? "✅" : "已签";
  const earned = result.earnedPoints === undefined ? "+?" : `+${result.earnedPoints}`;
  const total = result.totalPoints === undefined ? "?积分" : `${result.totalPoints}积分`;
  const days = result.remainingDays === undefined ? "?天" : `${result.remainingDays}天`;
  return `${domain}: ${result.compactAccount}, ${status}, ${earned}; ${total}, ${days}.`;
}

async function run() {
  log("开始检查全部主站域名的登录状态");

  const { sessions, probeErrors } = await findLoggedInSessions();
  const results = [];
  const failures = [];

  for (const session of sessions) {
    try {
      results.push(await checkinSession(session));
    } catch (error) {
      const account = maskEmail(session.status && session.status.data && session.status.data.email);
      failures.push({ account, origin: session.origin, error });
      log(`${account} 签到失败：${error.message}`, "error");
    }
  }

  if (sessions.length === 1 && failures.length === 0 && probeErrors.length === 0) {
    const [result] = results;
    const text = resultLine(result);
    GM_notification({
      title: "GLaDOS 签到结果",
      text,
    });
    await sendRemoteNotifications(`GLaDOS · ${result.account}`, text);
    return `${result.account}：${result.message}`;
  }

  const lines = results.map(resultLine);
  failures.forEach(({ account, error }) => lines.push(`${account}：失败：${error.message}`));
  probeErrors.forEach(({ origin, error }) => {
    lines.push(`${origin.slice("https://".length)}：登录状态检查失败：${error.message}`);
  });

  const issueCount = failures.length + probeErrors.length;
  const title = sessions.length === 1 && failures.length === 1 && probeErrors.length === 0
    ? "GLaDOS 签到失败"
    : issueCount > 0
      ? "GLaDOS 多账号签到未全部完成"
      : "GLaDOS 多账号签到完成";
  const summary = [
    ...lines,
  ].join("\n");

  GM_notification({
    title,
    text: summary,
    onclick: failures.some(({ error }) => String(error.message).startsWith("需要登录："))
      ? () => GM_openInTab(LOGIN_URL, true)
      : undefined,
  });
  await sendRemoteNotifications(title, summary);

  if (issueCount > 0) {
    const details = [
      ...failures.map(({ account, error }) => `${account}：${error.message}`),
      ...probeErrors.map(({ origin, error }) => `${origin}：${error.message}`),
    ].join("；");
    const error = new Error(`多账号签到未全部完成：${issueCount} 项异常${details ? `；${details}` : ""}`);
    error.alreadyNotified = true;
    throw error;
  }

  return summary;
}

async function handleRunError(error, rethrow, manual = false) {
  log(error.message || String(error), "error");
  const errorText = error.message || String(error);
  if (!error.alreadyNotified && !String(error.message || error).startsWith("需要登录：")) {
    GM_notification({
      title: "GLaDOS 签到失败",
      text: `${errorText}\n${manual ? "请确认网络与登录状态后重试。" : "脚本会在下一个候选时间自动再试。"}`,
    });
  }
  if (!error.alreadyNotified) {
    await sendRemoteNotifications("GLaDOS 签到失败", errorText);
  }
  if (rethrow) throw error;
}

registerNotificationMenus();

return run().catch(async (error) => {
  await handleRunError(error, true);
});
