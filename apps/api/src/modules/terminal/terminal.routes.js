const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");

const allowedCommands = ["npm install", "npm run build", "npm test", "pnpm install", "pnpm build", "yarn install", "yarn build", "prisma migrate deploy", "prisma generate", "pm2 logs", "pm2 restart", "git status", "git pull"];
const blocked = [/[\r\n]/, /[;&|`<>]/, /\$\(/, /\brm\s+-rf\b/i, /\bdd\b/i, /\bmkfs\b/i, /\bshutdown\b/i, /\breboot\b/i, /:\(\)\s*\{/i, /curl\s+.*\|\s*(bash|sh)/i, /wget\s+.*\|\s*(bash|sh)/i];
const sessionDto = z.object({
  cwd: z.string().max(500).regex(/^[^<>|;&`]*$/, "Invalid working directory.").default("."),
  command: z.string().max(500).optional(),
  requireSudoConfirmation: z.boolean().default(false)
});
function isAllowedCommand(command) {
  const normalized = String(command || "").trim().replace(/\s+/g, " ");
  return allowedCommands.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed} `));
}
router.use(requireAuth);
router.get("/allowlist", requirePermission("terminal.use"), asyncHandler(async (req, res) => ok(res, "Terminal allowlist", { allowedCommands, blocked: blocked.map(String) })));
router.get("/", requirePermission("terminal.use"), asyncHandler(async (req, res) => { const sessions = await prisma.terminalSession.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" }, take: 100 }); return ok(res, "Terminal sessions", { sessions, allowedCommands }); }));
router.post("/sessions", requirePermission("terminal.use"), validate(sessionDto), asyncHandler(async (req, res) => {
  const command = req.body.command || "";
  if (blocked.some((pattern) => pattern.test(command))) return fail(res, 409, "Dangerous command blocked by OpenDeploy terminal guard", "DANGEROUS_COMMAND_BLOCKED");
  if (command && !isAllowedCommand(command)) return fail(res, 409, "Command is not in the OpenDeploy terminal allowlist", "COMMAND_NOT_ALLOWLISTED", { allowedCommands });
  if (/\bsudo\b/.test(command) && !req.body.requireSudoConfirmation) return fail(res, 409, "sudo command requires explicit confirmation", "SUDO_CONFIRMATION_REQUIRED");
  const session = await prisma.terminalSession.create({ data: { userId: req.user.id, cwd: req.body.cwd, command, status: "created" } });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "terminal_command_requested", resource: "terminal", resourceId: session.id, metadata: { cwd: session.cwd, command } } });
  return ok(res, "Terminal session created", { session });
}));
module.exports = router;
