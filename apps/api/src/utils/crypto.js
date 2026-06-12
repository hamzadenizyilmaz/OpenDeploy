const crypto = require("crypto");

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function maskSecret(value) {
  if (!value) return value;
  const s = String(value);
  if (s.length <= 8) return "********";
  return `${s.slice(0, 3)}********${s.slice(-3)}`;
}

function randomSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { sha256, maskSecret, randomSecret };
