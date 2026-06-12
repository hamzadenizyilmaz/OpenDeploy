const { Queue } = require("bullmq");
const { redis } = require("../config/redis");
const { env } = require("../config/env");

function createQueue(name) {
  const queue = new Queue(name, { connection: redis });
  return {
    name,
    async add(jobName, payload, options) {
      try {
        return await queue.add(jobName, payload, options);
      } catch (error) {
        if (env.nodeEnv !== "production") {
          return {
            id: `dry-${name}-${Date.now()}`,
            name: jobName,
            data: payload,
            dryRun: true,
            warning: `Redis/BullMQ unavailable in development: ${error.message}`
          };
        }
        throw error;
      }
    },
    raw: queue
  };
}

const deployQueue = createQueue("deployments");
const backupQueue = createQueue("backups");
const sslQueue = createQueue("ssl");
const updateQueue = createQueue("updates");
const monitoringQueue = createQueue("monitoring");

module.exports = {
  deployQueue,
  backupQueue,
  sslQueue,
  updateQueue,
  monitoringQueue
};
