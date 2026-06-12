const router = require("express").Router();
const controller = require("./auth.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { authLimiter } = require("../../middleware/rateLimit");
const { loginDto, refreshDto } = require("./auth.dto");

router.post("/login", authLimiter, validate(loginDto), controller.login);
router.post("/refresh", validate(refreshDto), controller.refresh);
router.post("/logout", validate(refreshDto), controller.logout);
router.get("/me", requireAuth, controller.me);

module.exports = router;
