const bcrypt = require("bcryptjs");
const { Algorithm, hash, verify } = require("@node-rs/argon2");

const argonOptions = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1
};

function isArgon2id(hashValue) {
  return typeof hashValue === "string" && hashValue.startsWith("$argon2id$");
}

async function hashPassword(password) {
  return hash(password, argonOptions);
}

async function verifyPassword(password, passwordHash) {
  if (isArgon2id(passwordHash)) {
    return verify(passwordHash, password, argonOptions);
  }
  return bcrypt.compare(password, passwordHash);
}

function needsRehash(passwordHash) {
  return !isArgon2id(passwordHash);
}

function passwordPolicyIssues(password, policy = {}) {
  const value = String(password || "");
  const minLength = Number(policy.minLength || 12);
  const issues = [];
  if (value.length < minLength) issues.push(`Password must be at least ${minLength} characters.`);
  if ((policy.requireLowercase ?? true) && !/[a-z]/.test(value)) issues.push("Password must include a lowercase letter.");
  if ((policy.requireUppercase ?? true) && !/[A-Z]/.test(value)) issues.push("Password must include an uppercase letter.");
  if ((policy.requireNumbers ?? true) && !/[0-9]/.test(value)) issues.push("Password must include a number.");
  if ((policy.requireSymbols ?? true) && !/[^A-Za-z0-9]/.test(value)) issues.push("Password must include a symbol.");
  if (/\s/.test(value)) issues.push("Password must not contain whitespace.");
  return issues;
}

function isStrongPassword(password, policy = {}) {
  return passwordPolicyIssues(password, policy).length === 0;
}

module.exports = { hashPassword, isStrongPassword, needsRehash, passwordPolicyIssues, verifyPassword };
