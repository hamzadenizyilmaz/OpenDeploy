const path = require("path");
require("dotenv").config({ path: process.env.OPENDEPLOY_ENV_FILE || path.resolve(process.cwd(), "../../.env") });

module.exports = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  redisTlsCaFile: process.env.REDIS_TLS_CA_FILE || "",
  redisTlsRejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED
    ? process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== "false"
    : true,
  version: process.env.OPENDEPLOY_VERSION || "0.1.0"
};
