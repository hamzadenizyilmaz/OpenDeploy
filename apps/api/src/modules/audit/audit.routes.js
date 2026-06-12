const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { maskSensitive } = require("../../utils/security");

const queryDto = z.object({
  take: z.coerce.number().int().min(25).max(500).default(300),
  severity: z.enum(["all", "info", "success", "warning", "error", "critical"]).default("all"),
  resource: z.string().max(80).optional()
});

const eventCatalog = [
  { action: "login_succeeded", label: "Login Succeeded", category: "Auth", severity: "info", description: "A user authenticated successfully." },
  { action: "login_failed", label: "Login Failed", category: "Auth", severity: "warning", description: "A login attempt failed." },
  { action: "domain_added", label: "Domain Added", category: "Domains", severity: "info", description: "A domain was attached or updated." },
  { action: "dns_record_created", label: "DNS Record Created", category: "DNS", severity: "info", description: "A DNS record was created." },
  { action: "port_opened", label: "Port Opened", category: "Firewall", severity: "warning", description: "A firewall allow rule was created." },
  { action: "port_closed", label: "Port Closed", category: "Firewall", severity: "warning", description: "A firewall rule was disabled." },
  { action: "sql_query_executed", label: "SQL Query Executed", category: "Database", severity: "info", description: "A SQL query passed the guard layer." },
  { action: "terminal_command_requested", label: "Terminal Command Requested", category: "Terminal", severity: "warning", description: "A terminal command was requested." },
  { action: "file_written", label: "File Written", category: "Files", severity: "warning", description: "A project file was modified." },
  { action: "update_queued", label: "Update Queued", category: "Updates", severity: "warning", description: "A system or software update was queued." }
];

const catalogByAction = new Map(eventCatalog.map((event) => [event.action, event]));

const sampleLogs = [
  { id: "sample-login", action: "login_succeeded", resource: "auth", ipAddress: "127.0.0.1", user: { email: "owner@example.com", name: "Owner" }, metadata: { method: "password", severity: "info" }, createdAt: new Date().toISOString() },
  { id: "sample-firewall", action: "port_opened", resource: "firewall", ipAddress: "127.0.0.1", user: { email: "system" }, metadata: { port: 443, protocol: "tcp", source: "any", severity: "warning" }, createdAt: new Date(Date.now() - 900000).toISOString() },
  { id: "sample-dns", action: "dns_record_created", resource: "dns_record", ipAddress: "127.0.0.1", user: { email: "dns-admin" }, metadata: { type: "A", fqdn: "app.example.com", severity: "info" }, createdAt: new Date(Date.now() - 1800000).toISOString() }
];

function titleizeAction(action) {
  return String(action || "event").replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeLog(log) {
  const metadata = maskSensitive(log.metadata || {});
  const catalog = catalogByAction.get(log.action);
  const severity = metadata.severity || catalog?.severity || "info";
  return {
    id: log.id,
    action: log.action,
    label: catalog?.label || titleizeAction(log.action),
    category: catalog?.category || titleizeAction(log.resource || "system"),
    severity,
    resource: log.resource || catalog?.category || "system",
    resourceId: log.resourceId || null,
    actor: log.user?.email || log.userId || "system",
    actorName: log.user?.name || null,
    ipAddress: log.ipAddress || "-",
    userAgent: log.userAgent || "-",
    metadata,
    summary: Object.entries(metadata).slice(0, 4).map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`).join(" | "),
    createdAt: log.createdAt
  };
}

function buildSummary(logs) {
  return logs.reduce((acc, log) => {
    acc.total += 1;
    acc.bySeverity[log.severity] = (acc.bySeverity[log.severity] || 0) + 1;
    acc.byCategory[log.category] = (acc.byCategory[log.category] || 0) + 1;
    return acc;
  }, { total: 0, bySeverity: {}, byCategory: {} });
}

router.use(requireAuth);

router.get("/", requirePermission("audit.read"), validate(queryDto, "query"), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.resource) where.resource = req.query.resource;
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: req.query.take,
    include: { user: { select: { id: true, email: true, name: true } } }
  });
  let normalized = (logs.length ? logs : sampleLogs).map(normalizeLog);
  if (req.query.severity !== "all") normalized = normalized.filter((log) => log.severity === req.query.severity);
  return ok(res, "Audit logs", {
    logs: normalized,
    sample: logs.length === 0,
    summary: buildSummary(normalized),
    catalog: eventCatalog
  });
}));

module.exports = router;
