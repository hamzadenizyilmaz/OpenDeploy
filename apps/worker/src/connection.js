const IORedis = require("ioredis");
const fs = require("fs");
const { redisUrl, redisTlsCaFile, redisTlsRejectUnauthorized } = require("./config");

const options = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

if (redisUrl.startsWith("rediss://")) {
  options.tls = { rejectUnauthorized: redisTlsRejectUnauthorized };
  if (redisTlsCaFile) {
    options.tls.ca = fs.readFileSync(redisTlsCaFile, "utf8");
  }
}

const connection = new IORedis(redisUrl, options);

module.exports = { connection };
