const crypto = require("crypto");
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { env } = require("../../config/env");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { maskSensitive, safeName } = require("../../utils/security");

const rangeDto = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  take: z.coerce.number().int().min(1).max(2000).default(500)
});

const policiesDto = z.object({
  policies: z.record(z.any())
});

const approvalDto = z.object({
  operation: z.string().min(2).max(120),
  resource: z.string().min(2).max(120),
  resourceId: z.string().max(160).optional().nullable(),
  reason: z.string().min(4).max(1000),
  dryRun: z.boolean().default(false)
});

const policyDefinitions = [
  { key: "compliance.auditRetentionDays", label: "Audit retention", defaultValue: 365, category: "Audit", type: "number", description: "Number of days audit logs should be retained before archive or purge." },
  { key: "compliance.immutableArchive", label: "Immutable audit archive", defaultValue: false, category: "Audit", type: "boolean", description: "Require immutable external storage for audit exports." },
  { key: "compliance.destructiveApprovalRequired", label: "Destructive action approval", defaultValue: true, category: "Approvals", type: "boolean", description: "Require approval records before destructive operations." },
  { key: "security.panelIpAllowlist", label: "Panel IP allowlist", defaultValue: [], category: "Access", type: "csv", description: "CIDR/IP list allowed to access the panel when enforcement is enabled." },
  { key: "security.panelIpAllowlistMode", label: "Panel allowlist mode", defaultValue: "monitor", category: "Access", type: "select", description: "Use monitor before switching the panel allowlist to enforce." },
  { key: "security.require2FA", label: "2FA enforcement", defaultValue: false, category: "Access", type: "boolean", description: "Require TOTP for privileged accounts." },
  { key: "security.password.minLength", label: "Password minimum length", defaultValue: 12, category: "Password", type: "number", description: "Minimum accepted password length." },
  { key: "security.password.requireNumbers", label: "Password numbers", defaultValue: true, category: "Password", type: "boolean", description: "Require at least one number." },
  { key: "security.password.requireSymbols", label: "Password symbols", defaultValue: true, category: "Password", type: "boolean", description: "Require at least one symbol." },
  { key: "security.password.rotationDays", label: "Password rotation", defaultValue: 0, category: "Password", type: "number", description: "Advisory password rotation period. Zero disables forced rotation." },
  { key: "backups.complianceTarget", label: "Backup compliance target", defaultValue: "local", category: "Backups", type: "string", description: "Expected compliant backup target or provider." },
  { key: "backups.complianceRetentionDays", label: "Backup retention", defaultValue: 30, category: "Backups", type: "number", description: "Required minimum backup retention days." }
];

const policyByKey = new Map(policyDefinitions.map((item) => [item.key, item]));

function whereRange(query) {
  const createdAt = {};
  if (query.from) createdAt.gte = new Date(query.from);
  if (query.to) createdAt.lte = new Date(query.to);
  return Object.keys(createdAt).length ? { createdAt } : {};
}

function stableStringify(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function hashChain(entries) {
  let previousHash = "0".repeat(64);
  return entries.map((entry, index) => {
    const maskedEntry = maskSensitive(entry);
    const hash = sha256(stableStringify({ index, previousHash, entry: maskedEntry }));
    const chained = { sequence: index + 1, previousHash, hash, entry: maskedEntry };
    previousHash = hash;
    return chained;
  });
}

function jsonSafe(value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

async function readPolicies() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: policyDefinitions.map((item) => item.key) } }
  });
  const stored = new Map(settings.map((setting) => [setting.key, setting]));
  return policyDefinitions.map((definition) => ({
    ...definition,
    value: stored.get(definition.key)?.value ?? definition.defaultValue,
    configured: stored.has(definition.key),
    updatedAt: stored.get(definition.key)?.updatedAt || null
  }));
}

