const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const schemaPath = path.resolve(process.argv[2] || "prisma/schema.prisma");
const prismaDir = path.dirname(schemaPath);
const migrationsDir = path.join(prismaDir, "migrations");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0 && options.required !== false) {
    process.exit(result.status || 1);
  }
  return result.status || 0;
}

function migrationDirectories() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function migrationSqlFiles() {
  return migrationDirectories()
    .map((name) => path.join(migrationsDir, name, "migration.sql"))
    .filter((file) => fs.existsSync(file));
}

function stripBom(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    fs.writeFileSync(file, buffer.subarray(3));
    console.warn(`Removed UTF-8 BOM from ${path.relative(process.cwd(), file)}`);
  }
}

function sanitizeMigrationSqlFiles() {
  for (const file of migrationSqlFiles()) stripBom(file);
}

function hasMigrationSql() {
  sanitizeMigrationSqlFiles();
  return migrationSqlFiles().length > 0;
}

function deployMigrations() {
  const status = run("npx", ["prisma", "migrate", "deploy", "--schema", schemaPath], { required: false });
  if (status === 0) return;

  console.warn("Prisma migrate deploy failed. Attempting to roll back failed migration records and retry once.");
  for (const name of migrationDirectories()) {
    run("npx", ["prisma", "migrate", "resolve", "--rolled-back", name, "--schema", schemaPath], { required: false });
  }

  run("npx", ["prisma", "migrate", "deploy", "--schema", schemaPath]);
}

if (!fs.existsSync(schemaPath)) {
  console.error(`Prisma schema not found: ${schemaPath}`);
  process.exit(1);
}

run("npx", ["prisma", "validate", "--schema", schemaPath]);
run("npx", ["prisma", "generate", "--schema", schemaPath]);

if (hasMigrationSql()) {
  deployMigrations();
} else {
  console.warn("No Prisma migration SQL files found. Applying schema with prisma db push for first install.");
  run("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss", "--schema", schemaPath]);
}
