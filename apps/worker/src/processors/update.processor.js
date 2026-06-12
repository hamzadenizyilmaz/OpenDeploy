async function updateProcessor(job) {
  return {
    update: "guarded_scaffold",
    backup: job.data.backup !== false,
    force: !!job.data.force,
    userId: job.data.userId || null
  };
}

module.exports = { updateProcessor };
