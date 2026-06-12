async function sslProcessor(job) {
  return {
    queued: true,
    provider: job.data.provider || "letsencrypt",
    domain: job.data.domain || null,
    certificateId: job.data.certificateId || null
  };
}

module.exports = { sslProcessor };
