const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { randomSecret } = require("../../utils/crypto");
const { hashApiToken } = require("../../utils/apiTokens");
const { safeName } = require("../../utils/security");

const createDto = z.object({
  name: z.string().min(2).max(80),
  expiresAt: z.string().datetime().optional().nullable()
});

router.use(requireAuth);

router.get("/", requirePermission("api_keys.manage"), asyncHandler(async (req, res) => {
  const keys = await prisma.apiToken.findMany({
    where: { userId: req.user.id },
    select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  return ok(res, "API keys", { keys });
}));

router.post("/", requirePermission("api_keys.manage"), validate(createDto), asyncHandler(async (req, res) => {
  const key = await prisma.apiToken.create({
    data: {
      userId: req.user.id,
      name: safeName(req.body.name),
      tokenHash: "pending",
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null
    },
    select: { id: true, name: true, expiresAt: true, createdAt: true }
  });
  const token = `od_${key.id}_${randomSecret(32)}`;
  await prisma.apiToken.update({ where: { id: key.id }, data: { tokenHash: await hashApiToken(token) } });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "api_key_created", resource: "api_key", resourceId: key.id, metadata: { name: key.name } } });
  return ok(res, "API key created. Copy it now; it will not be shown again.", { key, token });
}));

router.delete("/:id", requirePermission("api_keys.manage"), asyncHandler(async (req, res) => {
  const existing = await prisma.apiToken.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!existing) return fail(res, 404, "API key not found", "API_KEY_NOT_FOUND");
  await prisma.apiToken.delete({ where: { id: existing.id } });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "api_key_revoked", resource: "api_key", resourceId: existing.id } });
  return ok(res, "API key revoked");
}));

module.exports = router;