function scoreControls(controls) {
  const passed = controls.filter((control) => control.status === "pass").length;
  return {
    passed,
    total: controls.length,
    score: controls.length ? Math.round((passed / controls.length) * 100) : 100
  };
}

function actor(req) {
  return {
    id: req.user.id,
    email: req.user.email,
    roles: req.user.roles
  };
}

router.use(requireAuth);

router.get(["/", "/overview"], requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const [
    auditCount,
    sessionCount,
    activeSessions,
    apiKeyCount,
    backupJobCount,
    backupFailureCount,
    roleChangeCount,
    loginCount,
    policies
  ] = await Promise.all([
    prisma.auditLog.count(),
    prisma.session.count(),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.apiToken.count(),
    prisma.backupJob.count(),
    prisma.backup.count({ where: { status: "failed" } }),
    prisma.auditLog.count({ where: { OR: [{ action: { contains: "role", mode: "insensitive" } }, { resource: { contains: "role", mode: "insensitive" } }] } }),
    prisma.auditLog.count({ where: { action: { contains: "login", mode: "insensitive" } } }),
    readPolicies()
  ]);

  return ok(res, "Compliance overview", {
    releaseTrack: "v1.2.x Compliance and Governance",
    generatedAt: new Date().toISOString(),
    actor: actor(req),
    totals: {
      auditEvents: auditCount,
      sessions: sessionCount,
      activeSessions,
      apiKeys: apiKeyCount,
      backupJobs: backupJobCount,
      failedBackups: backupFailureCount,
      roleChangeEvents: roleChangeCount,
      loginEvents: loginCount
    },
    controls: [
      { key: "audit-export", label: "Tamper-evident audit export", status: "pass", endpoint: "/api/compliance/audit-export" },
      { key: "retention", label: "Audit retention policies", status: policies.find((p) => p.key === "compliance.auditRetentionDays")?.value ? "pass" : "warn", endpoint: "/api/compliance/retention" },
      { key: "session-revocation", label: "Session revocation", status: "pass", endpoint: "/api/compliance/sessions" },
      { key: "ip-allowlist", label: "Panel IP allowlist", status: "pass", endpoint: "/api/compliance/panel-ip-allowlist" },
      { key: "2fa", label: "2FA enforcement policy", status: "pass", endpoint: "/api/compliance/policies" },
      { key: "password", label: "Password policy controls", status: "pass", endpoint: "/api/compliance/policies" },
      { key: "backup", label: "Backup compliance report", status: "pass", endpoint: "/api/compliance/backup-compliance" },
      { key: "approvals", label: "Destructive action approval workflow", status: "pass", endpoint: "/api/compliance/approvals" }
    ],
    policies
  });
}));

router.get("/audit-export", requirePermission("compliance.manage"), validate(rangeDto, "query"), asyncHandler(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: whereRange(req.query),
    orderBy: { createdAt: "asc" },
    take: req.query.take,
    include: { user: { select: { id: true, email: true, name: true } } }
  });
  const entries = logs.map((log) => ({
    id: log.id,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    actor: log.user ? { id: log.user.id, email: log.user.email, name: log.user.name } : { id: log.userId || "system" },
    metadata: maskSensitive(log.metadata || {}),
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt
  }));
  const chain = hashChain(entries);
  return ok(res, "Tamper-evident audit export", {
    export: {
      format: "json",
      algorithm: "sha256",
      generatedAt: new Date().toISOString(),
      timeRange: { from: req.query.from || null, to: req.query.to || null },
      generatedBy: actor(req),
      count: chain.length,
      headHash: chain.at(-1)?.hash || "0".repeat(64),
      entries: chain
    }
  });
}));

router.get("/retention", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const policies = await readPolicies();
  return ok(res, "Audit retention policies", {
    retention: policies.filter((policy) => ["Audit", "Backups"].includes(policy.category)),
    recommendations: [
      "Export audit logs to immutable storage before purge.",
      "Keep security and login events at least 365 days for regulated environments.",
      "Keep backup verification reports for the same period as backup artifacts."
    ]
  });
}));

