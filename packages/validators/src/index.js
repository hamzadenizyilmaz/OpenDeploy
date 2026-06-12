function isSlug(value) {
  return /^[a-z0-9-]+$/.test(String(value || ""));
}

function isSafePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function isSafeDomain(value) {
  return /^[a-z0-9.-]+$/i.test(String(value || ""));
}

module.exports = { isSlug, isSafePort, isSafeDomain };
