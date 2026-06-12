const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { hashPassword, passwordPolicyIssues } = require("../../utils/passwords");

const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const setupDto = z.object({
  name: z.preprocess(normalizeText, z.string().min(2, "Name must be at least 2 characters")),
  email: z.preprocess(normalizeEmail, z.string().min(1, "Email is required").email("Enter a valid email address")),
  password: z.string().superRefine((value, context) => {
    for (const message of passwordPolicyIssues(value)) context.addIssue({ code: z.ZodIssueCode.custom, message });
  })
});

const permissions = [
  "system.manage", "users.manage", "roles.manage", "api_keys.manage", "projects.manage", "deployments.manage",
  "databases.manage", "database.query", "domains.manage", "dns.manage", "ssl.manage", "proxy.manage",
  "firewall.manage", "files.manage", "terminal.use", "services.manage", "backups.manage",
  "settings.manage", "compliance.manage", "enterprise.manage", "audit.read", "monitoring.read", "updates.manage", "cron.manage", "pm2.manage"
];

const rolePermissions = {
  owner: permissions,
  admin: permissions.filter((permission) => !["roles.manage"].includes(permission)),
  developer: ["projects.manage", "deployments.manage", "files.manage", "terminal.use", "pm2.manage", "monitoring.read"],
  database_manager: ["databases.manage", "database.query", "backups.manage", "monitoring.read", "audit.read"],
  viewer: ["monitoring.read", "audit.read"]
};

async function ensureAccessModel(tx) {
  const permissionMap = new Map();
  for (const key of permissions) {
    const permission = await tx.permission.upsert({ where: { key }, update: {}, create: { key, description: key } });
    permissionMap.set(key, permission);
  }

  const roleMap = new Map();
  for (const roleName of Object.keys(rolePermissions)) {
    const role = await tx.role.upsert({ where: { name: roleName }, update: {}, create: { name: roleName, description: `${roleName} role`, isSystem: true } });
    roleMap.set(roleName, role);
    for (const key of rolePermissions[roleName]) {
      const permission = permissionMap.get(key);
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }
  return roleMap;
}

router.get("/status", asyncHandler(async (req, res) => {
  const users = await prisma.user.count();
  return ok(res, "Setup status", { required: users === 0 });
}));

router.post("/", validate(setupDto), asyncHandler(async (req, res) => {
  const users = await prisma.user.count();
  if (users > 0) return fail(res, 409, "OpenDeploy is already configured", "SETUP_ALREADY_DONE");

  await prisma.$transaction(async (tx) => {
    const roles = await ensureAccessModel(tx);
    const user = await tx.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        passwordHash: await hashPassword(req.body.password)
      }
    });

    await tx.userRole.create({ data: { userId: user.id, roleId: roles.get("owner").id } });
    await tx.auditLog.create({ data: { userId: user.id, action: "first_setup_completed", resource: "system" } });
  });

  return ok(res, "First setup completed");
}));

module.exports = router;
