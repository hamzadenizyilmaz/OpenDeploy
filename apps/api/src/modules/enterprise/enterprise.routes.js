const crypto = require("crypto");
const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { env } = require("../../config/env");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { maskSensitive } = require("../../utils/security");

const dryRunDto = z.object({
  operation: z.string().min(2).max(120),
  scope: z.string().min(2).max(120).default("global"),
  items: z.array(z.any()).default([])
});

const webhookDto = z.object({
  name: z.string().min(2).max(120),
  url: z.string().url(),
  events: z.array(z.string().min(2).max(120)).min(1).max(50),
  secret: z.string().min(16).max(200).optional()
});

const signedReleaseDto = z.object({
  version: z.string().min(2).max(80),
  digest: z.string().min(16).max(256),
  signature: z.string().min(16).max(2048).optional()
});

const scaleCapabilities = [
  { key: "teams", label: "Team/project ownership", status: "available", endpoint: "/api/enterprise/teams" },
  { key: "project-rbac", label: "Project-level RBAC", status: "available", endpoint: "/api/enterprise/permissions" },
  { key: "environment-permissions", label: "Environment-level permissions", status: "available", endpoint: "/api/enterprise/permissions" },
  { key: "workflow-builder", label: "Workflow automation builder", status: "available", endpoint: "/api/enterprise/workflows" },
  { key: "maintenance-windows", label: "Maintenance windows", status: "available", endpoint: "/api/enterprise/maintenance" },
  { key: "notification-routing", label: "Notification routing", status: "available", endpoint: "/api/enterprise/notifications" },
  { key: "signed-webhooks", label: "Signed webhook subscriptions", status: "available", endpoint: "/api/enterprise/webhooks" },
  { key: "terraform", label: "Terraform provider planning", status: "available", endpoint: "/api/enterprise/terraform" },
  { key: "cli-dry-run", label: "CLI dry-run commands", status: "available", endpoint: "/api/enterprise/cli" },
  { key: "bulk-dry-run", label: "Bulk import/export dry-run", status: "available", endpoint: "/api/enterprise/bulk/dry-run" },
  { key: "queue-isolation", label: "Queue isolation", status: "available", endpoint: "/api/enterprise/queues" },
  { key: "worker-concurrency", label: "Worker concurrency controls", status: "available", endpoint: "/api/enterprise/queues" }
];

const enterpriseCapabilities = [
  { key: "organizations", label: "Multi-tenant organization model", status: "control_surface", endpoint: "/api/enterprise/organizations" },
  { key: "sso", label: "SSO / SAML / OIDC control surface", status: "control_surface", endpoint: "/api/enterprise/sso" },
  { key: "scim", label: "SCIM provisioning control surface", status: "control_surface", endpoint: "/api/enterprise/scim" },
  { key: "fine-grained-permissions", label: "Fine-grained permissions", status: "available", endpoint: "/api/enterprise/permissions" },
  { key: "ha-api", label: "HA API profile", status: "profile", endpoint: "/api/enterprise/ha" },
  { key: "ha-dns", label: "HA DNS profile", status: "profile", endpoint: "/api/enterprise/dns" },
  { key: "multi-region-dns", label: "Multi-region DNS", status: "profile", endpoint: "/api/enterprise/dns" },
  { key: "dnssec", label: "DNSSEC control surface", status: "control_surface", endpoint: "/api/enterprise/dnssec" },
  { key: "enterprise-waf", label: "Enterprise WAF policy surface", status: "available", endpoint: "/api/enterprise/waf" },
  { key: "policy-as-code", label: "Policy-as-code", status: "available", endpoint: "/api/enterprise/policy-as-code" },
  { key: "immutable-audit", label: "Immutable audit archive", status: "available", endpoint: "/api/enterprise/immutable-audit" },
  { key: "siem", label: "SIEM export", status: "available", endpoint: "/api/enterprise/siem" },
  { key: "metrics", label: "Long-term metrics storage", status: "profile", endpoint: "/api/enterprise/metrics" },
  { key: "dr", label: "Disaster recovery runbooks", status: "available", endpoint: "/api/enterprise/dr" },
  { key: "release-verification", label: "Signed release verification", status: "available", endpoint: "/api/enterprise/releases/verify" },
  { key: "agent-channels", label: "Agent update channels", status: "available", endpoint: "/api/enterprise/agent-channels" },
  { key: "backup-encryption", label: "Enterprise backup encryption", status: "available", endpoint: "/api/enterprise/backup-encryption" },
  { key: "support-bundle", label: "Support bundle export", status: "available", endpoint: "/api/enterprise/support-bundle" }
];

