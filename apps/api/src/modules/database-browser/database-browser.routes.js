const router = require("express").Router();
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");

router.use(requireAuth);

router.get("/servers", requirePermission("databases.manage"), asyncHandler(async (req, res) => {
  const servers = await prisma.databaseServer.findMany({ include: { databases: true, users: true } });
  return ok(res, "Database servers", { servers });
}));

router.get("/servers/:id/tree", requirePermission("databases.manage"), asyncHandler(async (req, res) => {
  const server = await prisma.databaseServer.findUnique({ where: { id: req.params.id }, include: { databases: true } });
  return ok(res, "Database tree", {
    server,
    tree: server ? server.databases.map((db) => ({ type: "database", name: db.name, children: [] })) : []
  });
}));

router.get("/servers/:id/tables", requirePermission("databases.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Tables", {
    tables: [],
    note: "Engine-specific table adapters are ready to be implemented."
  });
}));

module.exports = router;
