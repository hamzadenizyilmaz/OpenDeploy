const router = require("express").Router();
const { z } = require("zod");
const { env } = require("../../config/env");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { normalizeDomain } = require("../../utils/security");

const recordTypes = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "NS"];
const providerTypes = ["opendeploy_cloud"];

const zoneDto = z.object({
  domain: z.string().min(3).max(255),
  provider: z.enum(providerTypes).default("opendeploy_cloud")
});

const recordDto = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1).max(255),
  type: z.enum(recordTypes),
  value: z.string().min(1).max(2000),
  ttl: z.coerce.number().int().min(60).max(86400).default(env.dnsDefaultTtl),
  priority: z.coerce.number().int().min(0).max(65535).optional().nullable(),
  proxied: z.boolean().default(false)
});

const subdomainDto = z.object({
  zoneId: z.string().min(1),
  label: z.string().min(1).max(120),
  targetType: z.enum(["A", "AAAA", "CNAME"]).default("A"),
  target: z.string().min(1).max(255),
  ttl: z.coerce.number().int().min(60).max(86400).default(env.dnsDefaultTtl),
  proxied: z.boolean().default(false)
});

function cloudStatus() {
  return {
    enabled: env.dnsCloud.enabled,
    configured: Boolean(env.dnsCloud.apiUrl && env.dnsCloud.instanceId && env.dnsCloud.apiKey),
    mode: env.dnsCloud.mode,
    apiUrl: env.dnsCloud.apiUrl,
    adminUrl: env.dnsCloud.adminUrl,
    brandName: env.dnsCloud.brandName,
    brandOwner: env.dnsCloud.brandOwner
  };
}

function dnsCloudReady() {
  return Boolean(env.dnsCloud.enabled && env.dnsCloud.apiUrl && env.dnsCloud.instanceId && env.dnsCloud.apiKey);
}

function requireDnsCloud(res) {
  if (!env.dnsCloud.enabled) {
    fail(res, 409, "DNS Cloud is disabled. Enable DNS_CLOUD_ENABLED and configure DNS_CLOUD_API_URL.", "DNS_CLOUD_DISABLED", { cloud: cloudStatus() });
    return false;
  }
  if (!env.dnsCloud.apiUrl || !env.dnsCloud.instanceId || !env.dnsCloud.apiKey) {
    fail(res, 409, "DNS Cloud is not configured. Set DNS_CLOUD_API_URL, DNS_CLOUD_INSTANCE_ID and DNS_CLOUD_API_KEY.", "DNS_CLOUD_NOT_CONFIGURED", { cloud: cloudStatus() });
    return false;
  }
  return true;
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

function mapCloudDomain(domain) {
  return {
    id: domain.domain,
    domain: domain.domain,
    provider: "opendeploy_cloud",
    status: domain.status,
    nsStatus: domain.nsStatus,
    zoneStatus: domain.zoneStatus,
    nameservers: domain.expectedNameservers || env.dnsNameservers,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    records: (domain.records || []).map((record) => ({
      ...record,
      id: `${domain.domain}::${record.id}`,
      cloudRecordId: record.id,
      zoneId: domain.domain,
      enabled: record.status !== "disabled",
      proxied: false
    }))
  };
}

function zonePresets(zone) {
  return [
    { id: "root-a", name: "@", type: "A", value: env.publicIp, ttl: env.dnsDefaultTtl, enabled: true },
    { id: "www-cname", name: "www", type: "CNAME", value: "@", ttl: env.dnsDefaultTtl, enabled: true },
    { id: "spf-txt", name: "@", type: "TXT", value: "v=spf1 -all", ttl: env.dnsDefaultTtl, enabled: true },
    ...env.dnsNameservers.map((server, index) => ({
      id: `ns-${index + 1}`,
      name: "@",
      type: "NS",
      value: server,
      ttl: 3600,
      enabled: true
    }))
  ].map((record) => ({ ...record, zone: zone?.domain || null }));
}

function parseCloudRecordId(value) {
  const [domain, recordId] = String(value || "").split("::");
  return { domain, recordId };
}

function absoluteName(domain, name) {
  if (!domain) return name || "-";
  if (name === "@") return domain;
  return `${name}.${domain}`;
}

router.use(requireAuth);

router.get("/nameservers", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  return ok(res, "OpenDeploy DNS Cloud nameservers", {
    nameservers: env.dnsNameservers,
    cloud: cloudStatus(),
    glueHint: "Point your registrar NS records to these nameservers. If you host ns1/ns2 under the same domain, create glue records at the registrar."
  });
}));

