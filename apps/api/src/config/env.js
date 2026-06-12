const path = require("path");
require("dotenv").config({ path: process.env.OPENDEPLOY_ENV_FILE || path.resolve(process.cwd(), "../../.env") });

function csv(value, fallback = []) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .concat(fallback)
    .filter((item, index, list) => list.indexOf(item) === index);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  version: process.env.OPENDEPLOY_VERSION || "v2.0.0-enterprise-ops",
  port: Number(process.env.API_PORT || 4000),
  appUrl: process.env.APP_URL || "http://localhost:8080",
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisTlsCaFile: process.env.REDIS_TLS_CA_FILE || "",
  redisTlsRejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED
    ? process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false"
    : true,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
  encryptionKey: process.env.OPENDEPLOY_ENCRYPTION_KEY || "",
  envelopePublicKey: process.env.OPENDEPLOY_ENVELOPE_PUBLIC_KEY || "",
  envelopePrivateKey: process.env.OPENDEPLOY_ENVELOPE_PRIVATE_KEY || "",
  agentUrl: process.env.AGENT_URL || `http://127.0.0.1:${process.env.AGENT_PORT || 4100}`,
  agentToken: process.env.AGENT_TOKEN || "dev-agent-token",
  agentStrict: process.env.OPENDEPLOY_AGENT_STRICT
    ? process.env.OPENDEPLOY_AGENT_STRICT === "true"
    : (process.env.NODE_ENV || "development") === "production",
  githubRepo: process.env.OPENDEPLOY_GITHUB_REPO || process.env.GITHUB_REPOSITORY || "hamzadenizyilmaz/OpenDeploy",
  githubToken: process.env.GITHUB_TOKEN || "",
  dnsCloud: {
    enabled: process.env.DNS_CLOUD_ENABLED === "true",
    apiUrl: process.env.DNS_CLOUD_API_URL || "https://dns.creartsoft.com/api/v1",
    adminUrl: process.env.DNS_CLOUD_ADMIN_URL || "https://dns.creartsoft.com",
    instanceId: process.env.DNS_CLOUD_INSTANCE_ID || "",
    apiKey: process.env.DNS_CLOUD_API_KEY || "",
    adminToken: process.env.DNS_CLOUD_ADMIN_TOKEN || "",
    brandName: process.env.DNS_BRAND_NAME || "OpenDeploy DNS Cloud",
    brandOwner: process.env.DNS_BRAND_OWNER || "Creart Soft",
    defaultNs1: process.env.DNS_DEFAULT_NS1 || "dp-ns1.opendeploy.com",
    defaultNs2: process.env.DNS_DEFAULT_NS2 || "dp-ns2.opendeploy.com",
    mode: process.env.DNS_CLOUD_MODE || "creartsoft"
  },
  dnsNameservers: csv(process.env.OPENDEPLOY_DNS_NAMESERVERS, [
    process.env.DNS_DEFAULT_NS1 || "dp-ns1.opendeploy.com",
    process.env.DNS_DEFAULT_NS2 || "dp-ns2.opendeploy.com"
  ]),
  dnsDefaultTtl: Number(process.env.OPENDEPLOY_DNS_DEFAULT_TTL || 300),
  publicIp: process.env.OPENDEPLOY_PUBLIC_IP || "SERVER_PUBLIC_IP",
  projectsRoot: process.env.OPENDEPLOY_PROJECTS || "/var/lib/opendeploy/projects",
  backupsRoot: process.env.OPENDEPLOY_BACKUPS || "/var/backups/opendeploy",
  logsRoot: process.env.OPENDEPLOY_LOGS || "/var/log/opendeploy"
};

if (env.nodeEnv === "production") {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production.");
  }
  if (!env.encryptionKey && !env.envelopePublicKey) {
    throw new Error("OPENDEPLOY_ENCRYPTION_KEY or OPENDEPLOY_ENVELOPE_PUBLIC_KEY is required in production.");
  }
  if (env.redisUrl.startsWith("rediss://") && !env.redisTlsRejectUnauthorized) {
    throw new Error("REDIS_TLS_REJECT_UNAUTHORIZED=false is not allowed in production. Use REDIS_TLS_CA_FILE instead.");
  }
  const defaults = [
    ["JWT_ACCESS_SECRET", env.jwtAccessSecret, "dev-access-secret-change-me"],
    ["JWT_REFRESH_SECRET", env.jwtRefreshSecret, "dev-refresh-secret-change-me"],
    ["AGENT_TOKEN", env.agentToken, "dev-agent-token"]
  ];
  for (const [key, value, unsafe] of defaults) {
    if (!value || value === unsafe || String(value).length < 32) {
      throw new Error(`${key} must be set to a strong production value.`);
    }
  }
  if (!env.databaseUrl) throw new Error("DATABASE_URL is required in production.");
}

module.exports = { env };
