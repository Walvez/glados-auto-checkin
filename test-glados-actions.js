"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const core = require("./lib/glados-core");
const checkinCli = require("./cli/checkin");

const {
  GLADOS_ORIGINS,
  checkinTokenForOrigin,
  parseAccounts,
  classifyCheckin,
  redactSecrets,
  isSuccessfulOutcome,
  parseJsonBody,
  isAlreadyCheckedIn,
} = core;

const { runCheckin, resolveOrigins, main } = checkinCli;

function createLogger() {
  const lines = { info: [], warn: [], error: [] };
  return {
    lines,
    info: (message) => lines.info.push(String(message)),
    warn: (message) => lines.warn.push(String(message)),
    error: (message) => lines.error.push(String(message)),
    all() {
      return [...lines.info, ...lines.warn, ...lines.error].join("\n");
    },
  };
}

function jsonResponse(body, status = 200) {
  return {
    status,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(body, status = 200) {
  return {
    status,
    text: async () => String(body),
  };
}

function buildFetch(handlers) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: (init.method || "GET").toUpperCase(), init });
    const handler = handlers.shift();
    if (!handler) {
      throw new Error(`Unexpected request: ${init.method || "GET"} ${url}`);
    }
    if (handler instanceof Error) {
      throw handler;
    }
    if (typeof handler === "function") {
      return handler(url, init);
    }
    return handler;
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function sampleCookie(id = "a") {
  return `koa:sess=eyJ1c2VySWQiOiJ1c2VyLSR7aWR9In0.${id}; koa:sess.sig=sig-${id}-value`;
}

// --- core unit tests ---

function testParseAccountsJsonArray() {
  const accounts = parseAccounts(JSON.stringify([sampleCookie("1"), sampleCookie("2")]));
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].cookie, sampleCookie("1"));
  assert.equal(accounts[1].name, "账号2");
}

function testCheckinTokenMatchesOrigin() {
  GLADOS_ORIGINS.forEach((origin) => {
    assert.equal(checkinTokenForOrigin(origin), new URL(origin).hostname);
  });
  assert.throws(() => checkinTokenForOrigin("https://evil.example"), /不受支持/);
}

function testParseAccountsNewline() {
  const raw = `${sampleCookie("x")}\n# comment\n${sampleCookie("y")}\n`;
  const accounts = parseAccounts(raw);
  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].cookie, sampleCookie("x"));
  assert.equal(accounts[1].cookie, sampleCookie("y"));
}

function testParseAccountsObjectArray() {
  const accounts = parseAccounts(
    JSON.stringify([
      { cookie: sampleCookie("work"), name: "work" },
      { cookie: sampleCookie("home"), name: "home" },
    ])
  );
  assert.equal(accounts[0].name, "work");
  assert.equal(accounts[1].name, "home");
}

function testParseAccountsRejectsEmpty() {
  assert.throws(() => parseAccounts(""), /缺少 GLaDOS Cookie/);
  assert.throws(() => parseAccounts("   \n  # only\n"), /未解析到有效账号/);
  assert.throws(() => parseAccounts("[]"), /不能为空/);
  assert.throws(() => parseAccounts('["unterminated"'), /JSON 数组格式无效/);
  assert.throws(() => parseAccounts("short"), /Cookie 过短/);
}

function testParseAccountsDoesNotSplitOnAmpersand() {
  // Cookies may legally contain "&"; do not treat it as an account separator.
  const cookie = `koa:sess=abc&def; koa:sess.sig=ghi`;
  const accounts = parseAccounts(cookie);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].cookie, cookie);
}

function testClassifyCheckinOutcomes() {
  const success = classifyCheckin({ list: [{ change: "10.0", balance: "128.5" }] });
  assert.equal(success.kind, "success");
  assert.match(success.message, /签到成功/);

  const already = classifyCheckin({ message: "Checkin Repeats! Please Try Tomorrow", points: 0, code: 1 });
  assert.equal(already.kind, "already_checked");

  const expired = classifyCheckin({ code: -2, message: "Not logged in" });
  assert.equal(expired.kind, "login_expired");

  assert.throws(
    () => classifyCheckin({ message: "please checkin via https://glados.cloud" }),
    /please checkin via|token/
  );
}

