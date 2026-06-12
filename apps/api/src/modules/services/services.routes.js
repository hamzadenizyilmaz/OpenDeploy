const router = require("express").Router();
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { callAgent } = require("../../services/agentClient");

const allowed = [
  "opendeploy-api", "opendeploy-web", "opendeploy-agent", "opendeploy-worker",
  "nginx", "apache2", "httpd", "postgresql", "mysql", "mariadb", "mongod", "redis", "pm2-root"
];

router.use(requireAuth);

router.get("/", requirePermission("services.manage"), asyncHandler(async (req, res) => {
  const services = await Promise.all(allowed.map(async (service) => {
    try {
      return { service, ...(await callAgent("service.status", { service })) };
    } catch (error) {
      return { service, status: "unknown", error: error.message };
    }
  }));
  return ok(res, "Services", { services });
}));

for (const action of ["start", "stop", "restart"]) {
  router.post(`/:service/${action}`, requirePermission("services.manage"), asyncHandler(async (req, res) => {
    const data = await callAgent(`service.${action}`, { service: req.params.service });
    return ok(res, `Service ${action} requested`, data);
  }));
}

module.exports = router;
