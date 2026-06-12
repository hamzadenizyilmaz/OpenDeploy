const { safeSpawn } = require("../lib/safeSpawn");

function validateDomain(domain) {
  if (!/^[a-z0-9.-]+$/i.test(domain || "")) {
    throw Object.assign(new Error("Invalid domain"), { code: "INVALID_DOMAIN" });
  }
}

async function issue({ domain, email }) {
  validateDomain(domain);
  const args = ["--nginx", "-d", domain, "--agree-tos", "--non-interactive"];
  if (email) args.push("-m", email);
  else args.push("--register-unsafely-without-email");
  return safeSpawn("certbot", args, { timeout: 180000 });
}

module.exports = { issue };
