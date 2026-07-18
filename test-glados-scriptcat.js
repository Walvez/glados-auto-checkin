const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const scriptPath = path.join(__dirname, "glados.auto-checkin.scriptcat.user.js");
const script = fs.readFileSync(scriptPath, "utf8");

function response(body, status = 200) {
  return { status, response: body, responseText: JSON.stringify(body) };
}

const DOMAIN_ORDER = ["network", "rocks", "one", "space", "cloud", "vip"];

function statusScan(loggedIn = {}) {
  return DOMAIN_ORDER.map((domain) =>
    loggedIn[domain] || response({ code: -2, message: "Not logged in" })
  );
}

async function runScript(responses, extraContext = {}) {
  const notifications = [];
  const logs = [];
  const openedTabs = [];
  const requests = [];

  const context = {
    URL,
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    clearTimeout: () => {},
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
    ...extraContext,
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
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 441.9 } }),
    }),
    response({ list: [{ change: "10.00000000", balance: "128.50000000" }] }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 7);
  assert.equal(result.requests[0].url, "https://glados.network/api/user/status");
  assert.equal(result.requests[0].headers.Referer, "https://glados.network/console");
  assert.equal(result.requests[6].url, "https://glados.network/api/user/checkin");
  assert.equal(result.requests[6].headers.Referer, "https://glados.network/console/checkin");
  assert.equal(result.requests[6].anonymous, false);
  assert.equal(JSON.parse(result.requests[6].data).token, "glados.network");
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS · us***r@example.com");
  assert.match(result.notifications[0].text, /^签到成功！\n今日签到获得10积分，共128\.5积分/);
  assert.match(result.notifications[0].text, /剩余441天/);
  assert.match(result.notifications[0].text, /签到域名：glados\.network/);
}

async function testFallsBackToRocksLogin() {
  const result = await runScript([
    ...statusScan({
      rocks: response({ code: 0, data: { email: "rocks@example.com", leftDays: 88 } }),
    }),
    response({ list: [{ change: 9, balance: 99 }] }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 7);
  assert.equal(result.requests[0].url, "https://glados.network/api/user/status");
  assert.equal(result.requests[1].url, "https://glados.rocks/api/user/status");
  assert.equal(result.requests[6].url, "https://glados.rocks/api/user/checkin");
  assert.equal(result.requests[6].headers.Origin, "https://glados.rocks");
  assert.equal(result.requests[1].headers.Referer, "https://glados.rocks/console");
  assert.equal(result.requests[6].headers.Referer, "https://glados.rocks/console/checkin");
  assert.equal(JSON.parse(result.requests[6].data).token, "glados.rocks");
  assert.equal(result.notifications[0].title, "GLaDOS · ro***s@example.com");
  assert.match(result.notifications[0].text, /签到域名：glados\.rocks/);
}

async function testFindsSessionOnAdditionalMainDomains() {
  const domains = ["one", "space", "cloud", "vip"];

  for (const domain of domains) {
    const origin = `https://glados.${domain}`;
    const result = await runScript([
      ...statusScan({
        [domain]: response({ code: 0, data: { email: `${domain}@example.com`, leftDays: 50 } }),
      }),
      response({ list: [{ change: 5, balance: 100 }] }),
    ]);

    assert.equal(result.error, undefined, `domain ${domain} should succeed`);
    const statusRequest = result.requests.find((item) => item.url === `${origin}/api/user/status`);
    const checkinRequest = result.requests[6];
    assert.equal(statusRequest.url, `${origin}/api/user/status`);
    assert.equal(statusRequest.headers.Referer, `${origin}/console`);
    assert.equal(checkinRequest.url, `${origin}/api/user/checkin`);
    assert.equal(checkinRequest.headers.Origin, origin);
    assert.equal(checkinRequest.headers.Referer, `${origin}/console/checkin`);
    assert.equal(JSON.parse(checkinRequest.data).token, `glados.${domain}`);
  }
}

async function testChecksInDifferentAccountsAcrossDomains() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "first@example.com", leftDays: 100 } }),
      rocks: response({ code: 0, data: { email: "second@example.com", leftDays: 200 } }),
    }),
    response({ list: [{ change: 5, balance: 50 }] }),
    response({ message: "Please Try Tomorrow", code: 1, points: 0 }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 8);
  assert.equal(result.requests[6].url, "https://glados.network/api/user/checkin");
  assert.equal(result.requests[7].url, "https://glados.rocks/api/user/checkin");
  assert.equal(JSON.parse(result.requests[6].data).token, "glados.network");
  assert.equal(JSON.parse(result.requests[7].data).token, "glados.rocks");
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS 多账号签到完成");
  assert.match(result.notifications[0].text, /成功\/已签到 2\/2 个已发现账号/);
  assert.match(result.notifications[0].text, /fi\*\*\*t@example\.com/);
  assert.match(result.notifications[0].text, /se\*\*\*d@example\.com/);
  assert.match(result.notifications[0].text, /fi\*\*\*t@example\.com.*签到域名：glados\.network/);
  assert.match(result.notifications[0].text, /se\*\*\*d@example\.com.*签到域名：glados\.rocks/);
}

