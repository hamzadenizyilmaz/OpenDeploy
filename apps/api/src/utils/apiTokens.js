const { Algorithm, hash, verify } = require("@node-rs/argon2");
const { sha256 } = require("./crypto");

const argonOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1
};

function parseApiToken(token) {
  const value = String(token || "");
  const match = value.match(/^od_([^_]{8,80})_(.{32,})$/);
  return match ? { id: match[1], value } : { id: null, value };
}

function isArgon2id(value) {
  return String(value || "").startsWith("$argon2id$");
}

async function hashApiToken(token) {
  return hash(String(token || ""), argonOptions);
}

async function verifyApiToken(token, tokenHash) {
  if (isArgon2id(tokenHash)) return verify(tokenHash, String(token || ""), argonOptions);
  return sha256(token) === tokenHash;
}

module.exports = { hashApiToken, parseApiToken, verifyApiToken };
