const COOKIE_KEY = "evil_gladoscookie";
const AUTH_KEY = "evil_galdosauthorization";
const ORIGIN_KEY = "evil_gladosorigin";
const LAST_SUCCESS_KEY = "glados_last_success_date";
const DEFAULT_ORIGIN = "https://glados.rocks";
const SUPPORTED_ORIGINS = [
  "https://glados.network",
  "https://glados.rocks",
  "https://glados.one",
  "https://glados.space",
  "https://glados.cloud",
  "https://glados.vip",
];
const ORIGIN_HOST_RE = /^https:\/\/glados\.(network|rocks|one|space|cloud|vip)(?:\/|$)/i;
const SCRIPT_VERSION = "reliability-20260718-dynamic-token";
const MAX_REQUEST_ATTEMPTS = 2;
const RETRY_DELAY = 1500;

let finished = false;

function done(value) {
  if (!finished) {
    finished = true;
    $done(value);
  }
}

function notify(subtitle, body) {
  if (typeof $notification !== "undefined") {
    $notification.post("GLaDOS", subtitle || "", body || "");
  } else {
    $notify("GLaDOS", subtitle || "", body || "");
  }
}

function readStore(key) {
  return typeof $persistentStore !== "undefined" ? $persistentStore.read(key) : $prefs.valueForKey(key);
}

function writeStore(value, key) {
  return typeof $persistentStore !== "undefined"
    ? $persistentStore.write(value, key)
    : $prefs.setValueForKey(value, key);
}

function rawRequest(method, options, callback) {
  if (typeof $httpClient !== "undefined") {
    return $httpClient[method.toLowerCase()](options, callback);
  }

  $task
    .fetch(Object.assign({}, options, { method: method.toUpperCase() }))
    .then((response) => callback(null, response, response.body))
    .catch((error) => callback(error.error || error.message || String(error)));
}

function finishWithNotification(subtitle, body, result) {
  notify(subtitle, body);
  done(result);
}

function responseStatus(response) {
  return Number(response && (response.status || response.statusCode)) || 0;
}

function requestError(message, status) {
  const error = new Error(message);
  error.status = status || 0;
  return error;
}

function normalizeRequestError(error) {
  return error instanceof Error ? error : requestError(String(error || "网络请求失败"), 0);
}

function shouldRetry(error) {
  return !error.status || error.status === 429 || error.status >= 500;
}

function requestWithRetry(method, options, callback, attempt) {
  const currentAttempt = attempt || 1;
  rawRequest(method, options, (rawError, response, body) => {
    let error = rawError ? normalizeRequestError(rawError) : null;
    const status = responseStatus(response);

    if (!error && status && (status < 200 || status >= 300)) {
      if (status === 401 || status === 403) {
        error = requestError("登录凭据已失效", status);
      } else if (status === 429) {
        error = requestError("请求过于频繁（HTTP 429）", status);
      } else if (status >= 500) {
        error = requestError(`GLaDOS 服务暂时异常（HTTP ${status}）`, status);
      } else {
        error = requestError(`请求失败（HTTP ${status}）`, status);
      }
    }

    if (error && currentAttempt < MAX_REQUEST_ATTEMPTS && shouldRetry(error)) {
      return setTimeout(
        () => requestWithRetry(method, options, callback, currentAttempt + 1),
        RETRY_DELAY
      );
    }

    callback(error, response, body);
  });
}

function header(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === target);
  return key ? headers[key] : "";
}

function parseJson(body) {
  try {
    const result = JSON.parse(body || "");
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("响应不是 JSON 对象");
    }
    return result;
  } catch (error) {
    throw new Error("GLaDOS 返回了无法解析的数据");
  }
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

function originFromUrl(url) {
  const match = ORIGIN_HOST_RE.exec(url || "");
  return match ? `https://glados.${match[1].toLowerCase()}` : "";
}

