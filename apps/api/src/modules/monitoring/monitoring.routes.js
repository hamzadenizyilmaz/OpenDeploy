const os = require("os");
const router = require("express").Router();
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok } = require("../../utils/response");
const { callAgent } = require("../../services/agentClient");

const serviceNames = [
  { name: "OpenDeploy API", unit: "opendeploy-api" },
  { name: "OpenDeploy Web", unit: "opendeploy-web" },
  { name: "OpenDeploy Agent", unit: "opendeploy-agent" },
  { name: "OpenDeploy Worker", unit: "opendeploy-worker" },
  { name: "Nginx", unit: "nginx" },
  { name: "PostgreSQL", unit: "postgresql" },
  { name: "Redis", unit: "redis" }
];

function percent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseDisk(agentMetrics) {
  const disk = agentMetrics?.disk;
  if (!Array.isArray(disk) || disk.length < 6) {
    return { usagePercent: 0, totalBytes: 0, usedBytes: 0, freeBytes: 0, mount: "/", note: "Agent disk adapter not connected." };
  }

  const usage = Number(String(disk[4] || "0").replace("%", ""));
  return {
    filesystem: disk[0],
    totalBytes: Number(disk[1] || 0),
    usedBytes: Number(disk[2] || 0),
    freeBytes: Number(disk[3] || 0),
    usagePercent: percent(usage),
    mount: disk[5] || "/"
  };
}

function localMetrics(agentMetrics = null) {
  const cpus = os.cpus();
  const total = agentMetrics?.totalMemory || os.totalmem();
  const free = agentMetrics?.freeMemory || os.freemem();
  const load = agentMetrics?.loadAverage || os.loadavg();
  const cores = agentMetrics?.cpuCount || cpus.length || 1;
  const memoryUsage = Math.round(((total - free) / Math.max(total, 1)) * 100);
  const cpuUsage = percent((Number(load[0] || 0) / Math.max(cores, 1)) * 100);

  return {
    host: {
      hostname: agentMetrics?.hostname || os.hostname(),
      platform: agentMetrics?.platform || os.platform(),
      release: agentMetrics?.release || os.release(),
      arch: agentMetrics?.arch || os.arch(),
      uptimeSeconds: agentMetrics?.uptime || os.uptime()
    },
    cpu: {
      cores,
      model: cpus[0]?.model || "unknown",
      load1: Number(load[0] || 0),
      load5: Number(load[1] || 0),
      load15: Number(load[2] || 0),
      usagePercent: cpuUsage
    },
    memory: {
      totalBytes: total,
      usedBytes: total - free,
      freeBytes: free,
      usagePercent: percent(memoryUsage)
    },
    disk: parseDisk(agentMetrics),
    network: { rxBytes: 0, txBytes: 0, note: "Network counters require agent adapter." }
  };
}

function buildAlerts(metrics, services) {
  const alerts = [];
  if (metrics.cpu.usagePercent >= 85) alerts.push({ level: "critical", title: "High CPU usage", message: `CPU is at ${metrics.cpu.usagePercent}%.` });
  if (metrics.memory.usagePercent >= 85) alerts.push({ level: "critical", title: "High memory usage", message: `Memory is at ${metrics.memory.usagePercent}%.` });
  if (metrics.disk.usagePercent >= 85) alerts.push({ level: "critical", title: "Disk nearly full", message: `${metrics.disk.mount || "/"} is at ${metrics.disk.usagePercent}%.` });
  if (metrics.disk.note) alerts.push({ level: "warning", title: "Disk adapter not connected", message: metrics.disk.note });
  const failed = services.filter((service) => ["failed", "inactive", "stopped"].includes(String(service.status || "").toLowerCase()));
  if (failed.length) alerts.push({ level: "warning", title: "Service attention required", message: failed.map((service) => service.name).join(", ") });
  if (!alerts.length) alerts.push({ level: "info", title: "System healthy", message: "No critical resource or service alerts detected." });
  return alerts;
}

function healthScore(metrics, services) {
  let score = 100;
  score -= Math.max(0, metrics.cpu.usagePercent - 70);
  score -= Math.max(0, metrics.memory.usagePercent - 70);
  score -= Math.max(0, metrics.disk.usagePercent - 70);
  score -= services.filter((service) => ["failed", "inactive", "stopped"].includes(String(service.status || "").toLowerCase())).length * 8;
  return Math.max(0, Math.round(score));
}

async function serviceStatus() {
  return Promise.all(serviceNames.map(async (service) => {
    const data = await callAgent("service.status", { service: service.unit }).catch((error) => ({ status: "unknown", warning: error.message }));
    return { ...service, status: data.status || data.activeState || "unknown", details: data };
  }));
}

router.use(requireAuth);

router.get("/overview", requirePermission("monitoring.read"), asyncHandler(async (req, res) => {
  const [agentMetrics, services] = await Promise.all([
    callAgent("system.metrics").catch(() => null),
    serviceStatus()
  ]);
  const metrics = localMetrics(agentMetrics?.dryRun ? null : agentMetrics);
  const alerts = buildAlerts(metrics, services);
  return ok(res, "Monitoring overview", {
    ...metrics,
    services,
    alerts,
    health: {
      score: healthScore(metrics, services),
      status: alerts.some((alert) => alert.level === "critical") ? "critical" : alerts.some((alert) => alert.level === "warning") ? "warning" : "healthy"
    },
    sampledAt: new Date().toISOString()
  });
}));

module.exports = router;