function testRedactSecretsNeverLeaksCookie() {
  const cookie = sampleCookie("secret");
  const text = `Cookie: ${cookie}\nBearer abc.def.ghi\nkoa:sess=plainvalue12345; koa:sess.sig=sigvalue999`;
  const redacted = redactSecrets(text, [cookie]);
  assert.doesNotMatch(redacted, /eyJ1c2VySWQi/);
  assert.doesNotMatch(redacted, /sig-secret-value/);
  assert.doesNotMatch(redacted, /plainvalue12345/);
  assert.match(redacted, /REDACTED/);
}

function testIsAlreadyCheckedInIncludesRepeats() {
  assert.equal(isAlreadyCheckedIn({ message: "Checkin Repeats! Please Try Tomorrow" }), true);
}

function testParseJsonBodyStrict() {
  assert.deepEqual(parseJsonBody('{"code":0}'), { code: 0 });
  assert.throws(() => parseJsonBody("not-json"), /无法解析/);
  assert.throws(() => parseJsonBody("[1,2]"), /无法解析|不是 JSON/);
}

// --- CLI / runner tests ---

async function testMissingSecretFailsFast() {
  const logger = createLogger();
  const outcome = await runCheckin({
    env: {},
    logger,
    fetch: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.ok, false);
  assert.match(logger.all(), /缺少 GLaDOS Cookie|GLADOS_COOKIE/);
}

async function testInvalidJsonSecretFailsFast() {
  const logger = createLogger();
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: '["broken"' },
    logger,
    fetch: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(outcome.exitCode, 1);
  assert.match(logger.all(), /JSON 数组格式无效/);
}

async function testSuccessfulSingleAccount() {
  const cookie = sampleCookie("ok");
  const fetchImpl = buildFetch([
    jsonResponse({ code: 0, data: { email: "user@example.com", leftDays: 441.9 } }),
    jsonResponse({ list: [{ change: "12", balance: "100" }] }),
  ]);
  const logger = createLogger();
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: cookie },
    logger,
    fetch: fetchImpl,
    sleep: async () => {},
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.results[0].kind, "success");
  assert.equal(fetchImpl.calls[0].url, `${GLADOS_ORIGINS[0]}/api/user/status`);
  assert.equal(fetchImpl.calls[1].url, `${GLADOS_ORIGINS[0]}/api/user/checkin`);
  assert.equal(
    JSON.parse(fetchImpl.calls[1].init.body).token,
    new URL(GLADOS_ORIGINS[0]).hostname
  );
  assert.equal(fetchImpl.calls[1].init.headers.Origin, GLADOS_ORIGINS[0]);
  assert.doesNotMatch(logger.all(), /sig-ok-value/);
  assert.match(logger.all(), /us\*\*\*r@example\.com|签到成功/);
}

async function testAlreadyCheckedInExitZero() {
  const fetchImpl = buildFetch([
    jsonResponse({ code: 0, data: { email: "a@b.com", leftDays: 10 } }),
    jsonResponse({ message: "Please Try Tomorrow", code: 1, points: 0 }),
  ]);
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: sampleCookie("done") },
    logger: createLogger(),
    fetch: fetchImpl,
    sleep: async () => {},
  });
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.results[0].kind, "already_checked");
  assert.equal(isSuccessfulOutcome(outcome.results[0].kind), true);
}

async function testDomainFallbackSameOriginCheckin() {
  const notLogged = jsonResponse({ code: -2, message: "Not logged in" });
  const fetchImpl = buildFetch([
    notLogged, // cloud
    notLogged, // network
    jsonResponse({ code: 0, data: { email: "rocks@example.com", leftDays: 88 } }), // rocks
    jsonResponse({ list: [{ change: 9, balance: 99 }] }),
  ]);
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: sampleCookie("rocks") },
    logger: createLogger(),
    fetch: fetchImpl,
    sleep: async () => {},
  });

  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.results[0].origin, "https://glados.rocks");
  assert.equal(fetchImpl.calls[2].url, "https://glados.rocks/api/user/status");
  assert.equal(fetchImpl.calls[3].url, "https://glados.rocks/api/user/checkin");
  assert.equal(fetchImpl.calls[3].init.headers.Origin, "https://glados.rocks");
  assert.equal(JSON.parse(fetchImpl.calls[3].init.body).token, "glados.rocks");
}

async function testForcedOrigin() {
  assert.deepEqual(resolveOrigins({ GLADOS_ORIGIN: "https://glados.vip" }), [
    "https://glados.vip",
  ]);
  assert.throws(() => resolveOrigins({ GLADOS_ORIGIN: "https://evil.example" }), /不受支持/);
}

