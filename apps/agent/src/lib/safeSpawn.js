const { spawn } = require("child_process");

function safeSpawn(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(args)) {
      return reject(Object.assign(new Error("Args must be an array"), { code: "INVALID_ARGS" }));
    }

    const child = spawn(command, args, {
      shell: false,
      timeout: options.timeout || 30000,
      cwd: options.cwd || undefined,
      env: { ...process.env, ...(options.env || {}) }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

module.exports = { safeSpawn };
