const { fail } = require("../utils/response");

function requirePermission(permission) {
  return function checkPermission(req, res, next) {
    if (!req.user) return fail(res, 401, "Authentication required", "AUTH_REQUIRED");

    if (req.user.roles.includes("owner")) return next();
    if (req.user.permissions && req.user.permissions.has(permission)) return next();

    return fail(res, 403, "You do not have permission for this action", "FORBIDDEN", {
      permission
    });
  };
}

function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!req.user) return fail(res, 401, "Authentication required", "AUTH_REQUIRED");
    if (req.user.roles.includes("owner")) return next();
    if (roles.some((role) => req.user.roles.includes(role))) return next();

    return fail(res, 403, "Role is not allowed", "ROLE_FORBIDDEN", { roles });
  };
}

module.exports = { requirePermission, requireRole };
