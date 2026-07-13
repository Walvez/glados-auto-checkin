const COOKIE_KEY = "evil_gladoscookie";
const AUTH_KEY = "evil_galdosauthorization";
const ORIGIN_KEY = "evil_gladosorigin";
const DEFAULT_ORIGIN = "https://glados.rocks";
const SCRIPT_VERSION = "dual-domain-20260713";

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

function request(method, options, callback) {
  if (typeof $httpClient !== "undefined") {
    return $httpClient[method.toLowerCase()](options, callback);
  }

  $task
    .fetch(Object.assign({}, options, { method: method.toUpperCase() }))
    .then((response) => callback(null, response, response.body))
    .catch((error) => callback(error.error || String(error)));
}

function header(headers, name) {
  const target = name.toLowerCase();
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === target);
  return key ? headers[key] : "";
}

function parseJson(body) {
  try {
    return JSON.parse(body || "{}");
  } catch (error) {
    return {};
  }
}

function formatPoints(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function originFromUrl(url) {
  const match = /^https:\/\/glados\.(network|rocks)(?:\/|$)/i.exec(url || "");
  return match ? `https://glados.${match[1].toLowerCase()}` : "";
}

function storedOrigin() {
  const origin = readStore(ORIGIN_KEY);
  return origin === "https://glados.network" || origin === "https://glados.rocks" ? origin : DEFAULT_ORIGIN;
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

function messageFromCheckin(result) {
  if (result.message === "Please Try Tomorrow") {
    return "今日已签到";
  }
  if (result.message === "oops, token error") {
    return "Cookie 失效或 token 错误，请重新获取 Cookie";
  }

  const change = result.list && result.list[0] && result.list[0].change;
  if (change !== undefined) {
    const balance = result.list[0].balance;
    const total = balance !== undefined ? `，共${formatPoints(balance)}积分` : "";
    return `今日签到获得${formatPoints(change)}积分${total}`;
  }

  return result.message || "签到结果未知";
}

function checkStatus(origin, cookie, authorization, checkinMessage) {
  request(
    "GET",
    {
      url: `${origin}/api/user/status`,
      headers: {
        Cookie: cookie,
        Authorization: authorization || "",
      },
    },
    (error, response, body) => {
      if (error) {
        notify("", `${checkinMessage}\n状态查询失败：${error}`);
        return done({ status: "status_error", version: SCRIPT_VERSION, checkinMessage });
      }

      const status = parseJson(body);
      if (status.code !== 0 || !status.data) {
        notify("", `${checkinMessage}\n状态查询失败，请重新登录获取 Cookie`);
        return done({ status: "status_error", version: SCRIPT_VERSION, checkinMessage });
      }

      const account = status.data.email || "未知账户";
      const remaining = parseInt(status.data.leftDays, 10);
      notify(`账户：${account}`, `${checkinMessage}\n剩余${remaining}天`);
      done({ status: "ok", version: SCRIPT_VERSION, checkinMessage, remainingDays: remaining });
    }
  );
}

function checkin() {
  const cookie = readStore(COOKIE_KEY);
  const authorization = readStore(AUTH_KEY);
  const origin = storedOrigin();

  if (!cookie && !authorization) {
    notify("", "请先登录 glados.network 或 glados.rocks 并刷新一次页面，让代理工具获取登录凭据");
    return done({ status: "needs_cookie", version: SCRIPT_VERSION });
  }

  request(
    "POST",
    {
      url: `${origin}/api/user/checkin`,
      headers: {
        Accept: "application/json, text/plain, */*",
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json;charset=utf-8",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        Authorization: authorization || "",
      },
      body: '{ "token": "glados.one" }',
    },
    (error, response, body) => {
      if (error) {
        notify("", `签到失败：${error}`);
        return done({ status: "checkin_error", version: SCRIPT_VERSION });
      }

      const result = parseJson(body);
      checkStatus(origin, cookie, authorization, messageFromCheckin(result));
    }
  );
}

if (typeof $request !== "undefined") {
  saveCookie();
} else {
  checkin();
}