async function testMultiAccountPartialFailureExitOne() {
  const cookieA = sampleCookie("a");
  const cookieB = sampleCookie("b");
  const fetchImpl = buildFetch([
    // account A success
    jsonResponse({ code: 0, data: { email: "a@example.com", leftDays: 1 } }),
    jsonResponse({ list: [{ change: 1, balance: 2 }] }),
    // account B all domains fail auth
    ...GLADOS_ORIGINS.map(() => textResponse("unauthorized", 401)),
  ]);
  const logger = createLogger();
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: JSON.stringify([cookieA, cookieB]) },
    logger,
    fetch: fetchImpl,
    sleep: async () => {},
  });

  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.results.length, 2);
  assert.equal(outcome.results[0].kind, "success");
  assert.equal(outcome.results[1].kind, "error");
  assert.doesNotMatch(logger.all(), /sig-a-value|sig-b-value|koa:sess=ey/);
}

async function testCookieNotLeakedOnHttpErrorBody() {
  const cookie = sampleCookie("leak");
  const fetchImpl = buildFetch([
    jsonResponse({ code: 0, data: { email: "x@y.com", leftDays: 3 } }),
    // simulate a weird error path that includes cookie in thrown message via status text parse
    textResponse(`error for ${cookie}`, 500),
    textResponse(`error for ${cookie}`, 500),
  ]);
  const logger = createLogger();
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: cookie },
    logger,
    fetch: fetchImpl,
    sleep: async () => {},
  });
  assert.equal(outcome.exitCode, 1);
  assert.doesNotMatch(logger.all(), /sig-leak-value/);
  assert.doesNotMatch(logger.all(), /eyJ1c2VySWQiOiJ1c2Vy/);
}

async function testRetryOn429ThenSuccess() {
  let statusAttempts = 0;
  const fetchImpl = async (url, init = {}) => {
    fetchImpl.calls.push({ url, method: (init.method || "GET").toUpperCase(), init });
    if (String(url).endsWith("/status")) {
      return jsonResponse({ code: 0, data: { email: "r@e.com", leftDays: 2 } });
    }
    statusAttempts += 1;
    if (statusAttempts === 1) {
      return textResponse("slow down", 429);
    }
    return jsonResponse({ list: [{ change: 5, balance: 50 }] });
  };
  fetchImpl.calls = [];

  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: sampleCookie("retry") },
    logger: createLogger(),
    fetch: fetchImpl,
    sleep: async () => {},
  });
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.results[0].kind, "success");
  assert.ok(fetchImpl.calls.filter((c) => c.method === "POST").length >= 2);
}

async function testSkipRepeatWithinSameRun() {
  const cookie = sampleCookie("once");
  const accountResults = [];
  const fetchImpl = buildFetch([
    jsonResponse({ code: 0, data: { email: "once@example.com", leftDays: 5 } }),
    jsonResponse({ list: [{ change: 3, balance: 30 }] }),
  ]);
  const logger = createLogger();
  const env = { GLADOS_COOKIE: cookie };

  // First run of account
  const first = await runCheckin({
    env,
    logger,
    fetch: fetchImpl,
    sleep: async () => {},
  });
  accountResults.push(first.results[0]);

  // Direct checkinAccount path: mark _done and ensure skip
  const accounts = parseAccounts(cookie);
  accounts[0]._done = {
    kind: "success",
    message: "签到成功！",
    email: "on***e@example.com",
    remainingDays: 5,
    origin: GLADOS_ORIGINS[0],
  };
  const secondLogger = createLogger();
  const request = checkinCli.createRequester(async () => {
    throw new Error("should not request again");
  });
  const skipped = await checkinCli.checkinAccount(
    accounts[0],
    request,
    GLADOS_ORIGINS,
    secondLogger,
    [cookie]
  );
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.kind, "success");
  assert.match(secondLogger.all(), /跳过重复请求/);
  assert.equal(first.exitCode, 0);
  assert.equal(accountResults[0].kind, "success");
}

async function testLoginExpiredExitOne() {
  const fetchImpl = buildFetch([
    jsonResponse({ code: 0, data: { email: "z@z.com", leftDays: 1 } }),
    jsonResponse({ code: -2, message: "token error" }),
  ]);
  const outcome = await runCheckin({
    env: { GLADOS_COOKIE: sampleCookie("exp") },
    logger: createLogger(),
    fetch: fetchImpl,
    sleep: async () => {},
  });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.results[0].kind, "error");
}

