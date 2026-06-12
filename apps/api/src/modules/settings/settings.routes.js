const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { env } = require("../../config/env");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { maskSensitive } = require("../../utils/security");
const { encryptSecret, isEncryptedSecret, maskSecretValue } = require("../../utils/secretVault");

const definitions = [
  { key: "panel.defaultProxy", value: "nginx", type: "select", options: ["nginx", "apache"], group: "Panel", description: "Default reverse proxy provider." },
  { key: "panel.defaultTheme", value: "system", type: "select", options: ["system", "light", "dark"], group: "Panel", description: "Default UI theme mode." },
  { key: "security.require2FA", value: false, type: "boolean", group: "Security", description: "Force TOTP for privileged accounts." },
  { key: "security.sessionMinutes", value: 60, type: "number", min: 5, max: 1440, group: "Security", description: "Target access session duration in minutes." },
  { key: "security.allowedOrigins", value: [], type: "csv", group: "Security", description: "Extra trusted browser origins for integrations." },
  { key: "waf.enabled", value: true, type: "boolean", group: "WAF Rules", description: "Enable application firewall enforcement for panel and API routes." },
  { key: "waf.mode", value: "blocking", type: "select", options: ["monitoring", "challenge", "blocking"], group: "WAF Rules", description: "Default WAF action mode for high-confidence threats." },
  { key: "waf.owaspCrs", value: true, type: "boolean", group: "WAF Rules", description: "Enable OWASP Core Rule Set style protections for XSS, SQLi, LFI, RFI and protocol abuse." },
  { key: "waf.adminRoutesStrict", value: true, type: "boolean", group: "WAF Rules", description: "Apply strict WAF thresholds to login, setup, terminal, SQL, DNS, firewall and update routes." },
  { key: "waf.blockedCountries", value: [], type: "csv", group: "WAF Rules", description: "Country codes to block at the WAF layer for admin endpoints." },
  { key: "advancedRules.botScoring", value: true, type: "boolean", group: "Advanced Rules", description: "Score clients using header, TLS, browser and behavior signals." },
  { key: "advancedRules.requestSmuggling", value: true, type: "boolean", group: "Advanced Rules", description: "Block ambiguous Content-Length and Transfer-Encoding request patterns." },
  { key: "advancedRules.headerSanitizer", value: true, type: "boolean", group: "Advanced Rules", description: "Validate Host, Origin, Forwarded and Upgrade headers before proxy routing." },
  { key: "advancedRules.pathNormalization", value: true, type: "boolean", group: "Advanced Rules", description: "Normalize URL paths and reject traversal, null byte and mixed encoding attacks." },
  { key: "advancedRules.torExitPolicy", value: "challenge", type: "select", options: ["allow", "challenge", "block"], group: "Advanced Rules", description: "Action for TOR exit nodes and high-risk anonymity networks." },
  { key: "rateLimiting.loginPer5Min", value: 8, type: "number", min: 1, max: 100, group: "Rate Limiting", description: "Maximum login attempts per IP and email pair in five minutes." },
  { key: "rateLimiting.apiPerMinute", value: 600, type: "number", min: 60, max: 10000, group: "Rate Limiting", description: "Maximum API key requests per minute before throttling." },
  { key: "rateLimiting.terminalPerMinute", value: 40, type: "number", min: 5, max: 500, group: "Rate Limiting", description: "Maximum terminal or SQL console actions per user per minute." },
  { key: "rateLimiting.challengeAfterFailures", value: 3, type: "number", min: 1, max: 20, group: "Rate Limiting", description: "Failed auth attempts before a managed challenge is required." },
  { key: "challenge.provider", value: "turnstile", type: "select", options: ["turnstile", "recaptcha", "hcaptcha", "internal"], group: "Challenge Settings", description: "Challenge provider for suspicious admin and API traffic." },
  { key: "challenge.siteKey", value: "", type: "string", group: "Challenge Settings", description: "Public site key for the selected challenge provider." },
  { key: "challenge.secretKey", value: "", type: "secret", group: "Challenge Settings", description: "Secret key for challenge verification." },
  { key: "challenge.clearanceMinutes", value: 30, type: "number", min: 1, max: 1440, group: "Challenge Settings", description: "How long a successful challenge clearance remains valid." },
  { key: "challenge.failClosed", value: true, type: "boolean", group: "Challenge Settings", description: "Deny protected traffic when the challenge provider cannot be verified." },
  { key: "dns.nameservers", value: env.dnsNameservers, type: "csv", group: "DNS", description: "Authoritative nameserver hostnames displayed to users." },
  { key: "dns.defaultTtl", value: 300, type: "number", min: 60, max: 86400, group: "DNS", description: "Default TTL for new DNS records." },
  { key: "dns.cloudEnabled", value: env.dnsCloud.enabled, type: "boolean", group: "DNS", description: "Use the configured DNS Cloud API instead of a local authoritative DNS-only module." },
  { key: "dns.cloudMode", value: env.dnsCloud.mode, type: "select", options: ["creartsoft", "self-hosted"], group: "DNS", description: "DNS Cloud operating model for this OpenDeploy installation." },
  { key: "dns.managementHost", value: env.dnsCloud.adminUrl.replace(/^https?:\/\//, ""), type: "string", group: "DNS", description: "Public DNS management panel host for delegated customers." },
  { key: "dns.defaultPrimaryNs", value: env.dnsCloud.defaultNs1, type: "string", group: "DNS", description: "Default primary OpenDeploy nameserver shown to customers." },
  { key: "dns.defaultSecondaryNs", value: env.dnsCloud.defaultNs2, type: "string", group: "DNS", description: "Default secondary OpenDeploy nameserver shown to customers." },
  { key: "database.queryTimeoutMs", value: 15000, type: "number", min: 1000, max: 120000, group: "Database", description: "Max SQL query execution time." },
  { key: "database.maxResultLimit", value: 1000, type: "number", min: 10, max: 5000, group: "Database", description: "Max rows returned by SQL Console." },
  { key: "backups.defaultTarget", value: "local", type: "select", options: ["local", "sftp", "ftp", "s3", "minio", "cloudflare_r2"], group: "Backup Settings", description: "Default backup destination." },
  { key: "backups.encryptByDefault", value: true, type: "boolean", group: "Backup Settings", description: "Encrypt new backups by default." },
  { key: "backups.encryptionMode", value: "aes-256-gcm", type: "select", options: ["aes-256-gcm", "envelope", "none"], group: "Backup Settings", description: "Encryption mode for new backup archives." },
  { key: "backups.retentionDays", value: 30, type: "number", min: 1, max: 3650, group: "Backup Settings", description: "Default retention period for backup artifacts." },
  { key: "backups.verifyAfterWrite", value: true, type: "boolean", group: "Backup Settings", description: "Verify backup archive integrity after write or upload." },
  { key: "backups.remotePath", value: "/opendeploy", type: "string", group: "Backup Settings", description: "Default remote path or bucket prefix for external backups." },
  { key: "backups.s3Endpoint", value: "", type: "string", group: "Backup Settings", description: "S3-compatible endpoint for MinIO, R2 or custom providers." },
  { key: "backups.s3Bucket", value: "", type: "string", group: "Backup Settings", description: "Default object storage bucket for backup uploads." },
  { key: "backups.accessKeyId", value: "", type: "string", group: "Backup Settings", description: "Access key ID for external backup provider." },
  { key: "backups.secretAccessKey", value: "", type: "secret", group: "Backup Settings", description: "Secret access key for external backup provider." },
  { key: "smtp.enabled", value: false, type: "boolean", group: "SMTP Settings", description: "Enable SMTP email delivery for alerts and reports." },
  { key: "smtp.host", value: "smtp.example.com", type: "string", group: "SMTP Settings", description: "SMTP server hostname." },
  { key: "smtp.port", value: 587, type: "number", min: 1, max: 65535, group: "SMTP Settings", description: "SMTP server port." },
  { key: "smtp.secure", value: false, type: "boolean", group: "SMTP Settings", description: "Use implicit TLS for SMTP connections." },
  { key: "smtp.username", value: "", type: "string", group: "SMTP Settings", description: "SMTP username." },
  { key: "smtp.password", value: "", type: "secret", group: "SMTP Settings", description: "SMTP password or app token." },
  { key: "smtp.from", value: "OpenDeploy <noreply@example.com>", type: "string", group: "SMTP Settings", description: "Default From header for OpenDeploy notifications." },
  { key: "smtp.replyTo", value: "admin@example.com", type: "string", group: "SMTP Settings", description: "Reply-To address for operational email." },
  { key: "smtp.tlsRejectUnauthorized", value: true, type: "boolean", group: "SMTP Settings", description: "Reject invalid SMTP TLS certificates." },
  { key: "notifications.email.enabled", value: false, type: "boolean", group: "Notifications", description: "Enable email notifications." },
  { key: "notifications.email.from", value: "opendeploy@example.com", type: "string", group: "Notifications", description: "Sender address for notification email." },
  { key: "notifications.telegram.enabled", value: false, type: "boolean", group: "Notifications", description: "Enable Telegram bot notifications." },
  { key: "notifications.telegram.botToken", value: "", type: "secret", group: "Notifications", description: "Telegram bot token stored as a sensitive setting." },
  { key: "updates.autoNotify", value: true, type: "boolean", group: "Updates", description: "Notify when server or software updates are available." },
  { key: "updates.githubRepo", value: "hamzadenizyilmaz/OpenDeploy", type: "string", group: "Updates", description: "GitHub owner/repository used for OpenDeploy release checks." },
  { key: "updates.requireBackup", value: true, type: "boolean", group: "Updates", description: "Require a backup before update jobs." }
];

const definitionsByKey = new Map(definitions.map((item) => [item.key, item]));

const settingDto = z.object({
  key: z.string().min(2).max(120).regex(/^[a-zA-Z0-9._-]+$/),
  value: z.any()
});

function parseCsv(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function cleanString(value, max = 500) {
  const text = String(value ?? "").trim();
  if (/[<>]/.test(text)) throw Object.assign(new Error("HTML is not allowed in settings values"), { code: "INVALID_SETTING_VALUE" });
  return text.slice(0, max);
}

function normalizeValue(definition, rawValue) {
  if (!definition) {
    if (!String(rawValue ?? "").trim()) return "";
    return cleanString(rawValue, 1000);
  }

  if (definition.type === "boolean") return rawValue === true || rawValue === "true";
  if (definition.type === "number") {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
      throw Object.assign(new Error(`${definition.key} must be between ${definition.min} and ${definition.max}`), { code: "INVALID_SETTING_VALUE" });
    }
    return value;
  }
  if (definition.type === "select") {
    const value = cleanString(rawValue, 80);
    if (!definition.options.includes(value)) {
      throw Object.assign(new Error(`${definition.key} must be one of: ${definition.options.join(", ")}`), { code: "INVALID_SETTING_VALUE" });
    }
    return value;
  }
  if (definition.type === "csv") return parseCsv(rawValue).map((item) => cleanString(item, 255)).slice(0, 50);
  if (definition.type === "secret") return cleanString(rawValue, 2000);
  return cleanString(rawValue, 1000);
}

function mergeSetting(definition, stored) {
  const value = stored ? stored.value : definition.value;
  return {
    ...definition,
    value: definition.type === "secret" && value ? maskSecretValue(isEncryptedSecret(value) ? "encrypted" : value) : value,
    configured: !!stored,
    updatedAt: stored?.updatedAt || null
  };
}

router.use(requireAuth);

router.get("/", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  const storedByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const merged = definitions.map((definition) => mergeSetting(definition, storedByKey.get(definition.key)));
  const custom = settings
    .filter((setting) => !definitionsByKey.has(setting.key))
    .map((setting) => ({
      key: setting.key,
      value: maskSensitive({ value: setting.value }).value,
      type: "string",
      group: "Custom",
      description: "Custom OpenDeploy setting.",
      configured: true,
      updatedAt: setting.updatedAt
    }));
  return ok(res, "Settings", { settings: [...merged, ...custom], definitions });
}));

