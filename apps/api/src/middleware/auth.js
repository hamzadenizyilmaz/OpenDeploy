const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const { prisma } = require("../config/prisma");
const { fail } = require("../utils/response");
const { sha256 } = require("../utils/crypto");
const { parseApiToken, verifyApiToken } = require("../utils/apiTokens");

function mapUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map((r) => r.role.name),
    permissions: new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key)))
  };
}

async function loadUser(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } }
        }
      }
    }
  });
}

async function authenticateApiKey(req) {
  const raw = req.headers["x-opendeploy-key"] || req.headers["x-api-key"];
  if (!raw) return null;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!String(token).startsWith("od_")) return null;
  const parsed = parseApiToken(token);
  const include = { user: { include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } };
  const where = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
  const apiToken = parsed.id
    ? await prisma.apiToken.findFirst({ where: { id: parsed.id, ...where }, include })
    : await prisma.apiToken.findFirst({ where: { tokenHash: sha256(token), ...where }, include });
  if (!apiToken || !apiToken.user || apiToken.user.status !== "active") return null;
  if (!(await verifyApiToken(token, apiToken.tokenHash).catch(() => false))) return null;
  await prisma.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  req.authType = "api_key";
  return mapUser(apiToken.user);
}

async function authenticateBearer(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const payload = jwt.verify(token, env.jwtAccessSecret);
  const user = await loadUser(payload.sub);
  if (!user || user.status !== "active") return null;
  req.authType = "jwt";
  return mapUser(user);
}

async function requireAuth(req, res, next) {
  try {
    const user = await authenticateApiKey(req).catch(() => null) || await authenticateBearer(req).catch(() => null);
    if (!user) return fail(res, 401, "Authentication required or token expired", "AUTH_REQUIRED");
    req.user = user;
    next();
  } catch (error) {
    return fail(res, 401, "Invalid or expired token", "INVALID_TOKEN");
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") && !req.headers["x-opendeploy-key"] && !req.headers["x-api-key"]) return next();
  return requireAuth(req, res, next);
}

module.exports = { requireAuth, optionalAuth };