async function testDeduplicatesSameAccountAcrossDomains() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "same@example.com", leftDays: 50 } }),
      rocks: response({ code: 0, data: { email: "SAME@example.com", leftDays: 50 } }),
    }),
    response({ list: [{ change: 2, balance: 20 }] }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 7);
  assert.equal(result.requests.filter((item) => item.url.endsWith("/api/user/checkin")).length, 1);
  assert.equal(result.requests[6].url, "https://glados.network/api/user/checkin");
  assert.match(result.logs.map((item) => item.message).join("\n"), /同一账号/);
}

async function testMultiAccountPartialFailureContinuesAndSummarizes() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "good@example.com", leftDays: 10 } }),
      rocks: response({ code: 0, data: { email: "bad@example.com", leftDays: 20 } }),
    }),
    response({ list: [{ change: 3, balance: 30 }] }),
    response({ code: -1, message: "server maintenance" }),
  ]);

  assert.match(result.error.message, /未全部完成/);
  assert.equal(result.requests.filter((item) => item.url.endsWith("/api/user/checkin")).length, 2);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS 多账号签到未全部完成");
  assert.match(result.notifications[0].text, /成功\/已签到 1\/2 个已发现账号/);
  assert.match(result.notifications[0].text, /失败：签到接口返回异常/);
}

async function testAlreadyCheckedIn() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    }),
    response({
      code: 1,
      message: " Please   Try Tomorrow! ",
      list: [{ change: 11, balance: 271 }],
    }),
  ]);

  assert.equal(result.error, undefined);
  assert.match(
    result.notifications[0].text,
    /^今日已签到。\n今日签到获得11积分，当前共271积分\n剩余30天\n签到域名：glados\.network$/,
  );
}

async function testAlreadyCheckedInChineseMessage() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    }),
    response({ message: "今天已经签到，请明天再试" }),
  ]);

  assert.equal(result.error, undefined);
  assert.match(result.notifications[0].text, /^今日已签到。/);
}

async function testCodeOneWithoutPointsOrMessageIsAlreadyCheckedIn() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    }),
    response({ code: 1 }),
  ]);

  assert.equal(result.error, undefined);
  assert.match(result.notifications[0].text, /^今日已签到。/);
  assert.match(result.notifications[0].text, /签到域名：glados\.network/);
}

async function testCurrentAlreadyCheckedInResponse() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 426 } }),
    }),
    response({
      code: 1,
      points: 0,
      message: "Today's observation logged. Return tomorrow for more points.",
      list: [{
        asset: "points",
        business: "system:checkin",
        change: "11.00000000",
        balance: "271.0000000000000000",
        detail: "2026-07-13",
      }],
    }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(
    result.notifications[0].text,
    "今日已签到。\n今日签到获得11积分，当前共271积分\n剩余426天\n签到域名：glados.network",
  );
  assert.doesNotMatch(result.notifications[0].text, /签到成功/);
}

