const router = require("express").Router();
const { ok } = require("../../utils/response");

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "OpenDeploy API",
    version: "v2.0.0-enterprise-ops",
    description: "Control-plane API for OpenDeploy automation, deployments, DNS, monitoring, backups and audit logs."
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      apiKeyAuth: { type: "apiKey", in: "header", name: "X-OpenDeploy-Key" }
    }
  },
  security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
  paths: {
    "/auth/login": { post: { summary: "Login with email and password", tags: ["Auth"] } },
    "/auth/refresh": { post: { summary: "Refresh a JWT access token", tags: ["Auth"] } },
    "/api-keys": {
      get: { summary: "List API keys", tags: ["Access"] },
      post: { summary: "Create an API key", tags: ["Access"] }
    },
    "/projects": { get: { summary: "List projects", tags: ["Deploy"] } },
    "/deployments": {
      get: { summary: "List deployments", tags: ["Deploy"] },
      post: { summary: "Start a deployment", tags: ["Deploy"] }
    },
    "/domains": { get: { summary: "List domains", tags: ["Network"] } },
    "/dns": { get: { summary: "List DNS zones and records", tags: ["DNS"] } },
    "/monitoring/overview": { get: { summary: "Read monitoring overview", tags: ["Monitoring"] } },
    "/backups": { get: { summary: "List backup jobs and providers", tags: ["Backups"] } },
    "/audit": { get: { summary: "Read audit logs", tags: ["Security"] } },
    "/compliance/overview": { get: { summary: "Read compliance overview", tags: ["Compliance"] } },
    "/compliance/audit-export": { get: { summary: "Export tamper-evident audit chain", tags: ["Compliance"] } },
    "/compliance/retention": { get: { summary: "Read retention policies", tags: ["Compliance"] } },
    "/compliance/role-change-history": { get: { summary: "Read role change history", tags: ["Compliance"] } },
    "/compliance/api-key-usage": { get: { summary: "Read API key usage report", tags: ["Compliance"] } },
    "/compliance/login-history": { get: { summary: "Read login history", tags: ["Compliance"] } },
    "/compliance/sessions": { get: { summary: "Read session inventory", tags: ["Compliance"] } },
    "/compliance/sessions/{id}/revoke": { post: { summary: "Revoke a session", tags: ["Compliance"] } },
    "/compliance/security-baseline": { get: { summary: "Read security baseline report", tags: ["Compliance"] } },
    "/compliance/backup-compliance": { get: { summary: "Read backup compliance report", tags: ["Compliance"] } },
    "/enterprise/overview": { get: { summary: "Read Enterprise Ops overview", tags: ["Enterprise"] } },
    "/enterprise/teams": { get: { summary: "Read team and project ownership model", tags: ["Enterprise"] } },
    "/enterprise/permissions": { get: { summary: "Read fine-grained permissions matrix", tags: ["Enterprise"] } },
    "/enterprise/webhooks/dry-run": { post: { summary: "Generate signed webhook dry-run", tags: ["Enterprise"] } },
    "/enterprise/bulk/dry-run": { post: { summary: "Run bulk import/export dry-run", tags: ["Enterprise"] } },
    "/enterprise/ha": { get: { summary: "Read HA API profile", tags: ["Enterprise"] } },
    "/enterprise/dns": { get: { summary: "Read HA and multi-region DNS profile", tags: ["Enterprise"] } },
    "/enterprise/dnssec": { get: { summary: "Read DNSSEC control surface", tags: ["Enterprise"] } },
    "/enterprise/waf": { get: { summary: "Read Enterprise WAF surface", tags: ["Enterprise"] } },
    "/enterprise/siem": { get: { summary: "Read SIEM export surface", tags: ["Enterprise"] } },
    "/enterprise/dr": { get: { summary: "Read DR runbooks", tags: ["Enterprise"] } }
  }
};

router.get("/openapi.json", (req, res) => {
  res.json(openapi);
});

router.get("/", (req, res) => ok(res, "OpenDeploy API documentation", { openapiUrl: "/api/docs/openapi.json", docsUrl: "/api-docs" }));

module.exports = router;
