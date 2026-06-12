const dns = require("dns/promises");
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { env } = require("../../config/env");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { normalizeDomain } = require("../../utils/security");

const domainDto = z.object({
  hostname: z.string().min(3).max(255),
  projectId: z.string().optional().nullable(),
  proxyType: z.enum(["nginx", "apache"]).default("nginx"),
  autoSsl: z.boolean().default(true),
  dnsCheck: z.boolean().default(true),
  createDnsCloudZone: z.boolean().default(false)
});

function rootDomainOf(hostname) {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

async function resolveSafe(label, resolver) {
  try {
    const records = await resolver();
    return { status: records.length ? "resolved" : "empty", records };
  } catch (error) {
    return { status: "not_resolved", records: [], error: error.code || error.message, label };
  }
}

async function checkDns(hostname) {
  const [a, aaaa, cname, ns] = await Promise.all([
    resolveSafe("A", () => dns.resolve4(hostname)),
    resolveSafe("AAAA", () => dns.resolve6(hostname)),
    resolveSafe("CNAME", () => dns.resolveCname(hostname)),
    resolveSafe("NS", () => dns.resolveNs(rootDomainOf(hostname)))
  ]);
  const resolved = [a, aaaa, cname].some((item) => item.status === "resolved");
  return {
    status: resolved ? "resolved" : "not_resolved",
    records: { A: a.records, AAAA: aaaa.records, CNAME: cname.records, NS: ns.records },
    checks: { a, aaaa, cname, ns }
  };
}

function dnsCloudReady() {
  return Boolean(env.dnsCloud.enabled && env.dnsCloud.apiUrl && env.dnsCloud.instanceId && env.dnsCloud.apiKey);
}

async function dnsCloudFetch(path, options = {}) {
  const response = await fetch(`${env.dnsCloud.apiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.dnsCloud.apiKey}`,
      "X-OpenDeploy-Instance": env.dnsCloud.instanceId
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || "DNS Cloud request failed");
    error.code = payload.error?.code || "DNS_CLOUD_REQUEST_FAILED";
    error.details = payload.error?.details || {};
    throw error;
  }
  return payload.data || {};
}

async function ensureDnsCloudZone(rootDomain, userId) {
  if (!dnsCloudReady()) {
    throw Object.assign(new Error("DNS Cloud is not configured for domain zone creation"), { code: "DNS_CLOUD_NOT_CONFIGURED" });
  }

  const data = await dnsCloudFetch("/domains", {
    method: "POST",
    body: {
      domain: rootDomain,
      targetIp: env.publicIp,
      targetService: "opendeploy",
      createWww: true,
      createSpf: true
    }
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "domain_dns_cloud_zone_created",
      resource: "dns_cloud_domain",
      resourceId: rootDomain,
      metadata: { rootDomain, severity: "info" }
    }
  }).catch(() => null);

  return data.domain || { domain: rootDomain, provider: "opendeploy_cloud", status: "pending_ns", expectedNameservers: env.dnsNameservers };
}

async function attachDnsCloudZones(items) {
  const roots = [...new Set(items.map((item) => item.rootDomain).filter(Boolean))];
  let zones = [];
  if (roots.length && dnsCloudReady()) {
    try {
      const data = await dnsCloudFetch("/domains");
      zones = (data.domains || []).filter((domain) => roots.includes(domain.domain));
    } catch (error) {
      zones = [];
    }
  }
  const map = new Map(zones.map((zone) => [zone.domain, zone]));
  return items.map((item) => ({ ...item, dnsCloudZone: map.get(item.rootDomain) || null }));
}

router.use(requireAuth);

router.get("/", requirePermission("domains.manage"), asyncHandler(async (req, res) => {
  const items = await prisma.domain.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { project: true, certificate: true }
  });
  return ok(res, "Domain list", { items: await attachDnsCloudZones(items) });
}));

router.post("/", requirePermission("domains.manage"), validate(domainDto), asyncHandler(async (req, res) => {
  let hostname;
  try {
    hostname = normalizeDomain(req.body.hostname);
  } catch (error) {
    return fail(res, 422, error.message, error.code || "INVALID_DOMAIN");
  }

  const rootDomain = rootDomainOf(hostname);
  let dnsCloudZone = null;
  if (req.body.createDnsCloudZone) {
    try {
      dnsCloudZone = await ensureDnsCloudZone(rootDomain, req.user.id);
    } catch (error) {
      return fail(res, 409, error.message, error.code || "DNS_CLOUD_REQUEST_FAILED", error.details || {});
    }
  }
  const dnsResult = req.body.dnsCheck ? await checkDns(hostname) : { status: "skipped", records: {} };

  const item = await prisma.domain.upsert({
    where: { hostname },
    update: {
      rootDomain,
      projectId: req.body.projectId || null,
      proxyType: req.body.proxyType,
      dnsStatus: dnsResult.status,
      sslEnabled: !!req.body.autoSsl
    },
    create: {
      hostname,
      rootDomain,
      projectId: req.body.projectId || null,
      proxyType: req.body.proxyType,
      dnsStatus: dnsResult.status,
      sslEnabled: !!req.body.autoSsl
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "domain_added",
      resource: "domain",
      resourceId: item.id,
      metadata: { hostname, rootDomain, dnsStatus: dnsResult.status, createDnsCloudZone: !!dnsCloudZone, severity: "info" }
    }
  });

  return ok(res, "Domain saved", { item: { ...item, dnsCloudZone }, dns: dnsResult });
}));

router.post("/:id/check-dns", requirePermission("domains.manage"), asyncHandler(async (req, res) => {
  const item = await prisma.domain.findUnique({ where: { id: req.params.id } });
  if (!item) return fail(res, 404, "Domain not found", "DOMAIN_NOT_FOUND");
  const dnsResult = await checkDns(item.hostname);
  const updated = await prisma.domain.update({ where: { id: item.id }, data: { dnsStatus: dnsResult.status } });
  return ok(res, "DNS checked", { item: updated, dns: dnsResult });
}));

router.get("/:id", requirePermission("domains.manage"), asyncHandler(async (req, res) => {
  const item = await prisma.domain.findUnique({
    where: { id: req.params.id },
    include: { project: true, certificate: true }
  });
  if (!item) return fail(res, 404, "Domain not found", "DOMAIN_NOT_FOUND");
  const [withZone] = await attachDnsCloudZones([item]);
  return ok(res, "Domain detail", { item: withZone });
}));

module.exports = router;
