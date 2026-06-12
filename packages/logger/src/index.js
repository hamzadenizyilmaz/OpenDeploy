function log(level, message, meta = {}) {
  console.log(JSON.stringify({ level, message, meta, time: new Date().toISOString() }));
}

module.exports = {
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta)
};