async function testNeedsLogin() {
  // Six main-site domains, each reports not logged in (no retry on 200).
  const result = await runScript([
    response({ code: -2, message: "Not logged in" }),
    response({ code: -2, message: "Not logged in" }),
    response({ code: -2, message: "Not logged in" }),
    response({ code: -2, message: "Not logged in" }),
    response({ code: -2, message: "Not logged in" }),
    response({ code: -2, message: "Not logged in" }),
  ]);

  assert.match(result.error.message, /需要登录/);
  assert.equal(result.requests.length, 6);
  assert.deepEqual(
    result.requests.map((item) => item.url),
    [
      "https://glados.network/api/user/status",
      "https://glados.rocks/api/user/status",
      "https://glados.one/api/user/status",
      "https://glados.space/api/user/status",
      "https://glados.cloud/api/user/status",
      "https://glados.vip/api/user/status",
    ]
  );
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS 需要重新登录");
  result.notifications[0].onclick();
  assert.deepEqual(result.openedTabs[0], ["https://glados.network/login", true]);
}

async function testNetworkFailureNotifies() {
  // 6 origins × 2 attempts each for network errors.
  const offline = Array.from({ length: 12 }, () => new Error("offline"));
  const result = await runScript(offline);

  assert.match(result.error.message, /网络请求失败/);
  assert.equal(result.requests.length, 12);
  assert.equal(result.notifications[0].title, "GLaDOS 签到失败");
}

async function testUnknownCheckinResponseFailsClosed() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    }),
    response({ code: -1, message: "server maintenance" }),
  ]);

  assert.match(result.error.message, /签到接口返回异常/);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS 签到失败");
  assert.doesNotMatch(result.notifications[0].text, /签到成功/);
}

async function testInvalidJsonFailsClosed() {
  const invalid = { status: 200, response: null, responseText: "<html>bad gateway</html>" };
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    }),
    invalid,
    invalid,
  ]);

  assert.match(result.error.message, /无法解析/);
  assert.equal(result.requests.length, 8);
  assert.equal(result.notifications[0].title, "GLaDOS 签到失败");
}

async function testRetriesHttp429() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
    }),
    response({ message: "rate limited" }, 429),
    response({ list: [{ change: 3, balance: 30 }] }),
  ]);

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 8);
  assert.match(result.notifications[0].text, /签到成功/);
}

async function testHttp403PromptsLoginWithoutRetry() {
  // 403 is not retried; script probes all 6 origins once each.
  const result = await runScript([
    response({ message: "forbidden" }, 403),
    response({ message: "forbidden" }, 403),
    response({ message: "forbidden" }, 403),
    response({ message: "forbidden" }, 403),
    response({ message: "forbidden" }, 403),
    response({ message: "forbidden" }, 403),
  ]);

  assert.match(result.error.message, /需要登录/);
  assert.equal(result.requests.length, 6);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, "GLaDOS 需要重新登录");
}

async function testExplicitSuccessWithoutPointRecord() {
  const result = await runScript([
    ...statusScan({
      network: response({ code: 0, data: { email: "user@example.com", leftDays: null } }),
    }),
    response({ code: 0, message: "Checkin success" }),
  ]);

  assert.equal(result.error, undefined);
  assert.match(result.notifications[0].text, /^签到成功！/);
  assert.doesNotMatch(result.notifications[0].text, /剩余NaN天/);
}

async function testOptionalPushDeerNotificationDoesNotLeakCredentials() {
  const values = { glados_notify_pushdeer: "push-key" };
  const result = await runScript(
    [
      ...statusScan({
        network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
      }),
      response({ list: [{ change: 3, balance: 30 }] }),
      response({ code: 0 }),
    ],
    {
      GM_getValue: async (key, fallback) => values[key] || fallback,
    }
  );

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 8);
  assert.equal(result.requests[7].url, "https://api2.pushdeer.com/message/push");
  assert.equal(result.requests[7].anonymous, true);
  assert.equal(result.requests[7].headers.Cookie, undefined);
  assert.doesNotMatch(result.requests[7].data, /user@example\.com/);
  assert.match(result.requests[7].data, /us\*\*\*r@example\.com/);
}

