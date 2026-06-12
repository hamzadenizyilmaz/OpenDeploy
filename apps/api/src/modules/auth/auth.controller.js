const { ok } = require("../../utils/response");
const { asyncHandler } = require("../../utils/asyncHandler");
const authService = require("./auth.service");

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, req);
  return ok(res, "Login successful", data);
});

const refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken);
  return ok(res, "Token refreshed", data);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  return ok(res, "Logout successful");
});

const me = asyncHandler(async (req, res) => {
  return ok(res, "Current user", { user: req.user });
});

module.exports = { login, refresh, logout, me };
