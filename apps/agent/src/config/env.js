const path = require("path");
require("dotenv").config({ path: process.env.OPENDEPLOY_ENV_FILE || path.resolve(process.cwd(), "../../.env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.AGENT_PORT || 4100),
  token: process.env.AGENT_TOKEN || "dev-agent-token",
  projectsRoot: process.env.OPENDEPLOY_PROJECTS || "/var/lib/opendeploy/projects",
  backupsRoot: process.env.OPENDEPLOY_BACKUPS || "/var/backups/opendeploy",
  logsRoot: process.env.OPENDEPLOY_LOGS || "/var/log/opendeploy"
};

if (env.nodeEnv === "production" && (!env.token || env.token === "dev-agent-token" || env.token.length < 32)) {
  throw new Error("AGENT_TOKEN must be set to a strong production value.");
}

module.exports = { env };
