const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptPath = path.join(__dirname, "glados.autosign.surge.js");

function runScript(extraContext) {
  const script = fs.readFileSync(scriptPath, "utf8");
  const notifications = [];
  const store = extraContext.store || {};

  return new Promise((resolve, reject) => {
    const context = {
      console,
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
  assert.equal(result.notifications[0].title, "GLaDOS");
  assert.match(result.notifications[0].body, /登录凭据/);
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
  assert.equal(result.doneValue.status, "ok");
  assert.equal(result.doneValue.version, "points-total-20260711");
}

async function testCronSignin() {
  const result = await runScript({
    store: {
      evil_gladoscookie: "session=test",
      evil_galdosauthorization: "Bearer token",
    },
    $httpClient: {
      post: (_options, callback) => {
        callback(null, { status: 200 }, JSON.stringify({ list: [{ change: 10, balance: 128 }] }));
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

  assert.equal(result.notifications[0].title, "GLaDOS");
  assert.equal(result.notifications[0].subtitle, "账户：user@example.com");
  assert.match(result.notifications[0].body, /今日签到获得10积分，共128积分/);
  assert.doesNotMatch(result.notifications[0].body, /获得10天/);
  assert.doesNotMatch(result.notifications[0].body, /已用/);
  assert.match(result.notifications[0].body, /剩余34天/);
  assert.deepEqual(result.doneValue, {
    status: "ok",
    version: "points-total-20260711",
    checkinMessage: "今日签到获得10积分，共128积分",
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
      url: "https://glados.rocks/console/checkin",
      headers: { Cookie: "session=qx" },
    },
  });

  assert.equal(result.store.evil_gladoscookie, "session=qx");
  assert.equal(resultNotifications[0].body, "获取 GLaDOS 登录凭据成功");
}

async function testQuantumultXCronSignin() {
  const store = {
    evil_gladoscookie: "session=qx",
    evil_galdosauthorization: "Bearer qx",
  };
  const notifications = [];
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
      fetch: async () => responses.shift(),
    },
  });

  assert.equal(result.doneValue.status, "ok");
  assert.equal(notifications[0].subtitle, "账户：qx@example.com");
  assert.match(notifications[0].body, /今日签到获得7\.5积分，共135\.5积分/);
  assert.match(notifications[0].body, /剩余441天/);
}

const resultNotifications = [];

(async () => {
  await testCaptureCookie();
  await testCaptureCookieFromAnyGladosRequest();
  await testRepeatedCaptureDoesNotNotifyWhenCookieIsUnchanged();
  await testCaptureAuthorizationWithoutCookie();
  await testCronSignin();
  await testCronSigninFormatsDecimalPoints();
  await testCronSigninWithAuthorizationOnly();
  await testQuantumultXRuntime();
  await testQuantumultXCronSignin();
  console.log("glados surge tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
