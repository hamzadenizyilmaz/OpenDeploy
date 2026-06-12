const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../utils/passwords");
const prisma = new PrismaClient();

const permissionDescriptions = {
  "system.manage": "Manage host-level system actions and maintenance operations.",
  "users.manage": "Create, disable, lock, and review panel users.",
  "roles.manage": "Create custom roles and assign granular permissions.",
  "api_keys.manage": "Create and revoke API keys for automation.",
  "projects.manage": "Create projects, edit configuration, and manage environment variables.",
  "deployments.manage": "Start deploys, inspect logs, and request rollbacks.",
  "databases.manage": "Register database servers and manage database resources.",
  "database.query": "Use SQL Console with query guard and audit logging.",
  "domains.manage": "Attach domains to projects and run DNS validation.",
  "dns.manage": "Create DNS zones and manage records.",
  "ssl.manage": "Issue, renew, revoke, and monitor SSL certificates.",
  "proxy.manage": "Manage Nginx/Apache reverse proxy configuration.",
  "firewall.manage": "Open/close ports and apply firewall presets.",
  "files.manage": "Browse and edit files inside allowed project roots only.",
  "terminal.use": "Create audited terminal sessions through the agent allowlist.",
  "services.manage": "Start, stop, restart, and inspect services.",
  "pm2.manage": "Manage PM2 process list and actions.",
  "backups.manage": "Create local/external backups and retention policies.",
  "settings.manage": "Edit panel/security/notification settings.",
  "compliance.manage": "Export audit evidence, manage compliance policies, revoke sessions and review governance reports.",
  "enterprise.manage": "Manage enterprise operations surfaces such as SSO, SCIM, HA profiles, policy-as-code and SIEM export.",
  "audit.read": "Read detailed audit logs and security events.",
  "monitoring.read": "View host, project, database, and service metrics.",
  "updates.manage": "Check, run, and rollback server/software updates.",
  "cron.manage": "Create automatic update, SSL, backup, and health watches."
};
const permissions = Object.keys(permissionDescriptions);
const rolePermissions = {
  owner: permissions,
  admin: permissions.filter((p) => !["roles.manage"].includes(p)),
  developer: ["projects.manage", "deployments.manage", "files.manage", "terminal.use", "pm2.manage", "monitoring.read"],
  database_manager: ["databases.manage", "database.query", "backups.manage", "monitoring.read", "audit.read"],
  viewer: ["monitoring.read", "audit.read"]
};
const roleDescriptions = {
  owner: "Full system owner with unrestricted access.",
  admin: "Operations administrator for projects, databases, proxy, firewall, backups and updates.",
  developer: "Project developer with deploy, file, terminal and PM2 access for allowed projects.",
  database_manager: "Database operator with SQL console, backup and database management access.",
  viewer: "Read-only observability role for monitoring and audit review."
};
async function ensurePermission(key) { return prisma.permission.upsert({ where: { key }, update: { description: permissionDescriptions[key] }, create: { key, description: permissionDescriptions[key] } }); }
async function ensureRole(name) { return prisma.role.upsert({ where: { name }, update: { description: roleDescriptions[name], isSystem: true }, create: { name, description: roleDescriptions[name], isSystem: true } }); }
async function main() {
  const permissionMap = new Map();
  for (const key of permissions) permissionMap.set(key, await ensurePermission(key));
  for (const [roleName, keys] of Object.entries(rolePermissions)) {
    const role = await ensureRole(roleName);
    for (const key of keys) {
      const permission = permissionMap.get(key);
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
  }
  const email = (process.env.OPENDEPLOY_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !process.env.OPENDEPLOY_ADMIN_PASSWORD) {
    throw new Error("OPENDEPLOY_ADMIN_PASSWORD is required when seeding production.");
  }
  const password = process.env.OPENDEPLOY_ADMIN_PASSWORD || "ChangeMeOnlyForLocalDev123!";
  const name = process.env.OPENDEPLOY_ADMIN_NAME || "OpenDeploy Owner";
  const existing = await prisma.user.findUnique({ where: { email } });
  const ownerRole = await prisma.role.findUnique({ where: { name: "owner" } });
  if (!existing) {
    const user = await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password), roles: { create: { roleId: ownerRole.id } } } });
    await prisma.auditLog.create({ data: { userId: user.id, action: "seed_owner_created", resource: "system", metadata: { severity: "info" } } });
    console.log(`Seeded owner user: ${email}`);
  } else console.log(`Owner user already exists: ${email}`);
  await prisma.setting.upsert({ where: { key: "security.require2FA" }, update: {}, create: { key: "security.require2FA", value: false } });
  await prisma.setting.upsert({ where: { key: "updates.autoNotify" }, update: {}, create: { key: "updates.autoNotify", value: true } });
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => prisma.$disconnect());
