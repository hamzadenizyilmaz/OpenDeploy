export const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  database_manager: "Database Manager",
  viewer: "Viewer"
};

export const ENGINE_LABELS = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mariadb: "MariaDB",
  mongodb: "MongoDB",
  redis: "Redis",
  sqlite: "SQLite"
};

export const PERMISSION_LABELS = {
  "system.manage": "System Management",
  "users.manage": "User Management",
  "roles.manage": "Role Management",
  "projects.manage": "Project Management",
  "deployments.manage": "Deployments",
  "databases.manage": "Database Management",
  "database.query": "SQL Console",
  "domains.manage": "Domain Management",
  "dns.manage": "DNS Management",
  "ssl.manage": "SSL Certificates",
  "proxy.manage": "Nginx / Apache",
  "firewall.manage": "Firewall Management",
  "files.manage": "File Manager",
  "terminal.use": "Terminal Access",
  "services.manage": "Service Management",
  "pm2.manage": "PM2 Manager",
  "backups.manage": "Backup Management",
  "settings.manage": "Settings",
  "compliance.manage": "Compliance",
  "enterprise.manage": "Enterprise Ops",
  "audit.read": "Audit Logs",
  "monitoring.read": "Monitoring",
  "updates.manage": "Server Update",
  "cron.manage": "Auto Cron",
  "api_keys.manage": "API Keys"
};

export function titleize(value) {
  if (!value) return "-";
  const raw = String(value);
  const mapped = ROLE_LABELS[raw] || ENGINE_LABELS[raw] || PERMISSION_LABELS[raw];
  if (mapped) return mapped;
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusBadge(value) {
  const v = String(value || "unknown").toLowerCase();
  if (["active", "enabled", "running", "healthy", "success", "valid", "issued", "ok", "ready", "restricted", "allowlisted", "pass", "available"].includes(v)) return "running";
  if (["failed", "error", "expired", "blocked", "locked", "critical"].includes(v)) return "failed";
  if (["warning", "queued", "pending", "deploying", "checking", "building", "renewal_due", "not_resolved", "warn", "planned"].includes(v)) return "warning";
  if (["disabled", "stopped", "revoked", "inactive", "skipped"].includes(v)) return "stopped";
  if (["control_surface", "profile"].includes(v)) return "info";
  return v;
}

export function bytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let num = n;
  while (num >= 1024 && i < units.length - 1) { num /= 1024; i += 1; }
  return `${num.toFixed(num >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
