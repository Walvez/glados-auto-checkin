const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptPath = path.join(__dirname, "glados.auto-checkin.scriptcat.user.js");
const script = fs.readFileSync(scriptPath, "utf8");

function response(body, status = 200) {
  return { status, response: body, responseText: JSON.stringify(body) };
}

async function runScript(responses) {
  const notifications = [];
  const logs = [];
  const openedTabs = [];
  const requests = [];

  const context = {
    setTimeout,
    clearTimeout,
    GM_log: (message, level) => logs.push({ message, level }),
    GM_notification: (options) => notifications.push(options),
    GM_openInTab: (...args) => openedTabs.push(args),
    GM_xmlhttpRequest: (options) => {
      requests.push(options);
      const next = responses.shift();
      if (next instanceof Error) {
        options.onerror(next);
      } else {
        options.onload(next);
      }
    },
  };

  const promise = vm.runInNewContext(`(function () {\n${script}\n})()`, context, { timeout: 1000 });
  let value;
  let error;
  try {
    value = await promise;
  } catch (caught) {
    error = caught;
  }

  return { error, logs, notifications, openedTabs, requests, value };
}

async function testSuccessfulCheckin() {
  const result = await runScript([
    response({ code: 0, data: { email: "user@example.com", leftDays: 441.9 } }),
    response({ list: [{ change: "10.00000000", balance: "128.50000000" }] }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 2);
  assert.equal(result.requests[0].url, "https://glados.rocks/api/user/status");
  assert.equal(result.requests[1].url, "https://glados.rocks/api/user/checkin");
  assert.equal(result.requests[1].anonymous, false);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS · user@example.com");
  assert.match(result.notifications[0].text, /今日签到获得10积分，共128\.5积分/);
  assert.match(result.notifications[0].text, /剩余441天/);
}

async function testAlreadyCheckedIn() {
  const result = await runScript([
    response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    response({ message: "Please Try Tomorrow" }),
  ]);

  assert.equal(result.error, undefined);
  assert.match(result.notifications[0].text, /今日已签到/);
}

async function testNeedsLogin() {
  const result = await runScript([response({ code: -2, message: "Not logged in" })]);

  assert.match(result.error.message, /需要登录/);
  assert.equal(result.requests.length, 1);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS 需要重新登录");
  result.notifications[0].onclick();
  assert.deepEqual(result.openedTabs[0], ["https://glados.rocks/login", true]);
}

async function testNetworkFailureNotifies() {
  const originalSetTimeout = setTimeout;
  const result = await runScript([new Error("offline"), new Error("offline")]);

  assert.ok(originalSetTimeout);
  assert.match(result.error.message, /网络请求失败/);
  assert.equal(result.requests.length, 2);
  assert.equal(result.notifications[0].title, "GLaDOS 签到失败");
}

(async () => {
  assert.match(script, /@crontab\s+5-55\/5 \* once \* \*/);
  assert.doesNotMatch(script, /evil_gladoscookie|evil_galdosauthorization/);
  await testSuccessfulCheckin();
  await testAlreadyCheckedIn();
  await testNeedsLogin();
  await testNetworkFailureNotifies();
  console.log("glados scriptcat tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
