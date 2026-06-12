const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const { prisma } = require("../../config/prisma");
const { env } = require("../../config/env");
const { sha256 } = require("../../utils/crypto");
const { hashPassword, needsRehash, verifyPassword } = require("../../utils/passwords");
const { decryptSecret, isEncryptedSecret } = require("../../utils/secretVault");

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.jwtAccessSecret, { expiresIn: "15m" });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: "refresh" }, env.jwtRefreshSecret, { expiresIn: "30d" });
}

async function login({ email, password }, req) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } }
  });

  if (!user || user.status !== "active") {
    throw Object.assign(new Error("Invalid email or password"), { status: 401, code: "INVALID_CREDENTIALS" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await prisma.auditLog.create({
      data: {
        action: "failed_login",
        resource: "auth",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { email }
      }
    });
    throw Object.assign(new Error("Invalid email or password"), { status: 401, code: "INVALID_CREDENTIALS" });
  }

  if (needsRehash(user.passwordHash)) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }

  if (user.twoFactorOn) {
    const code = String(req.body?.totpCode || "").trim();
    if (!code) throw Object.assign(new Error("Two-factor code is required"), { status: 401, code: "TWO_FACTOR_REQUIRED" });
    let secret = user.twoFactorSecret || "";
    try {
      const parsed = JSON.parse(secret);
      if (isEncryptedSecret(parsed)) secret = decryptSecret(parsed, `user:${user.id}:totp`);
    } catch (error) {
      secret = user.twoFactorSecret || "";
    }
    const validTotp = secret && speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 1 });
    if (!validTotp) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "failed_totp",
          resource: "auth",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { severity: "warning" }
        }
      });
      throw Object.assign(new Error("Invalid two-factor code"), { status: 401, code: "INVALID_TOTP" });
    }
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshHash: sha256(refreshToken),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "login",
      resource: "auth",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    }
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((r) => r.role.name)
    }
  };
}

async function refresh(refreshToken) {
  const payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
  const session = await prisma.session.findFirst({
    where: {
      userId: payload.sub,
      refreshHash: sha256(refreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });
  if (!session) throw Object.assign(new Error("Invalid refresh token"), { status: 401, code: "INVALID_REFRESH" });

  return { accessToken: signAccessToken(session.user) };
}

async function logout(refreshToken) {
  await prisma.session.updateMany({
    where: { refreshHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

module.exports = { login, refresh, logout };
