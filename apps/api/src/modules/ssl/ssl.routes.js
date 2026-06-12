const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { sslQueue } = require("../../services/queues");
const { normalizeDomain } = require("../../utils/security");

const issueDto = z.object({
  domain: z.string().min(3).max(255),
  email: z.string().email(),
  provider: z.enum(["letsencrypt", "custom"]).default("letsencrypt"),
  force: z.boolean().default(false)
});

const certificateDto = z.object({
  certificateId: z.string().min(1)
});

function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function certificateView(certificate) {
  const days = daysUntil(certificate.expiresAt);
  const lifecycle = days == null ? "unknown" : days < 0 ? "expired" : days <= 30 ? "renewal_due" : "valid";
  return { ...certificate, daysUntilExpiry: days, lifecycle };
}

function summary(certificates) {
  return certificates.reduce((acc, certificate) => {
    acc.total += 1;
    acc[certificate.lifecycle] = (acc[certificate.lifecycle] || 0) + 1;
    return acc;
  }, { total: 0, valid: 0, renewal_due: 0, expired: 0, unknown: 0 });
}

router.use(requireAuth);

router.get("/", requirePermission("ssl.manage"), asyncHandler(async (req, res) => {
  const certificates = (await prisma.sslCertificate.findMany({
    include: { domain: true },
    orderBy: { createdAt: "desc" }
  })).map(certificateView);
  return ok(res, "SSL certificates", { certificates, providers: ["letsencrypt", "custom"], renewalWindowDays: 30, summary: summary(certificates) });
}));

router.post("/issue", requirePermission("ssl.manage"), validate(issueDto), asyncHandler(async (req, res) => {
  let domain;
  try {
    domain = normalizeDomain(req.body.domain);
  } catch (error) {
    return fail(res, 422, error.message, error.code || "INVALID_DOMAIN");
  }

  const domainRow = await prisma.domain.upsert({
    where: { hostname: domain },
    update: { sslEnabled: true },
    create: { hostname: domain, rootDomain: domain.split(".").slice(-2).join("."), dnsStatus: "unknown", sslEnabled: true }
  });
  const job = await sslQueue.add("ssl.issue", { domain, domainId: domainRow.id, email: req.body.email, provider: req.body.provider, userId: req.user.id, force: req.body.force });
  await prisma.auditLog.create({
    data: { userId: req.user.id, action: "ssl_issue_requested", resource: "ssl", resourceId: domainRow.id, metadata: { domain, provider: req.body.provider, force: req.body.force, severity: "info" } }
  });
  return ok(res, "SSL issue queued", { jobId: job.id, domain: domainRow });
}));

router.post("/renew", requirePermission("ssl.manage"), validate(certificateDto), asyncHandler(async (req, res) => {
  const certificate = await prisma.sslCertificate.findUnique({ where: { id: req.body.certificateId } });
  if (!certificate) return fail(res, 404, "Certificate not found", "CERTIFICATE_NOT_FOUND");
  const job = await sslQueue.add("ssl.renew", { certificateId: certificate.id, userId: req.user.id });
  return ok(res, "SSL renewal queued", { jobId: job.id });
}));

router.post("/revoke", requirePermission("ssl.manage"), validate(certificateDto), asyncHandler(async (req, res) => {
  const certificate = await prisma.sslCertificate.findUnique({ where: { id: req.body.certificateId } });
  if (!certificate) return fail(res, 404, "Certificate not found", "CERTIFICATE_NOT_FOUND");
  const job = await sslQueue.add("ssl.revoke", { certificateId: certificate.id, userId: req.user.id });
  await prisma.auditLog.create({ data: { userId: req.user.id, action: "ssl_revoke_requested", resource: "ssl", resourceId: certificate.id, metadata: { severity: "warning" } } });
  return ok(res, "SSL revoke queued", { jobId: job.id });
}));

module.exports = router;
