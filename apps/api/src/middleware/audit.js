const { prisma } = require("../config/prisma");

function audit(action, resource) {
  return async function auditMiddleware(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      try {
        if (req.user && res.statusCode < 400) {
          await prisma.auditLog.create({
            data: {
              userId: req.user.id,
              action,
              resource,
              resourceId: req.params.id || req.body?.id || null,
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"],
              metadata: {
                method: req.method,
                path: req.originalUrl
              }
            }
          });
        }
      } catch (error) {
        console.error("[audit]", error.message);
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { audit };