function storedOrigin() {
  const origin = readStore(ORIGIN_KEY);
  return SUPPORTED_ORIGINS.indexOf(origin) !== -1 ? origin : DEFAULT_ORIGIN;
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function saveCookie() {
  if (!$request || $request.method === "OPTIONS") {
    return done();
  }

  const cookie = header($request.headers, "Cookie");
  const authorization = header($request.headers, "Authorization");
  const origin = originFromUrl($request.url);
  const previousCookie = readStore(COOKIE_KEY);
  const previousAuthorization = readStore(AUTH_KEY);

  if (cookie) {
    writeStore(cookie, COOKIE_KEY);
  }
  if (authorization) {
    writeStore(authorization, AUTH_KEY);
  }
  if (origin && (cookie || authorization)) {
    writeStore(origin, ORIGIN_KEY);
  }

  if (cookie && cookie !== previousCookie) {
    notify("", "获取 GLaDOS 登录凭据成功");
  } else if (!cookie && authorization && authorization !== previousAuthorization) {
    notify("", "获取 GLaDOS 登录凭据成功");
  }
  done();
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

function checkStatus(origin, cookie, authorization, checkin) {
  requestWithRetry(
    "GET",
    {
      url: `${origin}/api/user/status`,
      headers: {
        Cookie: cookie || "",
        Authorization: authorization || "",
      },
    },
    (error, response, body) => {
      if (error) {
        return finishWithNotification(
          "",
          `${checkin.message}\n账户状态查询失败，不影响本次签到：${error.message}`,
          { status: "partial_success", version: SCRIPT_VERSION, checkinMessage: checkin.message }
        );
      }

      let status;
      try {
        status = parseJson(body);
      } catch (parseError) {
        return finishWithNotification(
          "",
          `${checkin.message}\n账户状态查询失败，不影响本次签到：${parseError.message}`,
          { status: "partial_success", version: SCRIPT_VERSION, checkinMessage: checkin.message }
        );
      }

      if (status.code !== 0 || !status.data) {
        const detail = status.message ? `：${status.message}` : "";
        return finishWithNotification(
          "",
          `${checkin.message}\n账户状态查询失败，不影响本次签到${detail}`,
          { status: "partial_success", version: SCRIPT_VERSION, checkinMessage: checkin.message }
        );
      }

      const account = maskEmail(status.data.email);
      const remaining = Number.parseInt(status.data.leftDays, 10);
      const remainingText = Number.isFinite(remaining) ? `\n剩余${remaining}天` : "";
      finishWithNotification(
        `账户：${account}`,
        `${checkin.message}${remainingText}`,
        {
          status: checkin.kind === "already_checked" ? "already_checked" : "ok",
          version: SCRIPT_VERSION,
          checkinMessage: checkin.message,
          remainingDays: Number.isFinite(remaining) ? remaining : null,
        }
      );
    }
  );
}

function checkin() {
  const currentDate = todayKey();
  if (readStore(LAST_SUCCESS_KEY) === currentDate) {
    return done({ status: "skipped", reason: "already_succeeded_today", version: SCRIPT_VERSION });
  }

  const cookie = readStore(COOKIE_KEY);
  const authorization = readStore(AUTH_KEY);
  const origin = storedOrigin();

  if (!cookie && !authorization) {
    return finishWithNotification(
      "",
      "请先登录 glados.network / glados.rocks / glados.one / glados.space / glados.cloud / glados.vip 并刷新一次页面，让代理工具获取登录凭据",
      { status: "needs_cookie", version: SCRIPT_VERSION }
    );
  }

  requestWithRetry(
    "POST",
    {
      url: `${origin}/api/user/checkin`,
      headers: {
        Accept: "application/json, text/plain, */*",
        Origin: origin,
        Cookie: cookie || "",
        "Content-Type": "application/json;charset=utf-8",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        Authorization: authorization || "",
      },
      body: JSON.stringify({ token: origin.slice("https://".length) }),
    },
    (error, response, body) => {
      if (error) {
        if (error.status === 401 || error.status === 403) {
          return finishWithNotification(
            "",
            "登录凭据已失效，请重新登录 GLaDOS 并刷新页面",
            { status: "needs_cookie", version: SCRIPT_VERSION }
          );
        }
        return finishWithNotification(
          "",
          `签到失败：${error.message}`,
          { status: "checkin_error", version: SCRIPT_VERSION }
        );
      }

      let result;
      let classified;
      try {
        result = parseJson(body);
        classified = classifyCheckin(result);
      } catch (parseOrApiError) {
        return finishWithNotification(
          "",
          `签到失败：${parseOrApiError.message}`,
          { status: "checkin_error", version: SCRIPT_VERSION }
        );
      }

      if (classified.kind === "login_expired") {
        return finishWithNotification(
          "",
          `${classified.message}，请重新登录 GLaDOS 并刷新页面`,
          { status: "needs_cookie", version: SCRIPT_VERSION }
        );
      }

      writeStore(currentDate, LAST_SUCCESS_KEY);
      checkStatus(origin, cookie, authorization, classified);
    }
  );
}

if (typeof $request !== "undefined") {
  saveCookie();
} else {
  checkin();
}
