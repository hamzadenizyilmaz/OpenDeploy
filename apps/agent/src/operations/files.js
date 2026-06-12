const fs = require("fs/promises");
const { resolveAllowed } = require("../lib/pathGuard");

async function list({ path = ".", root }) {
  const target = resolveAllowed(path, root);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return {
    path: target,
    entries: entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file"
    }))
  };
}

async function read({ path, root }) {
  const target = resolveAllowed(path, root);
  const content = await fs.readFile(target, "utf8");
  return { path: target, content };
}

async function write({ path, content = "", root }) {
  const target = resolveAllowed(path, root);
  await fs.writeFile(target, content, "utf8");
  return { path: target };
}

module.exports = { list, read, write };
