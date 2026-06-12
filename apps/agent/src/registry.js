const system = require("./operations/system");
const service = require("./operations/service");
const firewall = require("./operations/firewall");
const proxy = require("./operations/proxy");
const ssl = require("./operations/ssl");
const files = require("./operations/files");
const pm2 = require("./operations/pm2");

const registry = {
  "system.metrics": system.metrics,

  "service.status": service.status,
  "service.start": (payload) => service.control("start", payload),
  "service.stop": (payload) => service.control("stop", payload),
  "service.restart": (payload) => service.control("restart", payload),
  "service.reload": (payload) => service.control("reload", payload),

  "firewall.openPort": firewall.openPort,
  "firewall.closePort": firewall.closePort,

  "proxy.writeNginxSite": proxy.writeNginxSite,
  "proxy.writeApacheSite": proxy.writeApacheSite,
  "proxy.test": proxy.test,

  "ssl.issue": ssl.issue,

  "file.list": files.list,
  "file.read": files.read,
  "file.write": files.write,

  "pm2.list": pm2.list,
  "pm2.start": (payload) => pm2.control("start", payload),
  "pm2.stop": (payload) => pm2.control("stop", payload),
  "pm2.restart": (payload) => pm2.control("restart", payload),
  "pm2.reload": (payload) => pm2.control("reload", payload),
  "pm2.delete": (payload) => pm2.control("delete", payload)
};

function getOperation(name) {
  return registry[name];
}

module.exports = { registry, getOperation };
