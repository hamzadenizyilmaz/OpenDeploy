const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { hashPassword, passwordPolicyIssues } = require("../../utils/passwords");

const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();

const userCreateDto = z.object({
  name: z.preprocess(normalizeText, z.string().min(2, "Name must be at least 2 characters")),
  email: z.preprocess(normalizeEmail, z.string().min(1, "Email is required").email("Enter a valid email address")),
  password: z.string().superRefine((value, context) => {
    for (const message of passwordPolicyIssues(value)) context.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  role: z.preprocess(normalizeText, z.string().min(1).default("developer"))
});

const statusDto = z.object({
  status: z.enum(["active", "disabled", "locked"])
});

router.use(requireAuth);

router.get("/", requirePermission("users.manage"), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      twoFactorOn: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { include: { role: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  return ok(res, "Users", { users });
}));

router.post("/", requirePermission("users.manage"), validate(userCreateDto), asyncHandler(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { name: req.body.role } });
  const user = await prisma.user.create({
    data: {
      name: req.body.name,
      email: req.body.email,
      passwordHash: await hashPassword(req.body.password),
      roles: role ? { create: { roleId: role.id } } : undefined
    },
    select: { id: true, email: true, name: true, status: true, createdAt: true }
  });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "user_created", resource: "user", resourceId: user.id, metadata: { email: user.email } } });
  return ok(res, "User created", { user });
}));

router.patch("/:id/status", requirePermission("users.manage"), validate(statusDto), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: req.body.status }, select: { id: true, email: true, name: true, status: true } });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "user_status_changed", resource: "user", resourceId: user.id, metadata: { status: user.status } } });
  return ok(res, "User status updated", { user });
}));

router.get("/:id", requirePermission("users.manage"), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      twoFactorOn: true,
      lastLoginAt: true,
      createdAt: true,
      roles: { include: { role: true } }
    }
  });
  return ok(res, "User detail", { user });
}));

module.exports = router;
