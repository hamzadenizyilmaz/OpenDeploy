const router = require("express").Router();
const fs = require("fs/promises");
const path = require("path");
const { z } = require("zod");
const { env } = require("../../config/env");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { safeResolve } = require("../../utils/paths");

const fileDto = z.object({ path: z.string().default("."), content: z.string().max(500000).optional() });
const createDto = z.object({ path: z.string().min(1).max(500), type: z.enum(["file", "directory"]).default("file"), content: z.string().max(500000).optional() });
const actionDto = z.object({ from: z.string().min(1).max(500), to: z.string().min(1).max(500).optional() });
const deleteDto = z.object({ from: z.string().min(1).max(500), confirm: z.literal("delete") });
const blocked = [/^\/?etc\b/, /^\/?root\b/, /^\/?var\/lib\b/, /\.ssh\b/, /(^|\/)\.env(\.|$)?/i, /id_rsa/i, /\.(pem|key|p12|pfx)$/i];
function assertSafeUserPath(value) { if (blocked.some((pattern) => pattern.test(String(value)))) { const e = new Error("Protected system path is blocked"); e.status = 403; throw e; } }
async function auditFile(req, action, filePath, details = {}) { await prisma.filesAudit.create({ data: { userId: req.user.id, action, path: filePath, details } }).catch(() => null); await prisma.auditLog.create({ data: { userId: req.user.id, action: `file_${action}`, resource: "file", metadata: { path: filePath } } }).catch(() => null); }
function isBinary(buffer) { return buffer.includes(0); }

router.use(requireAuth);
router.get("/", requirePermission("files.manage"), asyncHandler(async (req, res) => {
  await fs.mkdir(env.projectsRoot, { recursive: true });
  assertSafeUserPath(req.query.path || ".");
  const target = safeResolve(env.projectsRoot, req.query.path || ".");
  const entries = await fs.readdir(target, { withFileTypes: true });
  const rows = await Promise.all(entries.map(async (entry) => { const full = path.join(target, entry.name); const relative = path.relative(env.projectsRoot, full); const st = await fs.stat(full).catch(() => null); const type = entry.isDirectory() ? "directory" : "file"; const blockedPath = blocked.some((pattern) => pattern.test(relative)); return { id: entry.name, name: entry.name, path: relative, type, size: st?.size || 0, updatedAt: st?.mtime || null, permissions: st ? (st.mode & 0o777).toString(8) : "", editable: type === "file" && !blockedPath && (st?.size || 0) <= 1024 * 1024, protected: blockedPath }; }));
  return ok(res, "Files", { root: env.projectsRoot, path: path.relative(env.projectsRoot, target) || ".", entries: rows.sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name)) });
}));
router.post("/create", requirePermission("files.manage"), validate(createDto), asyncHandler(async (req, res) => {
  assertSafeUserPath(req.body.path); const target = safeResolve(env.projectsRoot, req.body.path);
  if (req.body.type === "directory") await fs.mkdir(target, { recursive: true }); else { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, req.body.content || "", { flag: "wx", mode: 0o640 }); }
  await auditFile(req, "created", req.body.path, { type: req.body.type });
  return ok(res, "File entry created", { path: req.body.path, type: req.body.type });
}));
router.post("/read", requirePermission("files.manage"), validate(fileDto), asyncHandler(async (req, res) => { assertSafeUserPath(req.body.path); const target = safeResolve(env.projectsRoot, req.body.path); const st = await fs.stat(target); if (st.isDirectory()) return fail(res, 409, "Directories cannot be opened as files", "DIRECTORY_READ_BLOCKED"); if (st.size > 1024 * 1024) return fail(res, 413, "File is too large for browser editing", "FILE_TOO_LARGE"); const raw = await fs.readFile(target); if (isBinary(raw)) return fail(res, 415, "Binary files cannot be edited in the browser", "BINARY_FILE_BLOCKED"); return ok(res, "File content", { path: req.body.path, content: raw.toString("utf8") }); }));
router.post("/write", requirePermission("files.manage"), validate(fileDto), asyncHandler(async (req, res) => { assertSafeUserPath(req.body.path); const target = safeResolve(env.projectsRoot, req.body.path); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, req.body.content || "", "utf8"); await auditFile(req, "written", req.body.path); return ok(res, "File written", { path: req.body.path }); }));
router.post("/rename", requirePermission("files.manage"), validate(actionDto), asyncHandler(async (req, res) => { assertSafeUserPath(req.body.from); assertSafeUserPath(req.body.to); await fs.rename(safeResolve(env.projectsRoot, req.body.from), safeResolve(env.projectsRoot, req.body.to)); await auditFile(req, "renamed", req.body.from, { to: req.body.to }); return ok(res, "File renamed"); }));
router.post("/delete", requirePermission("files.manage"), validate(deleteDto), asyncHandler(async (req, res) => { assertSafeUserPath(req.body.from); await fs.rm(safeResolve(env.projectsRoot, req.body.from), { recursive: true, force: false }); await auditFile(req, "deleted", req.body.from, { confirmed: true }); return ok(res, "File deleted"); }));
module.exports = router;