router.get("/role-change-history", requirePermission("compliance.manage"), validate(rangeDto, "query"), asyncHandler(async (req, res) => {
  const events = await prisma.auditLog.findMany({
    where: {
      ...whereRange(req.query),
      OR: [
        { action: { contains: "role", mode: "insensitive" } },
        { action: { contains: "permission", mode: "insensitive" } },
        { resource: { contains: "role", mode: "insensitive" } },
        { resource: { contains: "permission", mode: "insensitive" } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: req.query.take,
    include: { user: { select: { id: true, email: true, name: true } } }
  });
  return ok(res, "Role change history", { events: events.map((event) => jsonSafe(maskSensitive(event))) });
}));

router.get("/api-key-usage", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const keys = await prisma.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, email: true, name: true } } }
  });
  return ok(res, "API key usage report", {
    keys: keys.map((key) => ({
      id: key.id,
      name: key.name,
      owner: key.user,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      status: key.expiresAt && key.expiresAt <= new Date() ? "expired" : "active"
    }))
  });
}));

router.get("/login-history", requirePermission("compliance.manage"), validate(rangeDto, "query"), asyncHandler(async (req, res) => {
  const events = await prisma.auditLog.findMany({
    where: { ...whereRange(req.query), action: { contains: "login", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: req.query.take,
    include: { user: { select: { id: true, email: true, name: true, lastLoginAt: true } } }
  });
  return ok(res, "Login history", { events: events.map((event) => jsonSafe(maskSensitive(event))) });
}));

router.get("/sessions", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { id: true, email: true, name: true } } }
  });
  return ok(res, "Session inventory", {
    sessions: sessions.map((session) => ({
      id: session.id,
      user: session.user,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      status: session.revokedAt ? "revoked" : session.expiresAt <= new Date() ? "expired" : "active"
    }))
  });
}));

router.post("/sessions/:id/revoke", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const session = await prisma.session.findUnique({ where: { id: req.params.id } });
  if (!session) return fail(res, 404, "Session not found", "SESSION_NOT_FOUND");
  const revoked = await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "session_revoked",
      resource: "session",
      resourceId: revoked.id,
      metadata: { targetUserId: session.userId, severity: "warning" }
    }
  });
  return ok(res, "Session revoked", { session: { id: revoked.id, revokedAt: revoked.revokedAt } });
}));

router.get("/panel-ip-allowlist", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const policies = await readPolicies();
  return ok(res, "Panel IP allowlist", {
    allowlist: policies.find((policy) => policy.key === "security.panelIpAllowlist"),
    mode: policies.find((policy) => policy.key === "security.panelIpAllowlistMode"),
    requestIp: req.ip,
    guidance: "Start in monitor mode, review access logs, then switch to enforce after administrators are confirmed."
  });
}));

router.get("/policies", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Compliance policy controls", { policies: await readPolicies(), definitions: policyDefinitions });
}));

router.put("/policies", requirePermission("compliance.manage"), validate(policiesDto), asyncHandler(async (req, res) => {
  const saved = [];
  for (const [key, value] of Object.entries(req.body.policies)) {
    const definition = policyByKey.get(key);
    if (!definition) return fail(res, 422, `Unsupported compliance policy: ${key}`, "INVALID_POLICY_KEY");
    const setting = await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    saved.push({ ...definition, value: setting.value, updatedAt: setting.updatedAt, configured: true });
  }
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "compliance_policies_updated",
      resource: "compliance_policy",
      metadata: { keys: saved.map((item) => item.key), severity: "warning" }
    }
  });
  return ok(res, "Compliance policies updated", { policies: saved });
}));

