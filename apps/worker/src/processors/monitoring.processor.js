async function monitoringProcessor(job) {
  return {
    monitored: true,
    sampledAt: new Date().toISOString(),
    target: job.data.target || "server"
  };
}

module.exports = { monitoringProcessor };
