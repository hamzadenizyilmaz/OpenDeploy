const crypto = require("crypto");

const AES_KEY_BYTES = 32;
const IV_BYTES = 12;

function randomAes256Key() {
  return crypto.randomBytes(AES_KEY_BYTES);
}

function aes256GcmEncrypt(plaintext, key, aad = "") {
  const normalizedKey = Buffer.isBuffer(key) ? key : Buffer.from(key, "base64");
  if (normalizedKey.length !== AES_KEY_BYTES) throw new Error("AES-256-GCM requires a 32 byte key");
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", normalizedKey, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "AES-256-GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

function aes256GcmDecrypt(payload, key, aad = "") {
  const normalizedKey = Buffer.isBuffer(key) ? key : Buffer.from(key, "base64");
  if (normalizedKey.length !== AES_KEY_BYTES) throw new Error("AES-256-GCM requires a 32 byte key");
  const decipher = crypto.createDecipheriv("aes-256-gcm", normalizedKey, Buffer.from(payload.iv, "base64"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function generateRsaKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicExponent: 0x10001,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
}

function generateEccKeyPair(namedCurve = "prime256v1") {
  return crypto.generateKeyPairSync("ec", {
    namedCurve,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
}

function rsaWrapKey(key, publicKey) {
  return crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.isBuffer(key) ? key : Buffer.from(key, "base64")
  ).toString("base64");
}

function rsaUnwrapKey(wrappedKey, privateKey) {
  return crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    Buffer.from(wrappedKey, "base64")
  );
}

function envelopeEncrypt(plaintext, publicKey, aad = "") {
  const dataKey = randomAes256Key();
  return {
    version: 1,
    keyAlg: "RSA-OAEP-SHA256",
    wrappedKey: rsaWrapKey(dataKey, publicKey),
    data: aes256GcmEncrypt(plaintext, dataKey, aad)
  };
}

function envelopeDecrypt(payload, privateKey, aad = "") {
  const dataKey = rsaUnwrapKey(payload.wrappedKey, privateKey);
  return aes256GcmDecrypt(payload.data, dataKey, aad);
}

function generateNumericOtp(length = 6) {
  const digits = Math.max(6, Math.min(10, Number(length || 6)));
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, "0");
}

function hashOtp(otp, secret) {
  return crypto.createHmac("sha256", Buffer.from(String(secret), "utf8")).update(String(otp)).digest("hex");
}

function verifyOtp(otp, expectedHash, secret) {
  const next = hashOtp(otp, secret);
  const left = Buffer.from(next, "hex");
  const right = Buffer.from(String(expectedHash || ""), "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = {
  aes256GcmDecrypt,
  aes256GcmEncrypt,
  envelopeDecrypt,
  envelopeEncrypt,
  generateEccKeyPair,
  generateNumericOtp,
  generateRsaKeyPair,
  hashOtp,
  randomAes256Key,
  rsaUnwrapKey,
  rsaWrapKey,
  verifyOtp
};