async function testAdditionalRemoteNotificationChannels() {
  const values = {
    glados_notify_wecom: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=wecom-key",
    glados_notify_dingtalk: "https://oapi.dingtalk.com/robot/send?access_token=dingtalk-token",
    glados_notify_feishu: "https://open.feishu.cn/open-apis/bot/v2/hook/feishu-key",
    glados_notify_pushme: "https://push.i-i.me/?push_key=pushme-key",
    glados_notify_bark: "https://api.day.app/bark-key",
  };
  const result = await runScript(
    [
      ...statusScan({
        network: response({ code: 0, data: { email: "user@example.com", leftDays: 30 } }),
      }),
      response({ list: [{ change: 3, balance: 30 }] }),
      response({ code: 0 }),
      response({ code: 0 }),
      response({ code: 0 }),
      response({ code: 0 }),
      response({ code: 0 }),
    ],
    {
      GM_getValue: async (key, fallback) => values[key] || fallback,
    }
  );

  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 12);
  const remote = result.requests.slice(7);
  assert.deepEqual(
    remote.map((item) => item.url),
    [
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=wecom-key",
      "https://oapi.dingtalk.com/robot/send?access_token=dingtalk-token",
      "https://open.feishu.cn/open-apis/bot/v2/hook/feishu-key",
      "https://push.i-i.me/?push_key=pushme-key",
      "https://api.day.app/bark-key",
    ]
  );
  remote.forEach((item) => {
    assert.equal(item.anonymous, true);
    assert.equal(item.headers.Cookie, undefined);
    assert.doesNotMatch(item.data, /user@example\.com/);
    assert.match(item.data, /us\*\*\*r@example\.com/);
  });
  assert.match(remote[0].data, /"msgtype":"text"/);
  assert.match(remote[1].data, /"msgtype":"markdown"/);
  assert.match(remote[2].data, /"msg_type":"text"/);
  assert.match(remote[3].data, /"type":"markdown"/);
  assert.match(remote[4].data, /"group":"GLaDOS"/);
}

(async () => {
  assert.match(script, /@crontab\s+5-55\/5 \* once \* \*/);
  assert.doesNotMatch(script, /evil_gladoscookie|evil_galdosauthorization/);
  assert.match(script, /^\/\/ @name\s+GLaDOS自动签到$/m);
  assert.match(script, /@connect\s+glados\.network/);
  assert.match(script, /@connect\s+glados\.rocks/);
  assert.match(script, /@connect\s+glados\.one/);
  assert.match(script, /@connect\s+glados\.space/);
  assert.match(script, /@connect\s+glados\.cloud/);
  assert.match(script, /@connect\s+glados\.vip/);
  assert.doesNotMatch(script, /@connect\s+glados\.live/);
  assert.doesNotMatch(script, /@connect\s+glados\.top/);
  assert.match(
    script,
    /GLADOS_ORIGINS\s*=\s*\[\s*"https:\/\/glados\.network",\s*"https:\/\/glados\.rocks",\s*"https:\/\/glados\.one",\s*"https:\/\/glados\.space",\s*"https:\/\/glados\.cloud",\s*"https:\/\/glados\.vip",\s*\]/
  );
  assert.match(script, /@connect\s+qyapi\.weixin\.qq\.com/);
  assert.match(script, /@connect\s+oapi\.dingtalk\.com/);
  assert.match(script, /@connect\s+open\.feishu\.cn/);
  assert.match(script, /@connect\s+push\.i-i\.me/);
  assert.match(script, /@connect\s+api\.day\.app/);
  await testSuccessfulCheckin();
  await testFallsBackToRocksLogin();
  await testFindsSessionOnAdditionalMainDomains();
  await testChecksInDifferentAccountsAcrossDomains();
  await testDeduplicatesSameAccountAcrossDomains();
  await testMultiAccountPartialFailureContinuesAndSummarizes();
  await testAlreadyCheckedIn();
  await testAlreadyCheckedInChineseMessage();
  await testCodeOneWithoutPointsOrMessageIsAlreadyCheckedIn();
  await testCurrentAlreadyCheckedInResponse();
  await testNeedsLogin();
  await testNetworkFailureNotifies();
  await testUnknownCheckinResponseFailsClosed();
  await testInvalidJsonFailsClosed();
  await testRetriesHttp429();
  await testHttp403PromptsLoginWithoutRetry();
  await testExplicitSuccessWithoutPointRecord();
  await testOptionalPushDeerNotificationDoesNotLeakCredentials();
  await testAdditionalRemoteNotificationChannels();
  console.log("glados scriptcat tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
