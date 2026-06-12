const { safeSpawn } = require("../lib/safeSpawn");

function parseList(stdout) {
  try {
    const items = JSON.parse(stdout);
    return items.map((item) => ({
      id: String(item.pm_id ?? item.name),
      name: item.name,
      status: item.pm2_env?.status || "unknown",
      cpu: item.monit?.cpu || 0,
      memory: `${Math.round((item.monit?.memory || 0) / 1024 / 1024)} MB`,
      restarts: item.pm2_env?.restart_time || 0,
      uptime: item.pm2_env?.pm_uptime ? `${Math.round((Date.now() - item.pm2_env.pm_uptime) / 1000)}s` : "-"
    }));
  } catch {
    return [];
  }
}
async function list() { const result = await safeSpawn("pm2", ["jlist"], { timeout: 10000 }); return { processes: parseList(result.stdout), stderr: result.stderr }; }
function assertName(name) { if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(String(name || ""))) { const e = new Error("Invalid PM2 process name"); e.code = "INVALID_PM2_NAME"; throw e; } }
async function control(action, payload) { assertName(payload.name); return safeSpawn("pm2", [action, payload.name], { timeout: 20000 }); }
module.exports = { list, control };
