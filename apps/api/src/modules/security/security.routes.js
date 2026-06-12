const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");

const policyDefaults = {
  "waf-rules": {
    slug: "waf-rules",
    title: "WAF Rules",
    description: "Application firewall policies for XSS, SQLi, file inclusion, command injection, protocol abuse and admin route protection.",
    settings: {
      enforcementMode: "blocking",
      logLevel: "security",
      failClosed: true,
      inspectJson: true,
      inspectUploads: true,
      maxBodyKb: 1024
    },
    items: [
      {
        id: "owasp-crs-core",
        name: "OWASP Core Rule Set",
        category: "Application firewall",
        mode: "blocking",
        action: "block",
        severity: "critical",
        enabled: true,
        pattern: "sqli,xss,lfi,rfi,rce,protocol-abuse",
        description: "Blocks high-confidence application attacks before they reach the API or reverse proxy."
      },
      {
        id: "xss-strict",
        name: "Strict XSS Filter",
        category: "Input protection",
        mode: "blocking",
        action: "block",
        severity: "high",
        enabled: true,
        pattern: "script-tags,event-handlers,javascript-url,encoded-html",
        description: "Rejects browser-executable payloads and suspicious DOM sink probes."
      },
      {
        id: "upload-policy",
        name: "Upload Content Policy",
        category: "File safety",
        mode: "blocking",
        action: "block",
        severity: "high",
        enabled: true,
        pattern: "double-extension,web-shell,mime-mismatch,oversized-archive",
        description: "Protects file manager and deployment upload surfaces."
      }
    ]
  },
  "advanced-rules": {
    slug: "advanced-rules",
    title: "Advanced Rules",
    description: "Deep request controls for bot scoring, request smuggling, host header poisoning, path normalization and geo/ASN policy.",
    settings: {
      botScoreThreshold: 65,
      torPolicy: "challenge",
      unknownAsnPolicy: "challenge",
      normalizeBeforeMatch: true,
      blockHeaderPoisoning: true,
      auditSamplingPercent: 100
    },
    items: [
      {
        id: "bot-fingerprint",
        name: "Bot Fingerprint Scoring",
        signal: "TLS, headers, user-agent and navigation entropy",
        action: "score",
        severity: "medium",
        enabled: true,
        description: "Scores automation clients before login, deployment and API endpoints receive traffic."
      },
      {
        id: "request-smuggling",
        name: "Request Smuggling Defense",
        signal: "Transfer-Encoding and Content-Length ambiguity",
        action: "block",
        severity: "critical",
        enabled: true,
        description: "Drops ambiguous HTTP requests before they can cross proxy boundaries."
      },
      {
        id: "path-normalization",
        name: "Path Normalization",
        signal: "Unicode, dot segments, slash folding and encoded traversal",
        action: "normalize_then_block",
        severity: "high",
        enabled: true,
        description: "Canonicalizes request paths and rejects traversal, null byte and mixed encoding attacks."
      }
    ]
  },
  "rate-limiting": {
    slug: "rate-limiting",
    title: "Rate Limiting",
    description: "Per-route and per-actor limits for login, API keys, DNS writes, SQL Console, Terminal and destructive operations.",
    settings: {
      globalPerMinute: 1200,
      trustedProxyDepth: 1,
      useRedis: true,
      banMinutes: 30,
      notifyOnBan: true,
      dryRun: false
    },
    items: [
      {
        id: "login",
        name: "Login Protection",
        scope: "IP + email",
        limit: 8,
        windowSeconds: 300,
        burst: 3,
        action: "challenge_then_block",
        enabled: true,
        description: "Protects credential endpoints from brute force, spraying and enumeration."
      },
      {
        id: "api-key",
        name: "API Key Traffic",
        scope: "API key + route",
        limit: 600,
        windowSeconds: 60,
        burst: 80,
        action: "429",
        enabled: true,
        description: "Keeps automation fast while isolating noisy or compromised keys."
      },
      {
        id: "dns-zone-writes",
        name: "DNS Zone Writes",
        scope: "Instance + zone",
        limit: 120,
        windowSeconds: 300,
        burst: 20,
        action: "queue",
        enabled: true,
        description: "Protects zone edits and nameserver sync from accidental bulk changes."
      }
    ]
  },
  "challenge-settings": {
    slug: "challenge-settings",
    title: "Challenge Settings",
    description: "Managed challenge policies for risky admin, DNS, terminal, SQL, API key and update workflows.",
    settings: {
      provider: "turnstile",
      mode: "managed",
      clearanceMinutes: 30,
      failClosed: true,
      riskScoreThreshold: 70,
      fallbackAction: "temporary_403"
    },
    items: [
      {
        id: "admin-login",
        name: "Admin Login Challenge",
        route: "/login",
        trigger: "Repeated failed login, high bot score or impossible travel",
        action: "managed_challenge",
        severity: "high",
        enabled: true,
        description: "Challenges risky login attempts before issuing tokens."
      },
      {
        id: "dns-destructive",
        name: "DNS Destructive Actions",
        route: "/dns",
        trigger: "Record deletion, nameserver change or zone export",
        action: "managed_challenge",
        severity: "critical",
        enabled: true,
        description: "Requires challenge clearance before destructive DNS changes."
      },
      {
        id: "terminal-sql",
        name: "Terminal and SQL Console",
        route: "/terminal,/sql-console",
        trigger: "Sudo, write SQL, destructive command or anomaly score",
        action: "managed_challenge",
        severity: "critical",
        enabled: true,
        description: "Adds a second checkpoint before sensitive operational commands."
      }
    ]
  }
};

const slugs = Object.keys(policyDefaults);

