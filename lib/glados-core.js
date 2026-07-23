/**
 * Shared GLaDOS check-in logic for Node CLI / GitHub Actions.
 * Extracted and aligned with the mature ScriptCat / Surge validation rules.
 *
 * The check-in body token must match the hostname receiving the request.
 * This mirrors the official web client observed on 2026-07-18.
 */

"use strict";

const GLADOS_ORIGINS = Object.freeze([
  "https://glados.cloud",
  "https://glados.network",
  "https://glados.rocks",
  "https://glados.one",
  "https://glados.space",
  "https://glados.vip",
  "https://glados-facility.com",
]);

/** Historical probe order used by the browser userscript (network first). */
const GLADOS_ORIGINS_LEGACY = Object.freeze([
  "https://glados.network",
  "https://glados.rocks",
  "https://glados.one",
  "https://glados.space",
  "https://glados.cloud",
  "https://glados.vip",
  "https://glados-facility.com",
]);

const MAX_REQUEST_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SECRET_ENV_KEYS = Object.freeze(["GLADOS_COOKIE", "GLADOS_COOKIES"]);

function checkinTokenForOrigin(origin) {
  const normalized = String(origin || "").trim().replace(/\/$/, "");
  if (!GLADOS_ORIGINS.includes(normalized)) {
    throw new Error(`无法为不受支持的 GLaDOS 域名生成签到 token：${normalized || "空值"}`);
  }
  return normalized.slice("https://".length);
}

function formatPoints(value) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
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

function parseJsonBody(body) {
  try {
    const result = typeof body === "string" ? JSON.parse(body || "") : body;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("响应不是 JSON 对象");
    }
    return result;
  } catch (error) {
    throw new Error("GLaDOS 返回了无法解析的数据");
  }
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

  return (
    code === 1 ||
    message.includes("please try tomorrow") ||
    message.includes("today's observation logged") ||
    message.includes("return tomorrow") ||
    message.includes("already check") ||
    message.includes("checkin repeats") ||
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
    const earned =
      record && record.change !== undefined ? `今日签到获得${formatPoints(record.change)}积分` : "";
    const total =
      record && record.balance !== undefined ? `当前共${formatPoints(record.balance)}积分` : "";
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
  if (code === 0 && /(?:success|成功|checkin)/i.test(detail) && !/via\s+https?:\/\//i.test(detail)) {
    return { kind: "success", message: `签到成功！${detail ? `\n${detail}` : ""}` };
  }

  // Reject redirect-style failures caused by a token/origin mismatch.
  if (/please checkin via/i.test(detail)) {
    throw new Error(`签到接口返回异常：${detail}（请确认 check-in token 与请求域名一致）`);
  }

  throw new Error(`签到接口返回异常${detail ? `：${detail}` : ""}`);
}

function shouldRetry(error) {
  const status = Number(error && error.status) || 0;
  return !status || status === 429 || status >= 500;
}

function httpErrorMessage(status) {
  const code = Number(status) || 0;
  if (code === 401 || code === 403) {
    return "登录凭据已失效";
  }
  if (code === 429) {
    return "请求过于频繁（HTTP 429）";
  }
  if (code >= 500) {
    return `GLaDOS 服务暂时异常（HTTP ${code}）`;
  }
  return `请求失败（HTTP ${code || "未知"}）`;
}

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status || 0;
  return error;
}

/**
 * Parse one or more account credentials from a secret string.
 * Supported formats (preferred first):
 *   1. JSON array of cookie strings: ["cookie1", "cookie2"]
 *   2. JSON array of objects: [{"cookie":"...","name":"work","origin":"https://glados.cloud"}, ...]
 *   3. Newline-separated cookies (one account per line)
 *   4. Single cookie string
 *
 * Delimiters like "&" are intentionally NOT used — cookies may contain "&".
 */
function parseAccounts(raw) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) {
    throw new Error(
      "缺少 GLaDOS Cookie：请设置 Repository Secret `GLADOS_COOKIE`（或环境变量 GLADOS_COOKIE）"
    );
  }

  if (text.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("GLADOS_COOKIE JSON 数组格式无效，请使用 [\"cookie1\", \"cookie2\"]");
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("GLADOS_COOKIE JSON 数组不能为空");
    }
    return parsed.map((item, index) => normalizeAccountEntry(item, index));
  }

  if (text.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("GLADOS_COOKIE JSON 对象格式无效");
    }
    return [normalizeAccountEntry(parsed, 0)];
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length === 0) {
    throw new Error("GLADOS_COOKIE 仅包含空行或注释，未解析到有效账号");
  }

  return lines.map((line, index) => normalizeAccountEntry(line, index));
}

