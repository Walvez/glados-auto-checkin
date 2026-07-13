// ==UserScript==
// @name         GLaDOS 自动签到（脚本猫）
// @namespace    https://github.com/Walvez/glados-auto-checkin
// @version      1.0.4
// @description  在脚本猫后台定时签到，通知展示账号、积分与剩余天数；无需复制 Cookie，也无需保持网页打开。
// @author       Walvez
// @icon         https://glados.network/favicon.ico
// @crontab      5-55/5 * once * *
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_log
// @connect      glados.network
// @connect      glados.rocks
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
          const error = new Error(`请求失败（HTTP ${response.status}）`);
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestWithRetry(options) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await request(options);
    } catch (error) {
      lastError = error;
      if ((error.status && error.status < 500) || attempt === 2) {
        break;
      }
      log(`${error.message}，2 秒后重试`, "warn");
      await delay(2000);
    }
  }

  throw lastError;
}

function formatPoints(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function isLoginError(result) {
  const message = String(result && result.message ? result.message : "").toLowerCase();
  return (
    !result ||
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

function checkinMessage(result) {
  const record = result.list && result.list[0];

  if (isAlreadyCheckedIn(result)) {
    const earned = record && record.change !== undefined
      ? `今日签到获得${formatPoints(record.change)}积分`
      : "";
    const total = record && record.balance !== undefined
      ? `当前共${formatPoints(record.balance)}积分`
      : "";
    const pointsText = [earned, total].filter(Boolean).join("，");
    return `今日已签到。${pointsText ? `\n${pointsText}` : ""}`;
  }

  if (record && record.change !== undefined) {
    const total = record.balance !== undefined ? `，共${formatPoints(record.balance)}积分` : "";
    return `签到成功！\n今日签到获得${formatPoints(record.change)}积分${total}`;
  }

  const detail = result.message ? `\n${result.message}` : "";
  return `签到成功！${detail}`;
}

async function findLoggedInSession() {
  let lastError;
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
      log(`${origin} 登录状态检查失败：${error.message}`, "warn");
    }
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

  if (isLoginError(result)) {
    const reason = result && result.message ? result.message : "登录状态已失效";
    notifyLogin(reason);
    throw new Error(`需要登录：${reason}`);
  }

  const account = status.data.email || "未知账户";
  const remaining = Number.parseInt(status.data.leftDays, 10);
  const remainingText = Number.isFinite(remaining) ? `\n剩余${remaining}天` : "";
  const message = checkinMessage(result);

  GM_notification({
    title: `GLaDOS · ${account}`,
    text: `${message}${remainingText}`,
    timeout: 10000,
  });
  log(`${account}：${message}${remainingText.replace("\n", "，")}`);

  return `${account}：${message}`;
}

return run().catch((error) => {
  log(error.message || String(error), "error");
  if (!String(error.message || error).startsWith("需要登录：")) {
    GM_notification({
      title: "GLaDOS 签到失败",
      text: `${error.message || error}\n脚本会在下一个候选时间自动再试。`,
      timeout: 10000,
    });
  }
  throw error;
});
