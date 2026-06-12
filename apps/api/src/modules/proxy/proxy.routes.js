const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { callAgent } = require("../../services/agentClient");
const { normalizeDomain } = require("../../utils/security");

const templates = [
  { id: "nextjs", name: "Next.js / Node", category: "Application", server: "nginx", websocket: true, gzip: true, uploadLimit: "50m", timeout: 60, cache: "none" },
  { id: "websocket-api", name: "WebSocket API", category: "Application", server: "nginx", websocket: true, gzip: false, uploadLimit: "25m", timeout: 120, cache: "none" },
  { id: "api", name: "REST API", category: "Application", server: "nginx", websocket: false, gzip: true, uploadLimit: "10m", timeout: 30, cache: "none" },
  { id: "spa", name: "Static SPA", category: "Static", server: "nginx", websocket: false, gzip: true, uploadLimit: "10m", timeout: 30, cache: "short" },
  { id: "static-cache", name: "Static Assets Cache", category: "Static", server: "nginx", websocket: false, gzip: true, uploadLimit: "10m", timeout: 30, cache: "immutable" },
  { id: "apache-node", name: "Apache Node Proxy", category: "Apache", server: "apache", websocket: true, gzip: false, uploadLimit: "50m", timeout: 60, cache: "none" },
  { id: "apache-api", name: "Apache API Proxy", category: "Apache", server: "apache", websocket: false, gzip: false, uploadLimit: "20m", timeout: 45, cache: "none" }
];

const templateIds = new Set(templates.map((template) => template.id));

const siteDto = z.object({
  domain: z.string().min(3).max(255),
  upstreamPort: z.coerce.number().int().min(1).max(65535),
  server: z.enum(["nginx", "apache"]).default("nginx"),
  template: z.string().default("nextjs").refine((value) => templateIds.has(value), "Unknown proxy template."),
  enableSsl: z.boolean().default(false),
  websocket: z.boolean().default(true),
  gzip: z.boolean().default(true),
  redirectWww: z.boolean().default(false),
  redirectHttps: z.boolean().default(true),
  uploadLimit: z.string().regex(/^\d+[kKmMgG]?$/, "Upload limit must look like 50m or 1024k.").default("50m"),
  proxyTimeout: z.coerce.number().int().min(5).max(600).default(60)
});

const testDto = z.object({ server: z.enum(["nginx", "apache"]).default("nginx") });

function applyTemplate(body) {
  const template = templates.find((item) => item.id === body.template);
  return {
    ...body,
    websocket: body.websocket ?? template.websocket,
    gzip: body.gzip ?? template.gzip,
    uploadLimit: body.uploadLimit || template.uploadLimit,
    proxyTimeout: body.proxyTimeout || template.timeout,
    cache: template.cache,
    templateName: template.name
  };
}

router.use(requireAuth);

router.get("/templates", requirePermission("proxy.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Proxy templates", { templates, servers: ["nginx", "apache"] });
}));

router.post("/site", requirePermission("proxy.manage"), validate(siteDto), asyncHandler(async (req, res) => {
  let domain;
  try {
    domain = normalizeDomain(req.body.domain);
  } catch (error) {
    return fail(res, 422, error.message, error.code || "INVALID_DOMAIN");
  }

  const payload = applyTemplate({ ...req.body, domain });
  const op = payload.server === "apache" ? "proxy.writeApacheSite" : "proxy.writeNginxSite";
  const data = await callAgent(op, payload).catch((error) => ({ dryRun: true, warning: error.message, payload }));
  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "proxy_site_requested",
      resource: "proxy",
      metadata: { domain, server: payload.server, template: payload.template, upstreamPort: payload.upstreamPort, severity: "info" }
    }
  });
  return ok(res, `${payload.server.toUpperCase()} site config requested`, data);
}));

router.post("/nginx/reload", requirePermission("proxy.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Nginx reload requested", await callAgent("service.reload", { service: "nginx" }).catch((error) => ({ dryRun: true, warning: error.message })));
}));

router.post("/apache/reload", requirePermission("proxy.manage"), asyncHandler(async (req, res) => {
  return ok(res, "Apache reload requested", await callAgent("service.reload", { service: "apache2" }).catch((error) => ({ dryRun: true, warning: error.message })));
}));

router.post("/test", requirePermission("proxy.manage"), validate(testDto), asyncHandler(async (req, res) => {
  return ok(res, "Config test requested", await callAgent("proxy.test", { server: req.body.server }).catch((error) => ({ dryRun: true, warning: error.message })));
}));

module.exports = router;
