const { safeSpawn } = require("../lib/safeSpawn");

const ALLOWED_SERVICES = new Set([
  "opendeploy-api", "opendeploy-web", "opendeploy-agent", "opendeploy-worker",
  "nginx", "apache2", "httpd", "postgresql", "mysql", "mariadb", "mongod", "redis", "redis-server", "pm2-root"
]);

function assertService(service) {
  if (!ALLOWED_SERVICES.has(service)) {
    const error = new Error("Service is not allowlisted");
    error.code = "SERVICE_NOT_ALLOWED";
    throw error;
  }
}

async function status({ service }) {
  assertService(service);
  const result = await safeSpawn("systemctl", ["is-active", service]);
  const enabled = await safeSpawn("systemctl", ["is-enabled", service]).catch(() => ({ stdout: "unknown" }));
  return {
    service,
    status: result.stdout.trim() || "unknown",
    enabled: enabled.stdout.trim() || "unknown"
  };
}

async function control(action, { service }) {
  assertService(service);
  if (!["start", "stop", "restart", "reload", "enable", "disable"].includes(action)) {
    throw Object.assign(new Error("Invalid service action"), { code: "INVALID_SERVICE_ACTION" });
  }
  const result = await safeSpawn("systemctl", [action, service], { timeout: 60000 });
  return { service, action, result };
}

module.exports = { status, control };
