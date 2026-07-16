const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptPath = path.join(__dirname, "glados.autosign.surge.js");

function testStableResourceReferencesAndNotificationBoundary() {
  const version = require("./package.json").version;
  const files = [
    "Surge/glados-auto-checkin.sgmodule",
    "QuantumultX/glados-auto-checkin.snippet",
    "README.md",
  ];
  const stablePrefix = "https://raw.githubusercontent.com/Walvez/glados-auto-checkin/refs/heads/main/";

  files.forEach((file) => {
    const content = fs.readFileSync(path.join(__dirname, file), "utf8");
    const projectRawUrls = content.match(
      /https:\/\/raw\.githubusercontent\.com\/Walvez\/glados-auto-checkin\/[^\s'"`)]+/g
    ) || [];
    assert.ok(projectRawUrls.length > 0, `${file} 应包含项目 Raw 地址`);
    projectRawUrls.forEach((url) => {
      assert.ok(url.startsWith(stablePrefix), `${file} 应使用固定 main 地址`);
    });
    assert.doesNotMatch(content, /glados-auto-checkin\/v\d+\.\d+\.\d+\//);
  });

  const module = fs.readFileSync(
    path.join(__dirname, "Surge/glados-auto-checkin.sgmodule"),
    "utf8"
  );
  assert.doesNotMatch(module, /#!arguments=|\bargument=|pushdeer|serverchan|telegram/i);

  const proxyScript = fs.readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(
    proxyScript,
    /api2\.pushdeer\.com|sctapi\.ftqq\.com|api\.telegram\.org|\$argument|sourcePath/
  );

  const scriptCat = fs.readFileSync(
    path.join(__dirname, "glados.auto-checkin.scriptcat.user.js"),
    "utf8"
  );
  const scriptCatVersion = scriptCat.match(/@version\s+(\d+\.\d+\.\d+)/)?.[1];
  assert.equal(scriptCatVersion, version, "ScriptCat 版本应与 package.json 一致");
}

function runScript(extraContext) {
  const script = fs.readFileSync(scriptPath, "utf8");
  const notifications = [];
  const store = extraContext.store || {};

  return new Promise((resolve, reject) => {
    const context = {
      console,
      setTimeout: (callback) => {
        callback();
        return 0;
      },
      $persistentStore: {
        read: (key) => store[key] || null,
        write: (value, key) => {
          store[key] = value;
          return true;
        },
      },
      $notification: {
        post: (title, subtitle, body) => notifications.push({ title, subtitle, body }),
      },
      $done: (doneValue) => resolve({ store, notifications, doneValue }),
      ...extraContext,
    };

    try {
      vm.runInNewContext(script, context, { timeout: 1000 });
    } catch (error) {
      reject(error);
    }
  });
}

async function testCaptureCookie() {
  const result = await runScript({
    store: {},
    $request: {
      method: "POST",
      url: "https://glados.rocks/api/user/checkin",
      headers: {
        cookie: "session=test",
        authorization: "Bearer token",
      },
    },
  });

  assert.equal(result.store.evil_gladoscookie, "session=test");
  assert.equal(result.store.evil_galdosauthorization, "Bearer token");
  assert.equal(result.store.evil_gladosorigin, "https://glados.rocks");
  assert.equal(result.notifications[0].title, "GLaDOS");
  assert.match(result.notifications[0].body, /登录凭据/);
}

async function testCaptureNetworkDomain() {
  const result = await runScript({
    store: {},
    $request: {
      method: "GET",
      url: "https://glados.network/console/checkin",
      headers: { Cookie: "session=network" },
    },
  });

  assert.equal(result.store.evil_gladoscookie, "session=network");
  assert.equal(result.store.evil_gladosorigin, "https://glados.network");
}

async function testCaptureCookieFromAnyGladosRequest() {
  const result = await runScript({
    store: {},
    $request: {
      method: "GET",
      url: "https://glados.rocks/console/checkin",
      headers: {
        Cookie: "session=from-page",
      },
    },
  });

  assert.equal(result.store.evil_gladoscookie, "session=from-page");
  assert.equal(result.notifications[0].title, "GLaDOS");
  assert.match(result.notifications[0].body, /登录凭据/);
}

async function testRepeatedCaptureDoesNotNotifyWhenCookieIsUnchanged() {
  const result = await runScript({
    store: {
      evil_gladoscookie: "session=same",
    },
    $request: {
      method: "GET",
      url: "https://glados.rocks/console/checkin",
      headers: {
        Cookie: "session=same",
      },
    },
  });

  assert.equal(result.store.evil_gladoscookie, "session=same");
  assert.equal(result.notifications.length, 0);
}

async function testCaptureAuthorizationWithoutCookie() {
  const result = await runScript({
    store: {},
    $request: {
      method: "GET",
      url: "https://glados.rocks/api/user/info",
      headers: {
        Authorization: "Bearer auth-only",
      },
    },
  });

  assert.equal(result.store.evil_galdosauthorization, "Bearer auth-only");
  assert.equal(result.notifications[0].title, "GLaDOS");
  assert.match(result.notifications[0].body, /登录凭据/);
}

async function testCronSigninWithAuthorizationOnly() {
  let postOptions;
  const result = await runScript({
    store: {
      evil_galdosauthorization: "Bearer auth-only",
    },
    $httpClient: {
      post: (options, callback) => {
        postOptions = options;
        callback(null, { status: 200 }, JSON.stringify({ message: "Please Try Tomorrow" }));
      },
      get: (_options, callback) => {
        callback(
          null,
          { status: 200 },
          JSON.stringify({
            code: 0,
            data: { email: "user@example.com", days: 12, leftDays: 34.9 },
          })
        );
      },
    },
  });

  assert.equal(postOptions.headers.Authorization, "Bearer auth-only");
  assert.equal(postOptions.url, "https://glados.rocks/api/user/checkin");
  assert.equal(postOptions.headers.Origin, "https://glados.rocks");
  assert.equal(result.doneValue.status, "already_checked");
  assert.equal(result.doneValue.version, "reliability-20260716");
}

async function testCronSignin() {
  let postOptions;
  let getOptions;
  const result = await runScript({
    store: {
      evil_gladoscookie: "session=test",
      evil_galdosauthorization: "Bearer token",
      evil_gladosorigin: "https://glados.network",
    },
    $httpClient: {
      post: (options, callback) => {
        postOptions = options;
        callback(null, { status: 200 }, JSON.stringify({ list: [{ change: 10, balance: 128 }] }));
      },
      get: (options, callback) => {
        getOptions = options;
        callback(
          null,
          { status: 200 },
          JSON.stringify({
            code: 0,
            data: { email: "user@example.com", days: 12, leftDays: 34.9 },
          })
        );
      },
    },
  });

  assert.equal(result.notifications[0].title, "GLaDOS");
  assert.equal(postOptions.url, "https://glados.network/api/user/checkin");
  assert.equal(postOptions.headers.Origin, "https://glados.network");
  assert.equal(getOptions.url, "https://glados.network/api/user/status");
  assert.equal(result.notifications[0].subtitle, "账户：us***r@example.com");
  assert.match(result.notifications[0].body, /今日签到获得10积分，共128积分/);
  assert.doesNotMatch(result.notifications[0].body, /获得10天/);
  assert.doesNotMatch(result.notifications[0].body, /已用/);
  assert.match(result.notifications[0].body, /剩余34天/);
  assert.deepEqual(result.doneValue, {
    status: "ok",
    version: "reliability-20260716",
    checkinMessage: "签到成功！\n今日签到获得10积分，共128积分",
    remainingDays: 34,
  });
}

async function testCronSigninFormatsDecimalPoints() {
  const result = await runScript({
    store: {
      evil_gladoscookie: "session=test",
      evil_galdosauthorization: "Bearer token",
    },
    $httpClient: {
      post: (_options, callback) => {
        callback(
          null,
          { status: 200 },
          JSON.stringify({ list: [{ change: "10.00000000", balance: "128.50000000" }] })
        );
      },
      get: (_options, callback) => {
        callback(
          null,
          { status: 200 },
          JSON.stringify({
            code: 0,
            data: { email: "user@example.com", days: 12, leftDays: 34.9 },
          })
        );
      },
    },
  });

  assert.match(result.notifications[0].body, /今日签到获得10积分，共128\.5积分/);
  assert.doesNotMatch(result.notifications[0].body, /10\.00000000/);
}

async function testQuantumultXRuntime() {
  const store = {};
  const result = await runScript({
    store,
    $persistentStore: undefined,
    $notification: undefined,
    $prefs: {
      valueForKey: (key) => store[key] || null,
      setValueForKey: (value, key) => {
        store[key] = value;
        return true;
      },
    },
    $notify: (title, subtitle, body) => resultNotifications.push({ title, subtitle, body }),
    $request: {
      method: "GET",
      url: "https://glados.network/console/checkin",
      headers: { Cookie: "session=qx" },
    },
  });

  assert.equal(result.store.evil_gladoscookie, "session=qx");
  assert.equal(result.store.evil_gladosorigin, "https://glados.network");
  assert.equal(resultNotifications[0].body, "获取 GLaDOS 登录凭据成功");
}

async function testQuantumultXCronSignin() {
  const store = {
    evil_gladoscookie: "session=qx",
    evil_galdosauthorization: "Bearer qx",
    evil_gladosorigin: "https://glados.network",
  };
  const notifications = [];
  const requests = [];
  const responses = [
    { body: JSON.stringify({ list: [{ change: "7.5", balance: "135.5" }] }) },
    { body: JSON.stringify({ code: 0, data: { email: "qx@example.com", leftDays: 441 } }) },
  ];
  const result = await runScript({
    store,
    $persistentStore: undefined,
    $notification: undefined,
    $prefs: {
      valueForKey: (key) => store[key] || null,
      setValueForKey: (value, key) => {
        store[key] = value;
        return true;
      },
    },
    $notify: (title, subtitle, body) => notifications.push({ title, subtitle, body }),
    $task: {
      fetch: async (options) => {
        requests.push(options);
        return responses.shift();
      },
    },
  });

  assert.equal(result.doneValue.status, "ok");
  assert.equal(requests[0].url, "https://glados.network/api/user/checkin");
  assert.equal(requests[1].url, "https://glados.network/api/user/status");
  assert.equal(notifications[0].subtitle, "账户：***@example.com");
  assert.match(notifications[0].body, /今日签到获得7\.5积分，共135\.5积分/);
  assert.match(notifications[0].body, /剩余441天/);
}

async function testUnknownCheckinResponseFailsClosed() {
  let requestCount = 0;
  const result = await runScript({
    store: { evil_gladoscookie: "session=test" },
    $httpClient: {
      post: (_options, callback) => {
        requestCount += 1;
        callback(null, { status: 200 }, JSON.stringify({ code: -1, message: "server maintenance" }));
      },
      get: () => {
        throw new Error("未知响应后不应查询状态");
      },
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(result.doneValue.status, "checkin_error");
  assert.match(result.notifications[0].body, /签到接口返回异常/);
  assert.doesNotMatch(result.notifications[0].body, /签到成功/);
}

async function testInvalidJsonFailsClosed() {
  const result = await runScript({
    store: { evil_gladoscookie: "session=test" },
    $httpClient: {
      post: (_options, callback) => callback(null, { status: 200 }, "<html>bad gateway</html>"),
    },
  });

  assert.equal(result.doneValue.status, "checkin_error");
  assert.match(result.notifications[0].body, /无法解析/);
}

async function testRetriesHttp429() {
  let postCount = 0;
  const result = await runScript({
    store: { evil_gladoscookie: "session=test" },
    $httpClient: {
      post: (_options, callback) => {
        postCount += 1;
        if (postCount === 1) {
          callback(null, { status: 429 }, JSON.stringify({ message: "rate limited" }));
        } else {
          callback(null, { status: 200 }, JSON.stringify({ list: [{ change: 3, balance: 30 }] }));
        }
      },
      get: (_options, callback) => callback(
        null,
        { status: 200 },
        JSON.stringify({ code: 0, data: { email: "user@example.com", leftDays: 30 } })
      ),
    },
  });

  assert.equal(postCount, 2);
  assert.equal(result.doneValue.status, "ok");
  assert.match(result.notifications[0].body, /签到成功/);
}

async function testHttp403NeedsCookieWithoutRetry() {
  let postCount = 0;
  const result = await runScript({
    store: { evil_gladoscookie: "session=test" },
    $httpClient: {
      post: (_options, callback) => {
        postCount += 1;
        callback(null, { status: 403 }, JSON.stringify({ message: "forbidden" }));
      },
    },
  });

  assert.equal(postCount, 1);
  assert.equal(result.doneValue.status, "needs_cookie");
  assert.match(result.notifications[0].body, /登录凭据已失效/);
}

async function testStatusFailureIsPartialSuccess() {
  let getCount = 0;
  const store = { evil_gladoscookie: "session=test" };
  const result = await runScript({
    store,
    $httpClient: {
      post: (_options, callback) => callback(
        null,
        { status: 200 },
        JSON.stringify({ list: [{ change: 3, balance: 30 }] })
      ),
      get: (_options, callback) => {
        getCount += 1;
        callback(null, { status: 500 }, "server error");
      },
    },
  });

  assert.equal(getCount, 2);
  assert.equal(result.doneValue.status, "partial_success");
  assert.match(result.notifications[0].body, /不影响本次签到/);
  assert.ok(store.glados_last_success_date);
}

async function testSecondRunTodaySkipsSilently() {
  const now = new Date();
  const currentDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const result = await runScript({
    store: {
      evil_gladoscookie: "session=test",
      glados_last_success_date: currentDate,
    },
    $httpClient: {
      post: () => {
        throw new Error("当天已成功时不应再请求");
      },
    },
  });

  assert.equal(result.doneValue.status, "skipped");
  assert.equal(result.notifications.length, 0);
}

const resultNotifications = [];

(async () => {
  testStableResourceReferencesAndNotificationBoundary();
  await testCaptureCookie();
  await testCaptureNetworkDomain();
  await testCaptureCookieFromAnyGladosRequest();
  await testRepeatedCaptureDoesNotNotifyWhenCookieIsUnchanged();
  await testCaptureAuthorizationWithoutCookie();
  await testCronSignin();
  await testCronSigninFormatsDecimalPoints();
  await testCronSigninWithAuthorizationOnly();
  await testQuantumultXRuntime();
  await testQuantumultXCronSignin();
  await testUnknownCheckinResponseFailsClosed();
  await testInvalidJsonFailsClosed();
  await testRetriesHttp429();
  await testHttp403NeedsCookieWithoutRetry();
  await testStatusFailureIsPartialSuccess();
  await testSecondRunTodaySkipsSilently();
  console.log("glados surge tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