function signPayload(payload, secret = env.jwtAccessSecret) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

function control(key, label, status, detail) {
  return { key, label, status, detail };
}

function actor(req) {
  return { id: req.user.id, email: req.user.email, roles: req.user.roles };
}

function permissionMatrix() {
  return [
    { scope: "organization", permissions: ["org.read", "org.manage", "org.billing", "org.audit"] },
    { scope: "project", permissions: ["project.read", "project.deploy", "project.env.manage", "project.backup", "project.delete"] },
    { scope: "environment", permissions: ["env.dev", "env.staging", "env.production", "env.secrets.manage"] },
    { scope: "dns", permissions: ["dns.zone.read", "dns.zone.write", "dnssec.manage", "dns.region.manage"] },
    { scope: "security", permissions: ["waf.manage", "rate_limit.manage", "challenge.manage", "policy.manage"] }
  ];
}

router.use(requireAuth);

router.get(["/", "/overview"], requirePermission("enterprise.manage"), asyncHandler(async (req, res) => {
  const [projects, users, projectMembers, deployments, backups] = await Promise.all([
    prisma.project.count(),
    prisma.user.count(),
    prisma.projectMember.count(),
    prisma.deployment.count(),
    prisma.backup.count()
  ]);
  return ok(res, "Enterprise operations overview", {
    releaseTrack: "v2.0.0 Enterprise Ops",
    nextTrack: "v2.2.0 Enterprise Dev",
    generatedAt: new Date().toISOString(),
    actor: actor(req),
    inventory: { projects, users, projectMembers, deployments, backups },
    scaleCapabilities,
    enterpriseCapabilities,
    readiness: [
      control("ha-api", "HA API profile documented", "ready", "Nginx/LB, multiple API workers, shared PostgreSQL, shared Redis and stateless JWT verification."),
      control("ha-dns", "HA DNS profile documented", "ready", "Multiple authoritative DNS_NameServer nodes with zone snapshot cache and no recursion."),
      control("approval-gates", "Critical workflows support approval gates", "ready", "Compliance approval endpoint records destructive action approval requests."),
      control("audit-export", "Security controls exportable for audit", "ready", "Compliance audit export uses SHA-256 hash chain."),
      control("restore", "Restore workflows tested from external backups", "planned", "Run restore dry-run per provider before release certification.")
    ]
  });
}));

router.get("/organizations", requirePermission("enterprise.manage"), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, status: true, createdAt: true }, take: 200 });
  return ok(res, "Multi-tenant organization model", {
    model: {
      organization: ["id", "name", "slug", "plan", "status", "createdAt"],
      membership: ["organizationId", "userId", "role", "joinedAt"],
      isolation: ["projects", "domains", "dns zones", "api keys", "audit logs"]
    },
    currentSingleTenantProjection: { organization: "default", users }
  });
}));

router.get("/teams", requirePermission("enterprise.manage"), asyncHandler(async (req, res) => {
  const members = await prisma.projectMember.findMany({
    include: { project: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, email: true, name: true } } },
    take: 300
  });
  return ok(res, "Team and project ownership", {
    ownershipModel: ["owner", "maintainer", "developer", "database_manager", "viewer"],
    members
  });
}));

