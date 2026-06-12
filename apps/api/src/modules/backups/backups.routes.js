const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { backupQueue } = require("../../services/queues");

const targets = ["local", "sftp", "ftp", "s3", "minio", "cloudflare_r2"];
const backupDto = z.object({ type: z.enum(["full", "project", "database", "panel", "env", "nginx", "apache"]).default("full"), target: z.enum(targets).default("local"), encrypted: z.boolean().default(true), retentionDays: z.number().int().min(1).max(365).default(14) });
router.use(requireAuth);
router.get("/targets", requirePermission("backups.manage"), asyncHandler(async (req, res) => ok(res, "Backup targets", { targets: targets.map((id)=>({ id, name: id.replace(/_/g," ").toUpperCase(), encrypted: id !== "local" })) })));
router.get("/", requirePermission("backups.manage"), asyncHandler(async (req, res) => { const backups = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 100 }); return ok(res, "Backups", { backups, targets }); }));
router.post("/", requirePermission("backups.manage"), validate(backupDto), asyncHandler(async (req, res) => { const backup = await prisma.backup.create({ data: { type: req.body.type, target: req.body.target, encrypted: req.body.encrypted, status: "queued" } }); const job = await backupQueue.add("backup.create", { backupId: backup.id, userId: req.user.id, retentionDays: req.body.retentionDays }); await prisma.auditLog.create({ data: { userId: req.user.id, action: "backup_queued", resource: "backup", resourceId: backup.id, metadata: { type: req.body.type, target: req.body.target, encrypted: req.body.encrypted, retentionDays: req.body.retentionDays, severity: "info" } } }); return ok(res, "Backup queued", { backup, jobId: job.id }); }));
router.post("/:id/restore", requirePermission("backups.manage"), asyncHandler(async (req, res) => { const job = await backupQueue.add("backup.restore", { backupId: req.params.id, userId: req.user.id, preRestoreBackup: true }); return ok(res, "Restore queued with pre-restore safety backup", { jobId: job.id }); }));
module.exports = router;