const paramsDto = z.object({
  slug: z.enum(slugs)
});

const itemParamsDto = z.object({
  slug: z.enum(slugs),
  itemId: z.string().min(1).max(120).regex(/^[a-z0-9._-]+$/)
});

const itemDto = z.object({
  id: z.string().min(2).max(120).regex(/^[a-z0-9._-]+$/).optional(),
  name: z.string().min(2).max(120),
  category: z.string().max(120).optional(),
  mode: z.string().max(80).optional(),
  action: z.string().min(1).max(80),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).default("medium"),
  enabled: z.boolean().default(true),
  pattern: z.string().max(400).optional(),
  signal: z.string().max(400).optional(),
  scope: z.string().max(160).optional(),
  route: z.string().max(300).optional(),
  trigger: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100000).optional(),
  windowSeconds: z.coerce.number().int().min(1).max(86400).optional(),
  burst: z.coerce.number().int().min(0).max(100000).optional(),
  description: z.string().min(1).max(800)
});

const settingsDto = z.object({
  settings: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(200))]))
});

function settingKey(slug) {
  return `securityPolicy.${slug}`;
}

function stripHtml(value) {
  if (typeof value === "string" && /[<>]/.test(value)) {
    throw Object.assign(new Error("HTML is not allowed in security policy values"), { code: "INVALID_SECURITY_POLICY" });
  }
  return value;
}

function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, cleanObject(val)]));
  }
  return stripHtml(value);
}

function normalizeItem(slug, item) {
  const clean = cleanObject(item);
  const id = clean.id || clean.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    ...clean,
    id,
    enabled: clean.enabled !== false
  };
}

async function readPolicy(slug) {
  const definition = policyDefaults[slug];
  const stored = await prisma.setting.findUnique({ where: { key: settingKey(slug) } });
  const value = stored?.value && typeof stored.value === "object" ? stored.value : {};
  return {
    ...definition,
    settings: { ...definition.settings, ...(value.settings || {}) },
    items: Array.isArray(value.items) ? value.items : definition.items,
    updatedAt: stored?.updatedAt || null
  };
}

async function writePolicy(slug, policy, userId, action) {
  const setting = await prisma.setting.upsert({
    where: { key: settingKey(slug) },
    create: { key: settingKey(slug), value: { settings: policy.settings, items: policy.items } },
    update: { value: { settings: policy.settings, items: policy.items } }
  });
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource: "security_policy",
      resourceId: slug,
      metadata: { slug, itemCount: policy.items.length, severity: "info" }
    }
  });
  return setting;
}

router.use(requireAuth);

router.get("/", requirePermission("settings.manage"), asyncHandler(async (req, res) => {
  const policies = await Promise.all(slugs.map(readPolicy));
  return ok(res, "Security policies", {
    policies: policies.map((policy) => ({
      slug: policy.slug,
      title: policy.title,
      description: policy.description,
      enabled: policy.items.filter((item) => item.enabled !== false).length,
      total: policy.items.length,
      updatedAt: policy.updatedAt
    }))
  });
}));

router.get("/:slug", requirePermission("settings.manage"), validate(paramsDto, "params"), asyncHandler(async (req, res) => {
  return ok(res, "Security policy", { policy: await readPolicy(req.params.slug) });
}));

router.put("/:slug/settings", requirePermission("settings.manage"), validate(paramsDto, "params"), validate(settingsDto), asyncHandler(async (req, res) => {
  const policy = await readPolicy(req.params.slug);
  policy.settings = { ...policy.settings, ...cleanObject(req.body.settings) };
  await writePolicy(req.params.slug, policy, req.user.id, "security_policy_settings_updated");
  return ok(res, "Security policy settings updated", { policy });
}));

router.post("/:slug/items", requirePermission("settings.manage"), validate(paramsDto, "params"), validate(itemDto), asyncHandler(async (req, res) => {
  const policy = await readPolicy(req.params.slug);
  const item = normalizeItem(req.params.slug, req.body);
  if (policy.items.some((entry) => entry.id === item.id)) return fail(res, 409, "Policy item already exists", "SECURITY_POLICY_ITEM_EXISTS");
  policy.items = [item, ...policy.items];
  await writePolicy(req.params.slug, policy, req.user.id, "security_policy_item_created");
  return ok(res, "Security policy item created", { policy, item });
}));

router.put("/:slug/items/:itemId", requirePermission("settings.manage"), validate(itemParamsDto, "params"), validate(itemDto), asyncHandler(async (req, res) => {
  const policy = await readPolicy(req.params.slug);
  const item = normalizeItem(req.params.slug, { ...req.body, id: req.params.itemId });
  const index = policy.items.findIndex((entry) => entry.id === req.params.itemId);
  if (index === -1) return fail(res, 404, "Policy item not found", "SECURITY_POLICY_ITEM_NOT_FOUND");
  policy.items[index] = item;
  await writePolicy(req.params.slug, policy, req.user.id, "security_policy_item_updated");
  return ok(res, "Security policy item updated", { policy, item });
}));

router.delete("/:slug/items/:itemId", requirePermission("settings.manage"), validate(itemParamsDto, "params"), asyncHandler(async (req, res) => {
  const policy = await readPolicy(req.params.slug);
  const nextItems = policy.items.filter((entry) => entry.id !== req.params.itemId);
  if (nextItems.length === policy.items.length) return fail(res, 404, "Policy item not found", "SECURITY_POLICY_ITEM_NOT_FOUND");
  policy.items = nextItems;
  await writePolicy(req.params.slug, policy, req.user.id, "security_policy_item_deleted");
  return ok(res, "Security policy item deleted", { policy });
}));

module.exports = router;
