const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SECRET_KEYS = [/password/i, /token/i, /secret/i, /key/i, /authorization/i, /cookie/i];

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeString(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, 20000);
}

function sanitizeObject(value, depth = 0) {
  if (depth > 12) return null;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizeObject(item, depth + 1));
  if (isPlainObject(value)) {
    const clean = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) continue;
      clean[sanitizeString(key).slice(0, 120)] = sanitizeObject(item, depth + 1);
    }
    return clean;
  }
  if (typeof value === "string") return sanitizeString(value);
  return value;
}

function maskSensitive(value) {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = SECRET_KEYS.some((pattern) => pattern.test(key)) ? "********" : maskSensitive(item);
    }
    return out;
  }
  return value;
}

function normalizeDomain(value) {
  const domain = String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    const error = new Error("Enter a valid domain name");
    error.status = 422;
    error.code = "INVALID_DOMAIN";
    throw error;
  }
  return domain;
}

function safeName(value, fallback = "item") {
  return String(value || fallback).trim().replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 80) || fallback;
}

module.exports = { sanitizeObject, maskSensitive, normalizeDomain, safeName };
