const path = require("path");

function safeResolve(root, inputPath) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, inputPath || ".");
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    const error = new Error("Path is outside allowed root");
    error.code = "PATH_TRAVERSAL_BLOCKED";
    error.status = 403;
    throw error;
  }
  return resolvedPath;
}

module.exports = { safeResolve };
