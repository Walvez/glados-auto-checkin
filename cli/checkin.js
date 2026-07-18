#!/usr/bin/env node
/**
 * GLaDOS auto check-in CLI for local runs and GitHub Actions.
 *
 * Env:
 *   GLADOS_COOKIE   Required. One cookie, newline-separated cookies, or JSON array.
 *   GLADOS_COOKIES  Alias of GLADOS_COOKIE.
 *   GLADOS_ORIGIN   Optional. Default origin override for accounts without their own origin.
 *
 * Exit codes:
 *   0 — every account succeeded or was already checked in
 *   1 — missing/invalid secret, or any account failed
 */

"use strict";

const core = require("../lib/glados-core");

const {
  GLADOS_ORIGINS,
  checkinTokenForOrigin,
  MAX_REQUEST_ATTEMPTS,
  RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  parseAccounts,
  parseJsonBody,
  classifyCheckin,
  shouldRetry,
  httpErrorMessage,
  createHttpError,
  redactSecrets,
  buildCheckinHeaders,
  buildStatusHeaders,
  maskEmail,
  isSuccessfulOutcome,
} = core;

function defaultLogger() {
  return {
    info: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a low-level request function around fetch (or a test double).
 * Never logs cookie values.
 */
function createRequester(fetchImpl, options = {}) {
  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const sleep = options.sleep || defaultSleep;

  return async function request(method, url, init = {}) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer =
        controller && timeoutMs > 0
          ? setTimeout(() => controller.abort(), timeoutMs)
          : null;

      try {
        const response = await fetchImpl(url, {
          method,
          headers: init.headers || {},
          body: init.body,
          signal: controller ? controller.signal : undefined,
        });

        const status = Number(response.status) || 0;
        const text = typeof response.text === "function" ? await response.text() : "";

        if (status < 200 || status >= 300) {
          throw createHttpError(httpErrorMessage(status), status);
        }

        let json = null;
        if (text) {
          json = parseJsonBody(text);
        }
        return { status, body: text, json };
      } catch (error) {
        if (error && error.name === "AbortError") {
          lastError = createHttpError("网络请求超时", 0);
        } else if (error && error.status) {
          lastError = error;
        } else if (error && /无法解析|无效/.test(String(error.message || ""))) {
          lastError = error;
          // Parse errors are not retried as network failures unless no status
          break;
        } else {
          lastError = createHttpError(
            error && error.message ? error.message : "网络请求失败",
            error && error.status ? error.status : 0
          );
        }

        if (attempt < MAX_REQUEST_ATTEMPTS && shouldRetry(lastError)) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        break;
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    }

    throw lastError || createHttpError("网络请求失败", 0);
  };
}

function resolveOrigins(env) {
  const forced = String(env.GLADOS_ORIGIN || "").trim().replace(/\/$/, "");
  if (forced) {
    const match = GLADOS_ORIGINS.find((origin) => origin.toLowerCase() === forced.toLowerCase());
    if (!match) {
      throw new Error(
        `GLADOS_ORIGIN 不受支持：${forced}（允许：${GLADOS_ORIGINS.join(", ")}）`
      );
    }
    return [match];
  }
  return [...GLADOS_ORIGINS];
}

function readCookieSecret(env) {
  const raw = env.GLADOS_COOKIE != null ? env.GLADOS_COOKIE : env.GLADOS_COOKIES;
  return raw;
}

/**
 * Probe origins until /api/user/status reports a logged-in session.
 * Check-in always uses the same origin that answered successfully.
 */
async function findLoggedInSession(account, request, origins) {
  let lastError = null;
  let loginMessage = "";
  const accountOrigins = account.origin ? [account.origin] : origins;

  for (const origin of accountOrigins) {
    try {
      const response = await request("GET", `${origin}/api/user/status`, {
        headers: buildStatusHeaders(origin, account.cookie, account.authorization),
      });
      const status = response.json;
      if (status && status.code === 0 && status.data) {
        return { origin, status };
      }
      loginMessage = (status && status.message) || loginMessage;
      lastError = createHttpError(status && status.message ? status.message : "未登录", 0);
    } catch (error) {
      lastError = error;
      // 401/403 on one domain does not stop probing others (cookies are not shared).
    }
  }

  if (loginMessage) {
    throw createHttpError(`需要登录：${loginMessage}`, lastError && lastError.status);
  }
  if (lastError) {
    throw lastError;
  }
  throw createHttpError("所有 GLaDOS 主站域名均未读取到登录状态", 0);
}

/**
 * Check in one account. Successful or already-checked outcomes are not repeated
 * within the same account object (`account._done`).
 */
async function checkinAccount(account, request, origins, logger, secrets) {
  if (account._done) {
    logger.info(`[${account.name}] 本次运行已成功/已签到，跳过重复请求`);
    return {
      name: account.name,
      kind: account._done.kind,
      message: account._done.message,
      email: account._done.email,
      remainingDays: account._done.remainingDays,
      origin: account._done.origin,
      skipped: true,
    };
  }

  const { origin, status } = await findLoggedInSession(account, request, origins);
  const email = maskEmail(status.data && status.data.email);
  const remaining = Number.parseInt(status.data && status.data.leftDays, 10);
  const remainingDays = Number.isFinite(remaining) ? remaining : null;

  logger.info(`[${account.name}] 使用域名 ${origin}（账户 ${email}）`);

  const checkinResponse = await request("POST", `${origin}/api/user/checkin`, {
    headers: buildCheckinHeaders(origin, account.cookie, account.authorization),
    body: JSON.stringify({ token: checkinTokenForOrigin(origin) }),
  });

  let classified;
  try {
    classified = classifyCheckin(checkinResponse.json);
  } catch (error) {
    throw createHttpError(error.message || String(error), 0);
  }

  if (classified.kind === "login_expired") {
    throw createHttpError(`${classified.message}，请更新 GitHub Secret 中的 Cookie`, 401);
  }

  const remainingText = remainingDays != null ? `\n剩余${remainingDays}天` : "";
  const summary = `${classified.message}${remainingText}`;

  account._done = {
    kind: classified.kind,
    message: summary,
    email,
    remainingDays,
    origin,
  };

  logger.info(
    redactSecrets(`[${account.name}] ${email} · ${summary.replace(/\n/g, "，")}`, secrets)
  );

  return {
    name: account.name,
    kind: classified.kind,
    message: summary,
    email,
    remainingDays,
    origin,
    skipped: false,
  };
}

/**
 * Main entry used by CLI and tests.
 * @returns {{ ok: boolean, results: object[], exitCode: number }}
 */
async function runCheckin(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || defaultLogger();
  const sleep = options.sleep || defaultSleep;
  const fetchImpl = options.fetch || globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("当前 Node 环境不支持 fetch，请使用 Node.js 18+（推荐当前 LTS）");
  }

  const secrets = [];
  const rawSecret = readCookieSecret(env);
  if (rawSecret != null && String(rawSecret).trim()) {
    secrets.push(String(rawSecret));
  }

  let accounts;
  try {
    accounts = parseAccounts(rawSecret);
  } catch (error) {
    const message = redactSecrets(error.message || String(error), secrets);
    logger.error(message);
    return { ok: false, results: [], exitCode: 1, error: message };
  }

  for (const account of accounts) {
    if (account.cookie) {
      secrets.push(account.cookie);
    }
    if (account.authorization) {
      secrets.push(account.authorization);
    }
  }

  let origins;
  try {
    origins = resolveOrigins(env);
  } catch (error) {
    const message = redactSecrets(error.message || String(error), secrets);
    logger.error(message);
    return { ok: false, results: [], exitCode: 1, error: message };
  }

  const request = createRequester(fetchImpl, { sleep, timeoutMs: options.timeoutMs });
  const results = [];
  let failed = 0;

  logger.info(`GLaDOS 签到开始：${accounts.length} 个账号，候选域名 ${origins.length} 个`);

  for (const account of accounts) {
    try {
      const result = await checkinAccount(account, request, origins, logger, secrets);
      results.push(result);
      if (!isSuccessfulOutcome(result.kind)) {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      const status = error && error.status ? ` (HTTP ${error.status})` : "";
      const message = redactSecrets(
        `[${account.name}] 签到失败${status}：${error.message || String(error)}`,
        secrets
      );
      logger.error(message);
      results.push({
        name: account.name,
        kind: "error",
        message,
        email: null,
        remainingDays: null,
        origin: null,
        skipped: false,
      });
    }
  }

  const ok = failed === 0;
  const successCount = results.filter((item) => isSuccessfulOutcome(item.kind)).length;
  logger.info(`GLaDOS 签到结束：成功/已签到 ${successCount}/${accounts.length}`);

  return {
    ok,
    results,
    exitCode: ok ? 0 : 1,
    successCount,
    total: accounts.length,
  };
}

async function main(argv = process.argv.slice(2), options = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    const help = [
      "Usage: node cli/checkin.js",
      "",
      "Environment:",
      "  GLADOS_COOKIE   Cookie secret (JSON array, newline-separated, or single cookie)",
      "  GLADOS_COOKIES  Alias of GLADOS_COOKIE",
      "  GLADOS_ORIGIN   Optional default origin for entries without an origin field",
      "",
      "Exit codes: 0 success/already-checked for all accounts; 1 otherwise",
    ].join("\n");
    (options.logger || defaultLogger()).info(help);
    return 0;
  }

  const outcome = await runCheckin(options);
  return outcome.exitCode;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(redactSecrets(error && error.message ? error.message : String(error)));
      process.exitCode = 1;
    });
}

module.exports = {
  main,
  runCheckin,
  createRequester,
  findLoggedInSession,
  checkinAccount,
  resolveOrigins,
  readCookieSecret,
  defaultLogger,
};