router.get("/permissions", requirePermission("enterprise.manage"), (req, res) => ok(res, "Fine-grained permissions", {
  matrix: permissionMatrix(),
  inheritance: ["organization", "project", "environment", "resource"],
  enforcement: "RBAC middleware plus project/environment scopes for enterprise deployments."
}));

router.get("/sso", requirePermission("enterprise.manage"), (req, res) => ok(res, "SSO / SAML / OIDC control surface", {
  providers: [
    { type: "oidc", status: "planned_configurable", requiredFields: ["issuer", "clientId", "clientSecret", "allowedDomains", "roleMapping"] },
    { type: "saml", status: "planned_configurable", requiredFields: ["metadataUrl", "entityId", "acsUrl", "certificate", "roleMapping"] }
  ],
  controls: ["domain verification", "forced SSO", "break-glass owner", "signed metadata", "role mapping dry-run"]
}));

router.get("/scim", requirePermission("enterprise.manage"), (req, res) => ok(res, "SCIM provisioning control surface", {
  resources: ["Users", "Groups", "EnterpriseUser", "Group membership"],
  controls: ["token rotation", "dry-run imports", "deprovision lock mode", "audit every provisioning action"]
}));

router.get("/workflows", requirePermission("enterprise.manage"), (req, res) => ok(res, "Workflow automation builder", {
  triggers: ["deployment.completed", "backup.failed", "ssl.expiring", "dns.ns.invalid", "security.event.critical"],
  actions: ["notify", "queue_backup", "run_health_check", "create_approval", "pause_deployments"],
  safety: ["dry-run", "audit log", "approval gate", "rate limit", "rollback note"]
}));

router.get("/maintenance", requirePermission("enterprise.manage"), (req, res) => ok(res, "Maintenance windows", {
  windowFields: ["name", "scope", "startsAt", "endsAt", "timezone", "allowedActions", "notificationRoutes"],
  enforcement: ["deployment pause", "update allow window", "backup priority override", "alert silence"]
}));

router.get("/notifications", requirePermission("enterprise.manage"), (req, res) => ok(res, "Notification routing", {
  routes: [
    { severity: "critical", channels: ["email", "webhook"], escalationMinutes: 10 },
    { severity: "warning", channels: ["email"], escalationMinutes: 60 },
    { severity: "info", channels: ["dashboard"], escalationMinutes: null }
  ],
  matchers: ["project", "environment", "service", "security category", "backup provider"]
}));

router.get("/webhooks", requirePermission("enterprise.manage"), (req, res) => ok(res, "Signed webhook subscriptions", {
  signatureHeader: "X-OpenDeploy-Signature",
  timestampHeader: "X-OpenDeploy-Timestamp",
  algorithms: ["hmac-sha256"],
  events: ["deployment.*", "backup.*", "dns.*", "security.*", "audit.exported"]
}));

router.post("/webhooks/dry-run", requirePermission("enterprise.manage"), validate(webhookDto), asyncHandler(async (req, res) => {
  const payload = { event: "webhook.dry_run", subscription: req.body.name, url: req.body.url, events: req.body.events, generatedAt: new Date().toISOString() };
  return ok(res, "Signed webhook dry-run", {
    payload,
    headers: {
      "X-OpenDeploy-Timestamp": payload.generatedAt,
      "X-OpenDeploy-Signature": signPayload(payload, req.body.secret || env.jwtAccessSecret)
    }
  });
}));

router.get("/terraform", requirePermission("enterprise.manage"), (req, res) => ok(res, "Terraform provider planning", {
  resources: ["opendeploy_project", "opendeploy_domain", "opendeploy_dns_record", "opendeploy_backup_job", "opendeploy_api_key"],
  dataSources: ["opendeploy_project", "opendeploy_domains", "opendeploy_security_baseline"],
  safety: ["plan-only mode", "destructive approval", "sensitive state masking"]
}));

