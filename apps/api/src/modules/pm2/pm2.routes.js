const router = require("express").Router();
const { z } = require("zod");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { callAgent } = require("../../services/agentClient");

const actionDto = z.object({ name: z.string().min(1).max(120) });
const sample = [
  { id: "pm2-api", name: "opendeploy-api", status: "running", cpu: 1.2, memory: "128 MB", restarts: 0, uptime: "2h" },
  { id: "pm2-web", name: "opendeploy-web", status: "running", cpu: 0.7, memory: "184 MB", restarts: 0, uptime: "2h" }
];

router.use(requireAuth);

router.get("/", requirePermission("pm2.manage"), asyncHandler(async (req, res) => {
  const data = await callAgent("pm2.list", {}).catch((error) => ({ processes: sample, warning: error.message }));
  return ok(res, "PM2 process list", data.processes ? data : { processes: sample });
}));

for (const action of ["restart", "stop", "start", "reload", "delete"]) {
  router.post(`/${action}`, requirePermission("pm2.manage"), validate(actionDto), asyncHandler(async (req, res) => {
    const data = await callAgent(`pm2.${action}`, req.body).catch((error) => ({ dryRun: true, warning: error.message, name: req.body.name }));
    return ok(res, `PM2 ${action} requested`, data);
  }));
}

module.exports = router;
