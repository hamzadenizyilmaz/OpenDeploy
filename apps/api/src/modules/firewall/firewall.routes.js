const net = require("net");
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { audit } = require("../../middleware/audit");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { callAgent } = require("../../services/agentClient");

const sensitivePorts = new Set([22, 3306, 5432, 6379, 27017, 9200, 9300, 11211]);

const presets = [
  {
    id: "web",
    name: "Web Server",
    category: "Public web",
    ports: [{ port: 80, protocol: "tcp" }, { port: 443, protocol: "tcp" }],
    warning: "Required for HTTP/HTTPS traffic.",
    requiresAllowlist: false
  },
  {
    id: "ssh-admin",
    name: "SSH Admin",
    category: "Administration",
    ports: [{ port: 22, protocol: "tcp" }],
    warning: "Restrict SSH to a known admin IP or VPN CIDR.",
    requiresAllowlist: true
  },
  {
    id: "node-app",
    name: "Node.js App",
    category: "Application",
    ports: [{ port: 3000, protocol: "tcp" }],
    warning: "Prefer reverse proxy exposure for production apps.",
    requiresAllowlist: false
  },
  {
    id: "postgres-admin",
    name: "PostgreSQL Admin",
    category: "Database",
    ports: [{ port: 5432, protocol: "tcp" }],
    warning: "Do not expose PostgreSQL publicly; an IP or CIDR allowlist is required.",
    requiresAllowlist: true
  },
  {
    id: "mysql-admin",
    name: "MySQL/MariaDB Admin",
    category: "Database",
    ports: [{ port: 3306, protocol: "tcp" }],
    warning: "Do not expose MySQL/MariaDB publicly; an IP or CIDR allowlist is required.",
    requiresAllowlist: true
  },
  {
    id: "redis-private",
    name: "Redis Private Access",
    category: "Cache",
    ports: [{ port: 6379, protocol: "tcp" }],
    warning: "Redis must stay private unless protected by a trusted network and firewall allowlist.",
    requiresAllowlist: true
  }
];

function isValidSourceIp(value) {
  if (!value) return true;
  const raw = String(value).trim();
  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length !== 2) return false;
    const [address, prefixText] = parts;
    const family = net.isIP(address);
    if (!family || !/^\d+$/.test(prefixText)) return false;
    const prefix = Number(prefixText);
    const maxPrefix = family === 4 ? 32 : 128;
    return prefix > 0 && prefix <= maxPrefix;
  }
  return net.isIP(raw) !== 0;
}

function optionalSourceIp() {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().max(64).refine(isValidSourceIp, "Enter a valid source IP or CIDR.").optional()
  );
}

function optionalPlainText(max = 160) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().max(max).regex(/^[^<>]*$/, "HTML is not allowed in this field.").optional()
  );
}

const ruleDto = z.object({
  port: z.coerce.number().int().min(1).max(65535),
  protocol: z.enum(["tcp", "udp"]).default("tcp"),
  sourceIp: optionalSourceIp(),
  description: optionalPlainText(160)
});

const presetDto = z.object({
  presetId: z.string().regex(/^[a-z0-9._-]{2,50}$/),
  sourceIp: optionalSourceIp()
});

function checkRisk(body) {
  const port = Number(body.port);
  if (sensitivePorts.has(port) && !body.sourceIp) {
    return "Sensitive ports such as SSH, databases, caches and search services require a source IP or CIDR allowlist.";
  }
  return null;
}

function riskLevel(rule) {
  if (!rule.sourceIp && sensitivePorts.has(Number(rule.port))) return "critical";
  if (!rule.sourceIp) return "warning";
  return "restricted";
}

function buildSummary(rules) {
  const active = rules.filter((rule) => rule.enabled !== false);
  return {
    active: active.length,
    disabled: rules.length - active.length,
    public: active.filter((rule) => !rule.sourceIp).length,
    restricted: active.filter((rule) => !!rule.sourceIp).length,
    critical: active.filter((rule) => riskLevel(rule) === "critical").length,
    tcp: active.filter((rule) => rule.protocol === "tcp").length,
    udp: active.filter((rule) => rule.protocol === "udp").length
  };
}

async function saveRule(body, userId) {
  const where = {
    port: body.port,
    protocol: body.protocol,
    sourceIp: body.sourceIp || null,
    action: "allow"
  };
  const existing = await prisma.firewallRule.findFirst({ where });
  if (existing) {
    return prisma.firewallRule.update({
      where: { id: existing.id },
      data: {
        description: body.description || existing.description,
        enabled: true,
        createdBy: userId
      }
    });
  }

  return prisma.firewallRule.create({
    data: {
      port: body.port,
      protocol: body.protocol,
      sourceIp: body.sourceIp,
      description: body.description,
      action: "allow",
      createdBy: userId
    }
  });
}

router.use(requireAuth);

router.get("/presets", requirePermission("firewall.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Firewall presets", { presets });
}));

router.get("/", requirePermission("firewall.manage"), asyncHandler(async (req, res) => {
  const rules = await prisma.firewallRule.findMany({ orderBy: { createdAt: "desc" } });
  return ok(res, "Firewall rules", { rules, presets, summary: buildSummary(rules) });
}));

router.post("/open", requirePermission("firewall.manage"), validate(ruleDto), audit("port_opened", "firewall"), asyncHandler(async (req, res) => {
  const risk = checkRisk(req.body);
  if (risk) return fail(res, 409, risk, "FIREWALL_ALLOWLIST_REQUIRED", { port: req.body.port });

  const agent = await callAgent("firewall.openPort", req.body);
  const rule = await saveRule(req.body, req.user.id);
  return ok(res, "Port open request completed", { rule, agent });
}));

router.post("/apply-preset", requirePermission("firewall.manage"), validate(presetDto), asyncHandler(async (req, res) => {
  const preset = presets.find((item) => item.id === req.body.presetId);
  if (!preset) return fail(res, 404, "Firewall preset not found", "PRESET_NOT_FOUND");

  for (const item of preset.ports) {
    const risk = checkRisk({ ...item, sourceIp: req.body.sourceIp });
    if (risk) {
      return fail(res, 409, preset.warning, "FIREWALL_ALLOWLIST_REQUIRED", { preset: preset.id });
    }
  }

  const created = [];
  const agentResults = [];
  for (const item of preset.ports) {
    const payload = {
      ...item,
      sourceIp: req.body.sourceIp,
      description: preset.name
    };
    agentResults.push(await callAgent("firewall.openPort", payload));
    created.push(await saveRule(payload, req.user.id));
  }

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "firewall_preset_applied",
      resource: "firewall",
      metadata: { presetId: preset.id, sourceIp: req.body.sourceIp || null, ports: preset.ports }
    }
  });

  return ok(res, "Firewall preset applied", { rules: created, agent: agentResults });
}));

router.post("/close", requirePermission("firewall.manage"), validate(ruleDto), audit("port_closed", "firewall"), asyncHandler(async (req, res) => {
  const agent = await callAgent("firewall.closePort", req.body);
  await prisma.firewallRule.updateMany({
    where: {
      port: req.body.port,
      protocol: req.body.protocol,
      sourceIp: req.body.sourceIp || null
    },
    data: { enabled: false }
  });
  return ok(res, "Port close request completed", { agent });
}));

module.exports = router;
