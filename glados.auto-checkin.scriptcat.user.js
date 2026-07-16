// ==UserScript==
// @name         GLaDOS 自动签到（脚本猫）
// @namespace    https://github.com/Walvez/glados-auto-checkin
// @version      1.1.0
// @description  在脚本猫后台定时签到，通知展示账号、积分与剩余天数；无需复制 Cookie，也无需保持网页打开。
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
// @connect      api2.pushdeer.com
// @connect      sctapi.ftqq.com
// @connect      api.telegram.org
// @license      MIT
// @tag          GLaDOS
// @tag          自动签到
// @tag          定时脚本
// @tag          后台脚本
// @homepageURL  https://github.com/Walvez/glados-auto-checkin
// @supportURL   https://github.com/Walvez/glados-auto-checkin/issues
// ==/UserScript==

const GLADOS_ORIGINS = ["https://glados.network", "https://glados.rocks"];
const LOGIN_URL = "https://glados.network/login";
const REQUEST_TIMEOUT = 15000;
const MAX_REQUEST_ATTEMPTS = 2;
const RETRY_DELAY = 2000;
const NOTIFY_KEYS = {
  pushdeer: "glados_notify_pushdeer",
  serverchan: "glados_notify_serverchan",
  telegramBot: "glados_notify_telegram_bot",
  telegramChat: "glados_notify_telegram_chat",
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

async function sendRemoteNotifications(title, content) {
  if (typeof GM_getValue !== "function") return;

  const [pushdeer, serverchan, telegramBot, telegramChat] = await Promise.all([
    storedValue(NOTIFY_KEYS.pushdeer),
    storedValue(NOTIFY_KEYS.serverchan),
    storedValue(NOTIFY_KEYS.telegramBot),
    storedValue(NOTIFY_KEYS.telegramChat),
  ]);
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

  const results = await Promise.allSettled(jobs.map((job) => job.request));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      log(`${jobs[index].name} 远程通知发送失败：${result.reason.message}`, "warn");
    }
  });
}

function registerNotificationMenus() {
  if (typeof GM_registerMenuCommand !== "function" || typeof GM_setValue !== "function") return;

  const ask = (message) => (typeof prompt === "function" ? prompt(message, "") : null);
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
    timeout: 15000,
    onclick: () => GM_openInTab(LOGIN_URL, true),
  });
}

function isAlreadyCheckedIn(result) {
  const message = String(result && result.message ? result.message : "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const code = Number(result && result.code);
  const points = Number(result && result.points);

  return (
    (code === 1 && Number.isFinite(points) && points === 0) ||
    message.includes("please try tomorrow") ||
    message.includes("today's observation logged") ||
    message.includes("return tomorrow") ||
    message.includes("already check") ||
    message.includes("今日已签到") ||
    message.includes("已经签到") ||
    message.includes("明天再试")
  );
}

function classifyCheckin(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("GLaDOS 返回的签到数据无效");
  }

  const record = result.list && result.list[0];

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
    };
  }

  if (record && record.change !== undefined) {
    const total = record.balance !== undefined ? `，共${formatPoints(record.balance)}积分` : "";
    return {
      kind: "success",
      message: `签到成功！\n今日签到获得${formatPoints(record.change)}积分${total}`,
    };
  }

  const code = Number(result.code);
  const detail = String(result.message || "").trim();
  if (code === 0 && /(?:success|成功)/i.test(detail)) {
    return { kind: "success", message: `签到成功！${detail ? `\n${detail}` : ""}` };
  }

  throw new Error(`签到接口返回异常${detail ? `：${detail}` : ""}`);
}

async function findLoggedInSession() {
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
        },
      });

      if (status.code === 0 && status.data) {
        return { origin, status };
      }

      loginMessage = status.message || loginMessage;
    } catch (error) {
      lastError = error;
      if (error.status === 401 || error.status === 403) {
        authorizationError = error;
      }
      log(`${origin} 登录状态检查失败：${error.message}`, "warn");
    }
  }

  if (authorizationError && !loginMessage) {
    const reason = authorizationError.message || "登录凭据已失效";
    notifyLogin(reason);
    throw new Error(`需要登录：${reason}`);
  }

  if (lastError && !loginMessage) {
    throw lastError;
  }

  const reason = loginMessage || "两个 GLaDOS 域名均未读取到登录状态";
  notifyLogin(reason);
  throw new Error(`需要登录：${reason}`);
}

async function run() {
  log("开始检查登录状态");

  const { origin, status } = await findLoggedInSession();
  log(`使用已登录域名：${origin}`);

  const result = await requestWithRetry({
    method: "POST",
    url: `${origin}/api/user/checkin`,
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: origin,
      "Content-Type": "application/json;charset=UTF-8",
    },
    data: JSON.stringify({ token: "glados.one" }),
  });

  const checkin = classifyCheckin(result);
  if (checkin.kind === "login_expired") {
    const reason = checkin.message;
    notifyLogin(reason);
    throw new Error(`需要登录：${reason}`);
  }

  const account = maskEmail(status.data.email);
  const remaining = Number.parseInt(status.data.leftDays, 10);
  const remainingText = Number.isFinite(remaining) ? `\n剩余${remaining}天` : "";
  const message = checkin.message;

  GM_notification({
    title: `GLaDOS · ${account}`,
    text: `${message}${remainingText}`,
    timeout: 10000,
  });
  log(`${account}：${message}${remainingText.replace("\n", "，")}`);
  await sendRemoteNotifications(`GLaDOS · ${account}`, `${message}${remainingText}`);

  return `${account}：${message}`;
}

registerNotificationMenus();

return run().catch(async (error) => {
  log(error.message || String(error), "error");
  const errorText = error.message || String(error);
  if (!String(error.message || error).startsWith("需要登录：")) {
    GM_notification({
      title: "GLaDOS 签到失败",
      text: `${errorText}\n脚本会在下一个候选时间自动再试。`,
      timeout: 10000,
    });
  }
  await sendRemoteNotifications("GLaDOS 签到失败", errorText);
  throw error;
});
