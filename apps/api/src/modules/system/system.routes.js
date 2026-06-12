const router = require("express").Router();
const os = require("os");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { callAgent } = require("../../services/agentClient");

router.use(requireAuth);

router.get("/info", requirePermission("monitoring.read"), asyncHandler(async (req, res) => {
  const agent = await callAgent("system.metrics");
  return ok(res, "System info", {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    uptime: os.uptime(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    agent
  });
}));

module.exports = router;
