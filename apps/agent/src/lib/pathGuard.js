const path = require("path");
const { env } = require("../config/env");

const allowedRoots = [env.projectsRoot, env.backupsRoot, env.logsRoot];

function resolveAllowed(inputPath, root = env.projectsRoot) {
  const base = path.resolve(root);
  const resolved = path.resolve(base, inputPath || ".");
  if (!allowedRoots.some((allowed) => {
    const r = path.resolve(allowed);
    return resolved === r || resolved.startsWith(r + path.sep);
  })) {
    const error = new Error("Path is outside allowed OpenDeploy roots");
    error.code = "PATH_TRAVERSAL_BLOCKED";
    throw error;
  }
  return resolved;
}

module.exports = { resolveAllowed, allowedRoots };
