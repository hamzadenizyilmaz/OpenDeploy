const express = require("express");
const crypto = require("crypto");
const { env } = require("./config/env");
const { getOperation } = require("./registry");

const app = express();
app.use(express.json({ limit: "1mb" }));

function requireAgentToken(req, res, next) {
  const raw = req.headers["x-agent-token"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  const provided = Buffer.from(String(token || ""));
  const expected = Buffer.from(String(env.token || ""));
  const valid = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!valid) {
    return res.status(401).json({
      success: false,
      message: "Invalid agent token",
      error: { code: "INVALID_AGENT_TOKEN", details: {} }
    });
  }
  next();
}

app.get("/health", (req, res) => {
  res.json({ success: true, message: "OpenDeploy Agent is healthy", data: { uptime: process.uptime() } });
});

app.post("/v1/operations", requireAgentToken, async (req, res) => {
  try {
    const { operation, payload = {} } = req.body || {};
    const handler = getOperation(operation);
    if (!handler) {
      return res.status(404).json({
        success: false,
        message: "Agent operation is not allowlisted",
        error: { code: "OPERATION_NOT_ALLOWED", details: { operation } }
      });
    }

    const data = await handler(payload);
    return res.json({ success: true, message: "Agent operation completed", data });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Agent operation failed",
      error: { code: error.code || "AGENT_OPERATION_FAILED", details: error.details || {} }
    });
  }
});

app.listen(env.port, "127.0.0.1", () => {
  console.log(`OpenDeploy Agent listening on 127.0.0.1:${env.port}`);
});