router.get("/cli", requirePermission("enterprise.manage"), (req, res) => ok(res, "CLI dry-run commands", {
  commands: [
    "opendeploy deploy --project app --dry-run",
    "opendeploy backup create --target s3 --dry-run",
    "opendeploy dns import zone.json --dry-run",
    "opendeploy policy apply policy.yaml --dry-run"
  ],
  outputContract: ["changes", "warnings", "approvalRequired", "auditPreview"]
}));

router.post("/bulk/dry-run", requirePermission("enterprise.manage"), validate(dryRunDto), (req, res) => ok(res, "Bulk import/export dry-run", {
  operation: req.body.operation,
  scope: req.body.scope,
  itemCount: req.body.items.length,
  changes: req.body.items.map((item, index) => ({ index, action: "would_validate", item: maskSensitive(item) })),
  approvalRequired: req.body.items.length > 25
}));

router.get("/queues", requirePermission("enterprise.manage"), (req, res) => ok(res, "Queue isolation and worker concurrency", {
  queues: [
    { name: "deploy", concurrency: 2, isolation: "project" },
    { name: "backup", concurrency: 1, isolation: "provider" },
    { name: "ssl", concurrency: 3, isolation: "domain" },
    { name: "monitoring", concurrency: 5, isolation: "host" },
    { name: "update", concurrency: 1, isolation: "server" }
  ],
  controls: ["pause queue", "drain queue", "retry failed", "dead-letter review", "per-job-type concurrency"]
}));

router.get("/ha", requirePermission("enterprise.manage"), (req, res) => ok(res, "High availability profiles", {
  api: {
    nodes: "2+ API nodes behind TLS load balancer",
    state: "PostgreSQL + Redis shared state",
    sessions: "JWT + revocable refresh sessions",
    deploys: "Worker queues isolated by job type"
  },
  web: {
    nodes: "2+ Next.js nodes",
    assets: "standalone build or container image",
    health: ["/health", "/api/docs/openapi.json"]
  }
}));

router.get("/dns", requirePermission("enterprise.manage"), (req, res) => ok(res, "HA DNS and multi-region DNS profile", {
  authoritative: {
    recursion: false,
    nodes: ["dp-ns1", "dp-ns2", "regional edge nodes"],
    zoneSource: "signed snapshot from DNS Cloud",
    cache: "last valid zone cache"
  },
  regions: [
    { region: "eu-central", role: "primary", health: "required" },
    { region: "us-east", role: "secondary", health: "required" },
    { region: "ap-south", role: "optional", health: "planned" }
  ],
  safeguards: ["SOA serial monotonicity", "snapshot validation", "DNSSEC signing workflow", "audit export"]
}));

router.get("/dnssec", requirePermission("enterprise.manage"), (req, res) => ok(res, "DNSSEC signing and rotation control surface", {
  keys: [
    { type: "KSK", algorithm: "ECDSAP256SHA256", state: "planned", rotation: "annual" },
    { type: "ZSK", algorithm: "ECDSAP256SHA256", state: "planned", rotation: "quarterly" }
  ],
  workflows: ["generate", "pre-publish", "sign", "DS publish", "rollover", "retire"],
  audit: "Every signing and rotation step requires audit and optional approval."
}));

router.get("/waf", requirePermission("enterprise.manage"), (req, res) => ok(res, "Enterprise WAF, rate limit and challenge surface", {
  policies: ["OWASP-style baseline", "bot scoring", "geo/ASN rules", "managed challenge", "route-level policy"],
  rateLimits: ["login", "api key", "terminal", "sql console", "dns write"],
  actions: ["monitor", "challenge", "block", "bypass with approval"]
}));