router.put("/", requirePermission("settings.manage"), validate(settingDto), asyncHandler(async (req, res) => {
  const definition = definitionsByKey.get(req.body.key);
  if (!definition && !req.body.key.startsWith("custom.")) {
    return fail(res, 422, "Custom settings must use the custom.* namespace.", "INVALID_SETTING_KEY");
  }

  const existing = await prisma.setting.findUnique({ where: { key: req.body.key } });
  let value;
  try {
    value = normalizeValue(definition, req.body.value);
  } catch (error) {
    return fail(res, 422, error.message, error.code || "INVALID_SETTING_VALUE");
  }

  if (definition?.type === "secret") {
    if (value === "********" && existing) {
      value = existing.value;
    } else {
      value = value ? encryptSecret(value, req.body.key) : "";
    }
  }

  const setting = await prisma.setting.upsert({
    where: { key: req.body.key },
    create: { key: req.body.key, value },
    update: { value }
  });
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "setting_saved",
      resource: "setting",
      resourceId: setting.key,
      metadata: { key: setting.key, group: definition?.group || "Custom", severity: "info" }
    }
  });
  return ok(res, "Setting saved", { setting: mergeSetting(definition || { key: setting.key, value: "", type: "string", group: "Custom", description: "Custom OpenDeploy setting." }, setting) });
}));

module.exports = router;
