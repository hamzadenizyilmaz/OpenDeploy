const os = require("os");
const fs = require("fs/promises");
const { safeSpawn } = require("../lib/safeSpawn");

async function metrics() {
  const load = os.loadavg();
  let disk = null;
  try {
    const result = await safeSpawn("df", ["-B1", "/"]);
    disk = result.stdout.split("\n")[1]?.split(/\s+/) || null;
  } catch {}

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    uptime: os.uptime(),
    cpuCount: os.cpus().length,
    loadAverage: load,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    disk
  };
}

module.exports = { metrics };
