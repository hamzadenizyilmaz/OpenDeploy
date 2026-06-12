const { Worker } = require("bullmq");
const { connection } = require("./connection");
const { deployProcessor } = require("./processors/deploy.processor");
const { backupProcessor } = require("./processors/backup.processor");
const { sslProcessor } = require("./processors/ssl.processor");
const { updateProcessor } = require("./processors/update.processor");
const { monitoringProcessor } = require("./processors/monitoring.processor");

const workers = [
  new Worker("deployments", deployProcessor, { connection }),
  new Worker("backups", backupProcessor, { connection }),
  new Worker("ssl", sslProcessor, { connection }),
  new Worker("updates", updateProcessor, { connection }),
  new Worker("monitoring", monitoringProcessor, { connection })
];

for (const worker of workers) {
  worker.on("completed", (job) => console.log(`[worker] ${worker.name} job ${job.id} completed`));
  worker.on("failed", (job, error) => console.error(`[worker] ${worker.name} job ${job?.id} failed`, error));
}

console.log("OpenDeploy Worker started");
