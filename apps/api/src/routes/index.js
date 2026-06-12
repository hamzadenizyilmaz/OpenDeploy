const router = require("express").Router();
const { fail } = require("../utils/response");

function missingRoute(modulePath) {
  return (req, res) => fail(
    res,
    503,
    `Route module is not installed: ${modulePath}`,
    "ROUTE_MODULE_MISSING",
    { module: modulePath }
  );
}

function mount(path, modulePath) {
  let resolved;
  try {
    resolved = require.resolve(modulePath);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      router.use(path, missingRoute(modulePath));
      return;
    }
    throw error;
  }
  router.use(path, require(resolved));
}

mount("/auth", "../modules/auth/auth.routes");
mount("/docs", "../modules/docs/docs.routes");
mount("/setup", "../modules/setup/setup.routes");
mount("/users", "../modules/users/users.routes");
mount("/roles", "../modules/roles/roles.routes");
mount("/api-keys", "../modules/api-keys/api-keys.routes");
mount("/projects", "../modules/projects/projects.routes");
mount("/deployments", "../modules/deployments/deployments.routes");
mount("/databases", "../modules/databases/databases.routes");
mount("/database-browser", "../modules/database-browser/database-browser.routes");
mount("/database-query", "../modules/database-query/database-query.routes");
mount("/redis-browser", "../modules/redis-browser/redis-browser.routes");
mount("/mongodb-browser", "../modules/mongodb-browser/mongodb-browser.routes");
mount("/domains", "../modules/domains/domains.routes");
mount("/dns", "../modules/dns/dns.routes");
mount("/ssl", "../modules/ssl/ssl.routes");
mount("/proxy", "../modules/proxy/proxy.routes");
mount("/firewall", "../modules/firewall/firewall.routes");
mount("/security", "../modules/security/security.routes");
mount("/files", "../modules/files/files.routes");
mount("/terminal", "../modules/terminal/terminal.routes");
mount("/pm2", "../modules/pm2/pm2.routes");
mount("/services", "../modules/services/services.routes");
mount("/logs", "../modules/logs/logs.routes");
mount("/monitoring", "../modules/monitoring/monitoring.routes");
mount("/backups", "../modules/backups/backups.routes");
mount("/cron", "../modules/cron/cron.routes");
mount("/system", "../modules/system/system.routes");
mount("/update", "../modules/update/update.routes");
mount("/settings", "../modules/settings/settings.routes");
mount("/audit", "../modules/audit/audit.routes");
mount("/compliance", "../modules/compliance/compliance.routes");
mount("/enterprise", "../modules/enterprise/enterprise.routes");

module.exports = router;
