const crypto = require("crypto");
const { env } = require("../config/env");
const {
  aes256GcmDecrypt,
  aes256GcmEncrypt,
  envelopeDecrypt,
  envelopeEncrypt
} = require("./cryptoSuite");

const marker = "opendeploy.secret.v1";

function decodeKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) return base64;
  const hex = Buffer.from(raw, "hex");
  if (hex.length === 32) return hex;
  throw new Error("OPENDEPLOY_ENCRYPTION_KEY must be a 32 byte base64 or hex value.");
}

function fallbackDevKey() {
  return crypto.createHash("sha256").update(`${env.jwtAccessSecret}:opendeploy-secret-vault`).digest();
}

function masterKey() {
  return decodeKey(env.encryptionKey) || fallbackDevKey();
}

function isEncryptedSecret(value) {
  return Boolean(value && typeof value === "object" && value.__type === marker);
}

function encryptSecret(value, aad = "") {
  const plaintext = String(value ?? "");
  if (env.envelopePublicKey) {
    return {
      __type: marker,
      mode: "envelope-rsa-oaep-sha256",
      payload: envelopeEncrypt(plaintext, env.envelopePublicKey, aad)
    };
  }
  return {
    __type: marker,
    mode: "aes-256-gcm",
    payload: aes256GcmEncrypt(plaintext, masterKey(), aad)
  };
}

function decryptSecret(value, aad = "") {
  if (!isEncryptedSecret(value)) return String(value ?? "");
  if (value.mode === "envelope-rsa-oaep-sha256") {
    if (!env.envelopePrivateKey) throw new Error("OPENDEPLOY_ENVELOPE_PRIVATE_KEY is required to decrypt envelope secrets.");
    return envelopeDecrypt(value.payload, env.envelopePrivateKey, aad);
  }
  if (value.mode === "aes-256-gcm") return aes256GcmDecrypt(value.payload, masterKey(), aad);
  throw new Error("Unsupported encrypted secret payload.");
}

function maskSecretValue(value) {
  if (!value) return "";
  return "********";
}

module.exports = {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
  maskSecretValue
};
