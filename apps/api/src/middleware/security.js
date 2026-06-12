const crypto = require("crypto");
const { sanitizeObject } = require("../utils/security");
const { fail } = require("../utils/response");

function requestId(req, res, next) {
  const provided = String(req.headers["x-request-id"] || "");
  req.id = /^[a-zA-Z0-9._:-]{8,120}$/.test(provided) ? provided : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

function sanitizePayload(req, res, next) {
  try {
    if (req.body && typeof req.body === "object") req.body = sanitizeObject(req.body);
    if (req.query && typeof req.query === "object") req.query = sanitizeObject(req.query);
    if (req.params && typeof req.params === "object") req.params = sanitizeObject(req.params);
    return next();
  } catch (error) {
    return fail(res, 400, "Invalid request payload", "INVALID_PAYLOAD");
  }
}

function securityEvents(req, res, next) {
  const suspicious = ["<script", "javascript:", "onerror=", "onload=", "../", "..\\", "\u0000"];
  const raw = JSON.stringify({ body: req.body, query: req.query }).toLowerCase();
  req.securityFlags = suspicious.filter((needle) => raw.includes(needle));
  next();
}

module.exports = { requestId, sanitizePayload, securityEvents };
