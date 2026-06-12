const net = require("net");
const { safeSpawn } = require("../lib/safeSpawn");

function validatePort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw Object.assign(new Error("Invalid port"), { code: "INVALID_PORT" });
  }
  return n;
}

function validateProtocol(protocol = "tcp") {
  if (!["tcp", "udp"].includes(protocol)) {
    throw Object.assign(new Error("Invalid protocol"), { code: "INVALID_PROTOCOL" });
  }
  return protocol;
}

function validateSourceIp(sourceIp) {
  if (!sourceIp) return undefined;
  const raw = String(sourceIp).trim();
  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length !== 2) throw Object.assign(new Error("Invalid source CIDR"), { code: "INVALID_SOURCE_IP" });
    const [address, prefixText] = parts;
    const family = net.isIP(address);
    const prefix = Number(prefixText);
    const maxPrefix = family === 4 ? 32 : 128;
    if (!family || !Number.isInteger(prefix) || prefix <= 0 || prefix > maxPrefix) {
      throw Object.assign(new Error("Invalid source CIDR"), { code: "INVALID_SOURCE_IP" });
    }
    return raw;
  }
  if (!net.isIP(raw)) {
    throw Object.assign(new Error("Invalid source IP"), { code: "INVALID_SOURCE_IP" });
  }
  return raw;
}

function sourceFamily(sourceIp) {
  const address = String(sourceIp).split("/")[0];
  return net.isIP(address) === 6 ? "ipv6" : "ipv4";
}

function firewalldRichRule({ port, protocol, sourceIp }) {
  return `rule family="${sourceFamily(sourceIp)}" source address="${sourceIp}" port port="${port}" protocol="${protocol}" accept`;
}

async function resolveCommand(command) {
  const result = await safeSpawn("which", [command]).catch(() => null);
  if (!result || result.code !== 0) return null;
  return result.stdout.trim().split(/\r?\n/)[0] || command;
}

async function detectFirewall() {
  const ufw = await resolveCommand("ufw");
  if (ufw) return { type: "ufw", command: ufw };

  const firewalld = await resolveCommand("firewall-cmd");
  if (firewalld) return { type: "firewalld", command: firewalld };

  throw Object.assign(new Error("No supported firewall found"), { code: "FIREWALL_NOT_FOUND" });
}

async function run(command, args, action) {
  const result = await safeSpawn(command, args);
  if (result.code !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `${action} failed`;
    throw Object.assign(new Error(message), { code: "FIREWALL_COMMAND_FAILED", details: { action, code: result.code } });
  }
  return result;
}

async function reloadFirewalld(command) {
  return run(command, ["--reload"], "firewall.reload");
}

async function openPort({ port, protocol = "tcp", sourceIp }) {
  port = validatePort(port);
  protocol = validateProtocol(protocol);
  sourceIp = validateSourceIp(sourceIp);

  const firewall = await detectFirewall();

  if (firewall.type === "ufw") {
    const args = sourceIp
      ? ["allow", "from", sourceIp, "to", "any", "port", String(port), "proto", protocol]
      : ["allow", `${port}/${protocol}`];
    return { backend: "ufw", result: await run(firewall.command, args, "firewall.openPort") };
  }

  if (sourceIp) {
    const result = await run(firewall.command, ["--permanent", "--add-rich-rule", firewalldRichRule({ port, protocol, sourceIp })], "firewall.openPort");
    return { backend: "firewalld", result, reload: await reloadFirewalld(firewall.command) };
  }

  const result = await run(firewall.command, ["--permanent", "--add-port", `${port}/${protocol}`], "firewall.openPort");
  return { backend: "firewalld", result, reload: await reloadFirewalld(firewall.command) };
}

async function closePort({ port, protocol = "tcp", sourceIp }) {
  port = validatePort(port);
  protocol = validateProtocol(protocol);
  sourceIp = validateSourceIp(sourceIp);

  const firewall = await detectFirewall();

  if (firewall.type === "ufw") {
    const args = sourceIp
      ? ["delete", "allow", "from", sourceIp, "to", "any", "port", String(port), "proto", protocol]
      : ["delete", "allow", `${port}/${protocol}`];
    return { backend: "ufw", result: await run(firewall.command, args, "firewall.closePort") };
  }

  if (sourceIp) {
    const result = await run(firewall.command, ["--permanent", "--remove-rich-rule", firewalldRichRule({ port, protocol, sourceIp })], "firewall.closePort");
    return { backend: "firewalld", result, reload: await reloadFirewalld(firewall.command) };
  }

  const result = await run(firewall.command, ["--permanent", "--remove-port", `${port}/${protocol}`], "firewall.closePort");
  return { backend: "firewalld", result, reload: await reloadFirewalld(firewall.command) };
}

module.exports = { openPort, closePort };
