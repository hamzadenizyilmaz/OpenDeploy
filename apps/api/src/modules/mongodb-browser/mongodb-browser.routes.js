const router = require("express").Router();
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");

router.use(requireAuth);

router.get("/", requirePermission("databases.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Mongodb Browser module", {
    module: "mongodb-browser",
    status: "scaffolded",
    note: "Production adapter can be implemented in this module."
  });
}));

module.exports = router;
