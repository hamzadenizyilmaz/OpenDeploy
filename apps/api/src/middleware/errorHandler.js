const { fail } = require("../utils/response");

function notFound(req, res) {
  return fail(res, 404, "Route not found", "ROUTE_NOT_FOUND", { path: req.originalUrl });
}

function errorHandler(error, req, res, next) {
  console.error("[api-error]", error);
  const isProduction = process.env.NODE_ENV === "production";
  const schemaMissing = error.code === "P2021";
  const status = schemaMissing ? 503 : (error.status || 500);
  const message = schemaMissing
    ? "Database schema is not installed. Run: opendeploy repair"
    : (isProduction && status >= 500 ? "Internal server error" : (error.message || "Internal server error"));
  const code = schemaMissing ? "DATABASE_SCHEMA_MISSING" : (error.code || "INTERNAL_SERVER_ERROR");
  const details = schemaMissing
    ? { requestId: req.id, model: error.meta?.modelName, table: error.meta?.table }
    : (isProduction && status >= 500 ? { requestId: req.id } : (error.details || {}));
  return fail(
    res,
    status,
    message,
    code,
    details
  );
}

module.exports = { notFound, errorHandler };