function normalizeAccountEntry(entry, index) {
  const label = `账号${index + 1}`;

  if (typeof entry === "string") {
    const cookie = entry.trim();
    if (!cookie) {
      throw new Error(`${label} 的 Cookie 为空`);
    }
    assertCookieLooksValid(cookie, label);
    return { name: label, cookie, authorization: "", origin: "" };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`${label} 格式无效：需要 Cookie 字符串或 { "cookie": "..." } 对象`);
  }

  const cookie = String(entry.cookie || entry.Cookie || "").trim();
  const authorization = String(entry.authorization || entry.Authorization || "").trim();
  const name = String(entry.name || entry.label || label).trim() || label;
  const rawOrigin = String(entry.origin || entry.Origin || "").trim().replace(/\/$/, "");
  const origin = rawOrigin
    ? GLADOS_ORIGINS.find((item) => item.toLowerCase() === rawOrigin.toLowerCase())
    : "";

  if (!cookie && !authorization) {
    throw new Error(`${name} 缺少 cookie（或 authorization）`);
  }
  if (cookie) {
    assertCookieLooksValid(cookie, name);
  }
  if (rawOrigin && !origin) {
    throw new Error(`${name} 的 origin 不受支持：${rawOrigin}（允许：${GLADOS_ORIGINS.join(", ")}）`);
  }

  return { name, cookie, authorization, origin };
}

function assertCookieLooksValid(cookie, label) {
  // Soft validation: real cookies vary; fail fast only on clearly broken values.
  if (cookie.length < 8) {
    throw new Error(`${label} 的 Cookie 过短，请检查 Secret 是否完整`);
  }
  if (/[\r\n]/.test(cookie)) {
    throw new Error(`${label} 的 Cookie 含有换行，请改用 JSON 数组或每行一个完整 Cookie`);
  }
}

/**
 * Redact known secrets and common cookie/token patterns from log text.
 */
function redactSecrets(text, secrets = []) {
  let output = String(text == null ? "" : text);

  for (const secret of secrets) {
    const value = String(secret || "").trim();
    if (value.length >= 4) {
      output = output.split(value).join("[REDACTED]");
    }
  }

  // Cookie header fragments and session pairs
  output = output.replace(/koa:sess\.sig=[^;\s"']+/gi, "koa:sess.sig=[REDACTED]");
  output = output.replace(/koa:sess=[^;\s"']+/gi, "koa:sess=[REDACTED]");
  output = output.replace(/(?:^|;\s*)([a-zA-Z0-9_.:-]+=)([^;\s"']{8,})/g, "$1[REDACTED]");
  output = output.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  output = output.replace(
    /("cookie"\s*:\s*")([^"]+)(")/gi,
    '$1[REDACTED]$3'
  );

  return output;
}

function buildCheckinHeaders(origin, cookie, authorization) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: origin,
    Referer: `${origin}/console/checkin`,
    "User-Agent": USER_AGENT,
  };
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (authorization) {
    headers.Authorization = authorization;
  }
  return headers;
}

function buildStatusHeaders(origin, cookie, authorization) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    Origin: origin,
    Referer: `${origin}/console`,
    "User-Agent": USER_AGENT,
  };
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (authorization) {
    headers.Authorization = authorization;
  }
  return headers;
}

function isSuccessfulOutcome(kind) {
  return kind === "success" || kind === "already_checked";
}

module.exports = {
  GLADOS_ORIGINS,
  GLADOS_ORIGINS_LEGACY,
  checkinTokenForOrigin,
  MAX_REQUEST_ATTEMPTS,
  RETRY_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
  SECRET_ENV_KEYS,
  formatPoints,
  maskEmail,
  parseJsonBody,
  isLoginError,
  isAlreadyCheckedIn,
  classifyCheckin,
  shouldRetry,
  httpErrorMessage,
  createHttpError,
  parseAccounts,
  normalizeAccountEntry,
  assertCookieLooksValid,
  redactSecrets,
  buildCheckinHeaders,
  buildStatusHeaders,
  isSuccessfulOutcome,
};
