function ok(res, message = "Operation completed successfully", data = {}) {
  return res.json({ success: true, message, data });
}

function fail(res, status = 400, message = "Request failed", code = "REQUEST_FAILED", details = {}) {
  return res.status(status).json({
    success: false,
    message,
    error: { code, details }
  });
}

module.exports = { ok, fail };
