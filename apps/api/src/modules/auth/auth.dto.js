const { z } = require("zod");
const { passwordPolicyIssues } = require("../../utils/passwords");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const loginDto = z.object({
  email: z.preprocess(
    normalizeEmail,
    z.string({ required_error: "Email is required" }).min(1, "Email is required").email("Enter a valid email address")
  ),
  // Login should not reject short passwords with a 422. If the password is not correct,
  // the auth service returns INVALID_CREDENTIALS. This prevents the UI from showing the
  // generic "Validation failed" message for normal login attempts.
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
  totpCode: z.preprocess((value) => String(value || "").trim(), z.string().optional())
});

const refreshDto = z.object({
  refreshToken: z.string({ required_error: "Refresh token is required" }).min(20, "Refresh token is invalid")
});

const changePasswordDto = z.object({
  currentPassword: z.string({ required_error: "Current password is required" }).min(1, "Current password is required"),
  newPassword: z.string({ required_error: "New password is required" }).superRefine((value, context) => {
    for (const message of passwordPolicyIssues(value)) context.addIssue({ code: z.ZodIssueCode.custom, message });
  })
});

module.exports = { loginDto, refreshDto, changePasswordDto, normalizeEmail };