router.get("/security-baseline", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const policies = await readPolicies();
  const controls = [
    { key: "headers.hsts", label: "HSTS header", status: "pass", evidence: "Helmet HSTS enabled in API and Next.js headers." },
    { key: "headers.frame", label: "Frame denial", status: "pass", evidence: "X-Frame-Options DENY and frame-ancestors none." },
    { key: "csp", label: "Content Security Policy", status: "pass", evidence: "API and Web CSP configured." },
    { key: "argon2id", label: "Argon2id passwords", status: "pass", evidence: "Password utility verifies/upgrades Argon2id." },
    { key: "argon2id-api-keys", label: "Argon2id API keys", status: "pass", evidence: "New API keys are Argon2id hashed; legacy SHA-256 hashes remain verifiable." },
    { key: "encryption", label: "Secret encryption", status: env.encryptionKey || env.envelopePublicKey ? "pass" : "warn", evidence: "AES-256-GCM/envelope encryption configured through environment." },
    { key: "2fa", label: "2FA enforcement", status: policies.find((item) => item.key === "security.require2FA")?.value ? "pass" : "warn", evidence: "Policy exists and can be enforced." },
    { key: "ip-allowlist", label: "Panel IP allowlist", status: "pass", evidence: "Allowlist policy control exists." },
    { key: "audit-export", label: "Tamper-evident audit export", status: "pass", evidence: "SHA-256 hash chain export endpoint available." },
    { key: "approval", label: "Destructive approval workflow", status: policies.find((item) => item.key === "compliance.destructiveApprovalRequired")?.value ? "pass" : "warn", evidence: "Approval request endpoint available." }
  ];
  return ok(res, "Security baseline report", {
    generatedAt: new Date().toISOString(),
    actor: actor(req),
    score: scoreControls(controls),
    controls
  });
}));

router.get("/backup-compliance", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const [jobs, backups] = await Promise.all([
    prisma.backupJob.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { project: { select: { id: true, name: true, slug: true } } } })
  ]);
  const failures = backups.filter((backup) => backup.status === "failed");
  const encrypted = backups.filter((backup) => backup.encrypted);
  return ok(res, "Backup compliance report", {
    generatedAt: new Date().toISOString(),
    actor: actor(req),
    summary: {
      jobs: jobs.length,
      backups: backups.length,
      failures: failures.length,
      encrypted: encrypted.length,
      encryptionRate: backups.length ? Math.round((encrypted.length / backups.length) * 100) : 100
    },
    jobs: jobs.map(jsonSafe),
    backups: backups.map((backup) => jsonSafe(backup)),
    recommendations: [
      "Enable encryption for all external backups.",
      "Keep at least one recent successful backup per critical project.",
      "Run restore dry-runs after changing backup providers."
    ]
  });
}));

router.get("/approvals", requirePermission("compliance.manage"), asyncHandler(async (req, res) => {
  const approvals = await prisma.auditLog.findMany({
    where: { resource: "destructive_action" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { id: true, email: true, name: true } } }
  });
  return ok(res, "Destructive action approval workflow", {
    approvals: approvals.map((approval) => jsonSafe(maskSensitive(approval))),
    required: (await readPolicies()).find((policy) => policy.key === "compliance.destructiveApprovalRequired")?.value ?? true
  });
}));

router.post("/approvals", requirePermission("compliance.manage"), validate(approvalDto), asyncHandler(async (req, res) => {
  const log = await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: req.body.dryRun ? "destructive_action_dry_run" : "destructive_action_approval_requested",
      resource: "destructive_action",
      resourceId: safeName(req.body.resourceId || req.body.operation, "destructive-action"),
      metadata: {
        operation: req.body.operation,
        resource: req.body.resource,
        resourceId: req.body.resourceId || null,
        reason: req.body.reason,
        dryRun: req.body.dryRun,
        status: req.body.dryRun ? "dry_run" : "pending",
        severity: "warning"
      }
    }
  });
  return ok(res, req.body.dryRun ? "Destructive action dry-run recorded" : "Destructive action approval requested", { approval: jsonSafe(maskSensitive(log)) });
}));

module.exports = router;