router.get("/", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  if (!dnsCloudReady()) {
    return ok(res, "DNS Cloud is not ready", {
      zones: [],
      presets: zonePresets(null),
      nameservers: env.dnsNameservers,
      providers: providerTypes,
      cloud: cloudStatus()
    });
  }

  const data = await dnsCloudFetch("/domains");
  const zones = (data.domains || []).map(mapCloudDomain);
  return ok(res, "DNS Cloud zones", {
    zones,
    presets: zonePresets(zones[0]),
    nameservers: env.dnsNameservers,
    providers: providerTypes,
    cloud: cloudStatus()
  });
}));

router.post("/zones", requirePermission("dns.manage"), validate(zoneDto), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  let domain;
  try {
    domain = normalizeDomain(req.body.domain);
  } catch (error) {
    return fail(res, 422, error.message, error.code || "INVALID_DOMAIN");
  }
  const data = await dnsCloudFetch("/domains", {
    method: "POST",
    body: {
      domain,
      targetIp: env.publicIp,
      targetService: "opendeploy",
      createWww: true,
      createSpf: true
    }
  });
  return ok(res, "DNS Cloud domain created", {
    zone: mapCloudDomain(data.domain),
    records: data.domain?.records || [],
    expectedNameservers: data.expectedNameservers || env.dnsNameservers
  });
}));

router.post("/records", requirePermission("dns.manage"), validate(recordDto), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const domain = normalizeDomain(req.body.zoneId);
  const data = await dnsCloudFetch(`/domains/${encodeURIComponent(domain)}/records`, {
    method: "POST",
    body: {
      name: req.body.name,
      type: req.body.type,
      value: req.body.value,
      ttl: req.body.ttl,
      priority: req.body.priority,
      status: "active"
    }
  });
  return ok(res, "DNS Cloud record created", {
    record: data.record,
    records: data.records,
    fqdn: absoluteName(domain, data.record?.name || req.body.name)
  });
}));

router.post("/subdomains", requirePermission("dns.manage"), validate(subdomainDto), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const domain = normalizeDomain(req.body.zoneId);
  const data = await dnsCloudFetch(`/domains/${encodeURIComponent(domain)}/records`, {
    method: "POST",
    body: {
      name: req.body.label,
      type: req.body.targetType,
      value: req.body.target,
      ttl: req.body.ttl,
      status: "active"
    }
  });
  return ok(res, "DNS Cloud subdomain created", {
    record: data.record,
    fqdn: absoluteName(domain, data.record?.name || req.body.label)
  });
}));

router.post("/zones/:id/bootstrap", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const domain = normalizeDomain(req.params.id);
  const data = await dnsCloudFetch(`/domains/${encodeURIComponent(domain)}/sync`, { method: "POST", body: {} });
  return ok(res, "DNS Cloud zone synchronized", data);
}));

router.post("/zones/:id/verify-ns", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const domain = normalizeDomain(req.params.id);
  const data = await dnsCloudFetch(`/domains/${encodeURIComponent(domain)}/verify-ns`, { method: "POST", body: {} });
  return ok(res, "Nameserver verification completed", data);
}));

router.get("/zones/:id/health", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const domain = normalizeDomain(req.params.id);
  const data = await dnsCloudFetch(`/domains/${encodeURIComponent(domain)}/health`);
  return ok(res, "Domain health", data);
}));

router.get("/zones/:id/preview", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const domain = normalizeDomain(req.params.id);
  const data = await dnsCloudFetch(`/zones/${encodeURIComponent(domain)}/preview`);
  return ok(res, "Zone preview", data);
}));

router.delete("/records/:id", requirePermission("dns.manage"), asyncHandler(async (req, res) => {
  if (!requireDnsCloud(res)) return;
  const { domain, recordId } = parseCloudRecordId(req.params.id);
  if (!domain || !recordId) return fail(res, 422, "Invalid DNS Cloud record id", "INVALID_RECORD_ID");
  const data = await dnsCloudFetch(`/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(recordId)}`, { method: "DELETE" });
  return ok(res, "DNS Cloud record deleted", data);
}));

module.exports = router;
