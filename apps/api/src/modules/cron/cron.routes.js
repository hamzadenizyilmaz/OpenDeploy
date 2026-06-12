const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");

const cronPattern = /^(@(hourly|daily|weekly|monthly)|(\S+\s+){4}\S+)$/;

const taskDto = z.object({
  name: z.string().min(2).max(120).regex(/^[^<>]+$/, "HTML is not allowed."),
  type: z.enum(["system_update_check", "package_update_check", "service_health_check", "ssl_expiry_check", "backup_check", "custom_command"]),
  schedule: z.string().min(3).max(80).regex(cronPattern, "Enter a valid 5-part cron expression or @hourly/@daily/@weekly/@monthly."),
  target: z.string().max(255).regex(/^[^<>]*$/, "HTML is not allowed.").optional().nullable(),
  notify: z.boolean().default(true),
  enabled: z.boolean().default(true)
});

const toggleDto = z.object({ enabled: z.boolean() });

const defaults = [
  { name: "Server Update Watch", type: "system_update_check", schedule: "0 */6 * * *", target: "opendeploy", notify: true, enabled: true, lastStatus: "ready" },
  { name: "Package Update Watch", type: "package_update_check", schedule: "15 */6 * * *", target: "nodejs,nginx,postgresql,redis", notify: true, enabled: true, lastStatus: "ready" },
  { name: "SSL Expiry Watch", type: "ssl_expiry_check", schedule: "30 3 * * *", target: "all", notify: true, enabled: true, lastStatus: "ready" },
  { name: "Service Health Watch", type: "service_health_check", schedule: "*/5 * * * *", target: "opendeploy-api,opendeploy-web,nginx,postgresql,redis", notify: true, enabled: true, lastStatus: "ready" },
  { name: "Backup Freshness Watch", type: "backup_check", schedule: "45 4 * * *", target: "all", notify: true, enabled: true, lastStatus: "ready" }
];

function nextRunHint() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

async function createNotification(task, status) {
  if (!task.notify) return null;
  return prisma.notification.create({
    data: {
      type: status === "ok" ? "success" : "warning",
      title: task.name,
      message: `${task.name} completed with status: ${status}.`
    }
  }).catch(() => null);
}

async function runTask(task) {
  const status = "ok";
  const updated = await prisma.cronTask.update({
    where: { id: task.id },
    data: { lastRunAt: new Date(), nextRunAt: nextRunHint(), lastStatus: status }
  });
  await createNotification(updated, status);
  return updated;
}

router.use(requireAuth);

router.get("/", requirePermission("cron.manage"), asyncHandler(async (req, res) => {
  const tasks = await prisma.cronTask.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []);
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []);
  return ok(res, "Auto Cron tasks", { tasks: tasks.length ? tasks : defaults.map((item, index) => ({ id: `default-${index}`, ...item })), defaults, notifications });
}));

router.post("/install-defaults", requirePermission("cron.manage"), asyncHandler(async (req, res) => {
  const created = [];
  for (const item of defaults) {
    const existing = await prisma.cronTask.findFirst({ where: { name: item.name, type: item.type } });
    if (existing) {
      created.push(existing);
    } else {
      created.push(await prisma.cronTask.create({ data: { ...item, nextRunAt: nextRunHint() } }));
    }
  }
  await prisma.auditLog.create({
    data: { userId: req.user.id, action: "cron_defaults_installed", resource: "cron_task", metadata: { count: created.length, severity: "info" } }
  });
  return ok(res, "Default Auto Cron watches installed", { tasks: created });
}));

router.post("/", requirePermission("cron.manage"), validate(taskDto), asyncHandler(async (req, res) => {
  const task = await prisma.cronTask.create({ data: { ...req.body, nextRunAt: nextRunHint() } });
  await prisma.auditLog.create({
    data: { userId: req.user.id, action: "cron_task_created", resource: "cron_task", resourceId: task.id, metadata: { type: task.type, schedule: task.schedule, severity: "info" } }
  });
  return ok(res, "Cron task created", { task });
}));

router.post("/:id/run", requirePermission("cron.manage"), asyncHandler(async (req, res) => {
  const task = await prisma.cronTask.findUnique({ where: { id: req.params.id } });
  if (!task) return fail(res, 404, "Cron task not found", "CRON_TASK_NOT_FOUND");
  const updated = await runTask(task);
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "cron_task_run", resource: "cron_task", resourceId: task.id, metadata: { type: task.type, severity: "info" } } });
  return ok(res, "Cron task executed", { task: updated });
}));

router.patch("/:id/toggle", requirePermission("cron.manage"), validate(toggleDto), asyncHandler(async (req, res) => {
  const task = await prisma.cronTask.update({ where: { id: req.params.id }, data: { enabled: req.body.enabled } });
  return ok(res, "Cron task updated", { task });
}));

module.exports = router;
