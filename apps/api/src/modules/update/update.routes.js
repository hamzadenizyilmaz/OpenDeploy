const router = require("express").Router();
const { z } = require("zod");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { updateQueue } = require("../../services/queues");
const { env } = require("../../config/env");
const { prisma } = require("../../config/prisma");

const runDto = z.object({
  force: z.boolean().default(false),
  backup: z.boolean().default(true)
});

const rollbackDto = z.object({
  version: z.string().max(80).default("previous")
});

function normalizeVersion(value) {
  return String(value || "0.0.0").trim().replace(/^v/i, "");
}

function compareVersions(a, b) {
  const left = normalizeVersion(a).split(/[.-]/).map((item) => Number.parseInt(item, 10) || 0);
  const right = normalizeVersion(b).split(/[.-]/).map((item) => Number.parseInt(item, 10) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if ((left[index] || 0) > (right[index] || 0)) return 1;
    if ((left[index] || 0) < (right[index] || 0)) return -1;
  }
  return 0;
}

async function latestGithubRelease() {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "OpenDeploy-Update-Checker"
  };
  if (env.githubToken) headers.Authorization = `Bearer ${env.githubToken}`;

  const response = await fetch(`https://api.github.com/repos/${env.githubRepo}/releases/latest`, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return latestGithubTag(headers, body.message || "GitHub release check failed");
  }
  return {
    version: normalizeVersion(body.tag_name || body.name),
    tag: body.tag_name,
    name: body.name,
    url: body.html_url,
    publishedAt: body.published_at
  };
}

async function latestGithubTag(headers, warning) {
  const response = await fetch(`https://api.github.com/repos/${env.githubRepo}/tags?per_page=100`, { headers });
  const body = await response.json().catch(() => []);
  if (!response.ok || !Array.isArray(body) || !body.length) {
    const error = new Error(warning || "GitHub tag check failed");
    error.status = response.status;
    throw error;
  }
  const tag = body
    .map((item) => String(item.name || ""))
    .filter(Boolean)
    .sort((a, b) => compareVersions(a, b))
    .pop();
  return {
    version: normalizeVersion(tag),
    tag,
    name: tag,
    url: `https://github.com/${env.githubRepo}/releases/tag/${encodeURIComponent(tag)}`,
    publishedAt: null
  };
}

router.use(requireAuth);

router.get("/status", requirePermission("updates.manage"), asyncHandler(async (req, res) => {
  const currentVersion = normalizeVersion(env.version);
  let release = null;
  let releaseWarning = null;
  try {
    release = await latestGithubRelease();
  } catch (error) {
    releaseWarning = error.message;
    release = { version: currentVersion, tag: `v${currentVersion}`, url: null, publishedAt: null };
  }

  const updateAvailable = compareVersions(release.version, currentVersion) > 0;
  return ok(res, "Update status", {
    currentVersion,
    latestVersion: release.version,
    updateAvailable,
    release,
    releaseWarning,
    repository: env.githubRepo,
    checkedAt: new Date().toISOString(),
    serverPackages: [
      { name: "nodejs", current: "LTS", latest: "LTS", status: "ok" },
      { name: "npm", current: "managed", latest: "managed", status: "ok" },
      { name: "nginx", current: "system", latest: "system", status: "checking" },
      { name: "postgresql", current: "system", latest: "system", status: "checking" },
      { name: "redis", current: "system", latest: "system", status: "checking" }
    ],
    services: ["opendeploy-api", "opendeploy-web", "opendeploy-agent", "opendeploy-worker", "nginx", "postgresql", "redis"],
    cronWatch: "Enable Auto Cron Server Update Watch to receive notifications.",
    rollbackReady: true,
    backupRequired: true
  });
}));

router.post("/run", requirePermission("updates.manage"), validate(runDto), asyncHandler(async (req, res) => {
  const job = await updateQueue.add("system.update", { userId: req.user.id, force: !!req.body.force, backup: req.body.backup !== false });
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "update_queued",
      resource: "system_update",
      metadata: { force: !!req.body.force, backup: req.body.backup !== false, severity: "warning" }
    }
  });
  return ok(res, "Server update queued", { jobId: job.id, backup: req.body.backup !== false });
}));

router.post("/rollback", requirePermission("updates.manage"), validate(rollbackDto), asyncHandler(async (req, res) => {
  const job = await updateQueue.add("system.rollback", { userId: req.user.id, version: req.body.version || "previous" });
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "rollback_queued",
      resource: "system_update",
      metadata: { version: req.body.version || "previous", severity: "critical" }
    }
  });
  return ok(res, "Rollback queued", { jobId: job.id });
}));

module.exports = router;
