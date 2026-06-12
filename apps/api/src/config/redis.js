const IORedis = require("ioredis");
const fs = require("fs");
const { env } = require("./env");

function redisOptions() {
  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: env.nodeEnv === "production"
  };

  if (env.redisUrl.startsWith("rediss://")) {
    options.tls = { rejectUnauthorized: env.redisTlsRejectUnauthorized };
    if (env.redisTlsCaFile) {
      options.tls.ca = fs.readFileSync(env.redisTlsCaFile, "utf8");
    }
  }

  return options;
}

const redis = new IORedis(env.redisUrl, redisOptions());
let lastRedisErrorAt = 0;

redis.on("error", (error) => {
  const now = Date.now();
  if (now - lastRedisErrorAt < 60000) return;
  lastRedisErrorAt = now;
  console.error("[redis]", error.message);
});

module.exports = { redis };