async function testMainHelp() {
  const logger = createLogger();
  const code = await main(["--help"], { logger });
  assert.equal(code, 0);
  assert.match(logger.all(), /GLADOS_COOKIE/);
}

// --- workflow structure checks ---

function testWorkflowYamlStructure() {
  const workflowPath = path.join(__dirname, ".github/workflows/checkin.yml");
  const text = fs.readFileSync(workflowPath, "utf8");

  assert.match(text, /^name:\s*GLaDOS Check-in/m);
  assert.match(text, /workflow_dispatch:/);
  assert.match(text, /schedule:/);
  assert.match(text, /cron:\s*"15 23 \* \* \*"/);
  assert.match(text, /cron:\s*"15 7 \* \* \*"/);
  assert.match(text, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(text, /node-version:\s*24/);
  assert.match(text, /secrets\.GLADOS_COOKIE/);
  assert.match(text, /node cli\/checkin\.js/);
  assert.match(text, /北京时间|Beijing/i);
  assert.match(text, /07:15/);
  assert.match(text, /15:15/);
  // Must not hardcode real cookies
  assert.doesNotMatch(text, /koa:sess=[A-Za-z0-9._-]+/);
  // Minimal permissions only
  assert.doesNotMatch(text, /contents:\s*write/);
  assert.doesNotMatch(text, /permissions:\s*write-all/);
}

function testPackageScriptsAndVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
  assert.equal(pkg.version, "1.4.1");
  assert.match(pkg.scripts.test, /test-glados-actions/);
  assert.match(pkg.scripts["checkin"], /cli\/checkin\.js/);
}

function testExistingScriptsUseDynamicToken() {
  const surge = fs.readFileSync(path.join(__dirname, "glados.autosign.surge.js"), "utf8");
  const scriptcat = fs.readFileSync(
    path.join(__dirname, "glados.auto-checkin.scriptcat.user.js"),
    "utf8"
  );
  assert.match(surge, /token:\s*origin\.slice\("https:\/\/"\.length\)/);
  assert.match(scriptcat, /token:\s*origin\.slice\("https:\/\/"\.length\)/);
  assert.doesNotMatch(surge, /"token":\s*"glados\.(?:one|cloud)"/);
  assert.doesNotMatch(scriptcat, /token:\s*"glados\.(?:one|cloud)"/);
}

async function run() {
  const tests = [
    ["parseAccounts JSON array", testParseAccountsJsonArray],
    ["check-in token matches origin", testCheckinTokenMatchesOrigin],
    ["parseAccounts newline", testParseAccountsNewline],
    ["parseAccounts object array", testParseAccountsObjectArray],
    ["parseAccounts rejects empty", testParseAccountsRejectsEmpty],
    ["parseAccounts keeps & in cookie", testParseAccountsDoesNotSplitOnAmpersand],
    ["classifyCheckin outcomes", testClassifyCheckinOutcomes],
    ["redactSecrets", testRedactSecretsNeverLeaksCookie],
    ["already checked includes repeats", testIsAlreadyCheckedInIncludesRepeats],
    ["parseJsonBody strict", testParseJsonBodyStrict],
    ["missing secret", testMissingSecretFailsFast],
    ["invalid JSON secret", testInvalidJsonSecretFailsFast],
    ["successful single account", testSuccessfulSingleAccount],
    ["already checked exit 0", testAlreadyCheckedInExitZero],
    ["domain fallback same origin", testDomainFallbackSameOriginCheckin],
    ["forced origin", testForcedOrigin],
    ["multi-account partial failure", testMultiAccountPartialFailureExitOne],
    ["cookie not leaked on error", testCookieNotLeakedOnHttpErrorBody],
    ["retry on 429", testRetryOn429ThenSuccess],
    ["skip repeat within run", testSkipRepeatWithinSameRun],
    ["login expired exit 1", testLoginExpiredExitOne],
    ["main --help", testMainHelp],
    ["workflow YAML structure", testWorkflowYamlStructure],
    ["package scripts/version", testPackageScriptsAndVersion],
    ["existing scripts dynamic token", testExistingScriptsUseDynamicToken],
  ];

  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  // Sanity: module is loadable via file URL path style used in docs
  assert.ok(pathToFileURL(path.join(__dirname, "cli/checkin.js")).href);

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nAll ${tests.length} Actions/CLI tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
