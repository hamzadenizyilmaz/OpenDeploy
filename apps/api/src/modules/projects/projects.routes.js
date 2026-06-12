const router = require("express").Router();
const { prisma } = require("../../config/prisma");
const { deployQueue } = require("../../services/queues");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { audit } = require("../../middleware/audit");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { projectCreateDto } = require("./projects.dto");

router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return ok(res, "Projects", { projects });
}));

router.post("/", requirePermission("projects.manage"), validate(projectCreateDto), audit("project_created", "project"), asyncHandler(async (req, res) => {
  const project = await prisma.project.create({ data: req.body });
  return ok(res, "Project created", { project });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { envs: true, deployments: { orderBy: { createdAt: "desc" }, take: 20 }, domains: true }
  });
  return ok(res, "Project detail", { project });
}));

router.post("/:id/deploy", requirePermission("deployments.manage"), audit("deploy_started", "deployment"), asyncHandler(async (req, res) => {
  const deployment = await prisma.deployment.create({
    data: { projectId: req.params.id, userId: req.user.id, status: "queued", source: req.body.source || "manual" }
  });
  await deployQueue.add("deploy.project", { deploymentId: deployment.id, projectId: req.params.id, userId: req.user.id });
  return ok(res, "Deployment queued", { deployment });
}));

router.post("/:id/start", requirePermission("projects.manage"), audit("project_started", "project"), asyncHandler(async (req, res) => {
  await prisma.project.update({ where: { id: req.params.id }, data: { status: "running" } });
  return ok(res, "Project start requested");
}));

router.post("/:id/stop", requirePermission("projects.manage"), audit("project_stopped", "project"), asyncHandler(async (req, res) => {
  await prisma.project.update({ where: { id: req.params.id }, data: { status: "stopped" } });
  return ok(res, "Project stop requested");
}));

module.exports = router;
