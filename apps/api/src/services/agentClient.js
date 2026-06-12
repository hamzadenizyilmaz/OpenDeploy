const { env } = require("../config/env");

async function callAgent(operation, payload = {}) {
  try {
    const response = await fetch(`${env.agentUrl}/v1/operations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Token": env.agentToken
      },
      body: JSON.stringify({ operation, payload })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const error = new Error(body.message || "Agent operation failed");
      error.status = response.status;
      error.code = body?.error?.code || "AGENT_OPERATION_FAILED";
      error.details = body?.error?.details || {};
      throw error;
    }

    return body.data;
  } catch (error) {
    if (!env.agentStrict) {
      return {
        dryRun: true,
        operation,
        payload,
        warning: `Agent unavailable in non-strict mode: ${error.message}`
      };
    }
    throw error;
  }
}

module.exports = { callAgent };
