const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");

const permissionDescriptions = {
  "system.manage": "Manage host-level system actions, service repair, and protected maintenance operations.",
  "users.manage": "Create, disable, lock, and review panel users.",
  "roles.manage": "Create custom roles and assign granular permissions.",
  "api_keys.manage": "Create and revoke API keys for automation.",
  "projects.manage": "Create projects, edit project configuration, and manage environment variables.",
  "deployments.manage": "Start deploys, inspect logs, and request rollbacks.",
  "databases.manage": "Register database servers, manage users, and run service actions.",
  "database.query": "Use the SQL console with query safety controls and audit logging.",
  "domains.manage": "Attach domains to projects and run DNS validation checks.",
  "dns.manage": "Create DNS zones and records from the panel.",
  "ssl.manage": "Issue, renew, revoke, and monitor SSL certificates.",
  "proxy.manage": "Manage Nginx/Apache templates, reverse proxies, and reloads.",
  "firewall.manage": "Open/close ports, apply presets, and maintain IP allowlists.",
  "files.manage": "Browse and edit project files inside allowed roots only.",
  "terminal.use": "Create audited terminal sessions through the agent allowlist.",
  "services.manage": "Start, stop, restart, and inspect Linux services.",
  "pm2.manage": "Manage PM2 processes and runtime logs.",
  "backups.manage": "Create local or external backups and retention policies.",
  "settings.manage": "Edit panel, security, notification, and integration settings.",
  "audit.read": "Read detailed audit logs and security events.",
  "monitoring.read": "View server, project, database, and service metrics.",
  "updates.manage": "Check, schedule, run, and roll back server updates.",
  "cron.manage": "Create automatic update, health, backup, and notification checks."
};
const builtIn = ["owner", "admin", "developer", "database_manager", "viewer"];
const roleDto = z.object({
  name: z.string().min(2).max(50).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase()),
  description: z.string().max(240).regex(/^[^<>]*$/, "HTML is not allowed.").optional(),
  permissions: z.array(z.string().regex(/^[a-zA-Z0-9._-]+$/)).default([])
});

router.use(requireAuth);

router.get("/permissions", requirePermission("roles.manage"), asyncHandler(async (req, res) => {
  const dbPermissions = await prisma.permission.findMany({ orderBy: { key: "asc" } });
  const keys = new Set([...dbPermissions.map((p) => p.key), ...Object.keys(permissionDescriptions)]);
  const permissions = [...keys].sort().map((key) => ({ key, description: permissionDescriptions[key] || dbPermissions.find((p) => p.key === key)?.description || "Custom permission." }));
  return ok(res, "Permissions", { permissions });
}));

router.get("/", requirePermission("roles.manage"), asyncHandler(async (req, res) => {
  const roles = await prisma.role.findMany({ include: { permissions: { include: { permission: true } }, users: true }, orderBy: { name: "asc" } });
  const fallback = builtIn.map((name) => ({ id: name, name, description: `${name} role`, isSystem: true, users: [], permissions: [] }));
  return ok(res, "Roles", { roles: roles.length ? roles : fallback, permissionDescriptions });
}));

router.post("/", requirePermission("roles.manage"), validate(roleDto), asyncHandler(async (req, res) => {
  if (builtIn.includes(req.body.name)) return fail(res, 409, "Built-in role already exists", "ROLE_EXISTS");
  const dbPermissions = await prisma.permission.findMany({ select: { key: true } });
  const allowed = new Set([...Object.keys(permissionDescriptions), ...dbPermissions.map((permission) => permission.key)]);
  const invalid = req.body.permissions.filter((key) => !allowed.has(key));
  if (invalid.length) return fail(res, 422, "Role contains unknown permissions", "UNKNOWN_PERMISSION", { invalid });
  const role = await prisma.role.create({ data: { name: req.body.name, description: req.body.description || "Custom role", isSystem: false } });
  for (const key of req.body.permissions) {
    const permission = await prisma.permission.upsert({ where: { key }, update: { description: permissionDescriptions[key] || "Custom permission." }, create: { key, description: permissionDescriptions[key] || "Custom permission." } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } }).catch(() => null);
  }
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "role_created", resource: "role", resourceId: role.id, metadata: { name: role.name, permissions: req.body.permissions } } });
  return ok(res, "Role created", { role });
}));

module.exports = router;