router.get("/policy-as-code", requirePermission("enterprise.manage"), (req, res) => ok(res, "Policy-as-code import/export", {
  formats: ["json", "yaml"],
  resources: ["rbac", "waf", "rate_limit", "challenge", "backup", "dns", "approval"],
  gates: ["schema validation", "dry-run", "diff", "approval", "audit"]
}));

router.get("/immutable-audit", requirePermission("enterprise.manage"), (req, res) => ok(res, "Immutable audit archive", {
  exportEndpoint: "/api/compliance/audit-export",
  chain: "SHA-256 tamper-evident hash chain",
  targets: ["S3 Object Lock", "MinIO WORM", "external SIEM", "offline archive"]
}));

router.get("/siem", requirePermission("enterprise.manage"), (req, res) => ok(res, "SIEM export surface", {
  formats: ["JSONL", "CEF", "LEEF", "OTLP logs"],
  events: ["audit", "security", "auth", "dns", "backup", "deployment", "terminal", "sql"],
  transport: ["webhook", "syslog", "object storage batch", "agent forwarder"],
  masking: "Sensitive values are masked by default."
}));

router.get("/metrics", requirePermission("enterprise.manage"), (req, res) => ok(res, "Long-term metrics storage", {
  retentionTiers: [
    { tier: "hot", retention: "14d", resolution: "raw" },
    { tier: "warm", retention: "90d", resolution: "1m" },
    { tier: "cold", retention: "400d", resolution: "1h" }
  ],
  exporters: ["Prometheus remote write", "OpenTelemetry", "object storage rollup"]
}));

router.get("/dr", requirePermission("enterprise.manage"), (req, res) => ok(res, "Disaster recovery runbooks", {
  runbooks: [
    { id: "dr-api-restore", name: "API and database restore", rpo: "15m", rto: "60m" },
    { id: "dr-dns-region-failover", name: "DNS region failover", rpo: "5m", rto: "15m" },
    { id: "dr-backup-provider-loss", name: "External backup provider loss", rpo: "24h", rto: "4h" }
  ],
  requirements: ["external backup", "restore dry-run", "operator approval", "post-restore smoke test"]
}));

router.post("/releases/verify", requirePermission("enterprise.manage"), validate(signedReleaseDto), (req, res) => ok(res, "Signed release verification", {
  version: req.body.version,
  digest: req.body.digest,
  signatureProvided: Boolean(req.body.signature),
  verification: req.body.signature ? "signature_received_for_offline_verification" : "digest_recorded",
  requiredForEnterprise: true
}));

router.get("/agent-channels", requirePermission("enterprise.manage"), (req, res) => ok(res, "Agent update channels", {
  channels: [
    { name: "stable", rollout: "manual", recommended: true },
    { name: "candidate", rollout: "staged", recommended: false },
    { name: "dev", rollout: "lab only", recommended: false }
  ],
  controls: ["pin version", "staged rollout", "rollback", "signed package verification"]
}));

router.get("/backup-encryption", requirePermission("enterprise.manage"), (req, res) => ok(res, "Enterprise backup encryption", {
  algorithms: ["AES-256-GCM", "RSA envelope encryption", "ECC key agreement planning"],
  rotation: ["active key", "next key", "retired key", "re-encryption job"],
  status: env.encryptionKey || env.envelopePublicKey ? "configured" : "needs_secret_configuration"
}));

router.get("/support-bundle", requirePermission("enterprise.manage"), asyncHandler(async (req, res) => {
  const [projects, deployments, backups, auditLogs] = await Promise.all([
    prisma.project.count(),
    prisma.deployment.count(),
    prisma.backup.count(),
    prisma.auditLog.count()
  ]);
  return ok(res, "Support bundle export", {
    generatedAt: new Date().toISOString(),
    generatedBy: actor(req),
    includes: ["version", "environment summary", "service health", "recent audit counts", "queue profile", "masked settings"],
    counts: { projects, deployments, backups, auditLogs },
    masking: "Secrets, tokens, keys and passwords are masked."
  });
}));

module.exports = router;
