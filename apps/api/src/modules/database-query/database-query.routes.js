const router = require("express").Router();
const { z } = require("zod");
const { prisma } = require("../../config/prisma");
const { requireAuth } = require("../../middleware/auth");
const { requirePermission } = require("../../middleware/rbac");
const { validate } = require("../../middleware/validate");
const { asyncHandler } = require("../../utils/asyncHandler");
const { ok, fail } = require("../../utils/response");
const { sha256 } = require("../../utils/crypto");

const queryDto = z.object({
  serverId: z.string().min(1),
  databaseName: z.string().max(80).optional(),
  query: z.string().min(1).max(20000),
  confirmDangerous: z.boolean().default(false),
  readOnly: z.boolean().default(true),
  limit: z.number().int().min(1).max(1000).default(100)
});

const snippets = [
  { name: "List tables", group: "PostgreSQL", engine: "postgresql", query: "select schemaname, tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by schemaname, tablename;" },
  { name: "Table sizes", group: "PostgreSQL", engine: "postgresql", query: "select schemaname, relname as table_name, pg_size_pretty(pg_total_relation_size(relid)) as total_size from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc limit 25;" },
  { name: "Active connections", group: "PostgreSQL", engine: "postgresql", query: "select pid, usename, application_name, client_addr, state from pg_stat_activity order by backend_start desc limit 50;" },
  { name: "Slow queries", group: "PostgreSQL", engine: "postgresql", query: "select now() - query_start as duration, state, left(query, 180) as query from pg_stat_activity where state <> 'idle' order by duration desc limit 25;" },
  { name: "List tables", group: "MySQL", engine: "mysql", query: "show full tables;" },
  { name: "Process list", group: "MySQL", engine: "mysql", query: "show full processlist;" },
  { name: "Database sizes", group: "MySQL", engine: "mysql", query: "select table_schema, round(sum(data_length + index_length) / 1024 / 1024, 2) as size_mb from information_schema.tables group by table_schema order by size_mb desc;" },
  { name: "Redis info", group: "Redis", engine: "redis", query: "INFO" },
  { name: "Redis clients", group: "Redis", engine: "redis", query: "CLIENT LIST" },
  { name: "SQLite tables", group: "SQLite", engine: "sqlite", query: "select name, type from sqlite_schema where type in ('table','view') order by name;" },
  { name: "SQLite indexes", group: "SQLite", engine: "sqlite", query: "select name, tbl_name from sqlite_schema where type = 'index' order by tbl_name, name;" }
];

function maskSql(sql) {
  return sql
    .replace(/'(?:''|[^'])*'/g, "'***'")
    .replace(/"(?:\\"|[^"])*"/g, "\"***\"")
    .slice(0, 2000);
}

function analyzeSql(sql) {
  const normalized = sql.trim().replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\s+/g, " ").toLowerCase();
  const statements = normalized.split(";").map((x) => x.trim()).filter(Boolean);
  if (statements.length > 1) return { code: "MULTI_STATEMENT_BLOCKED", message: "Multiple SQL statements are blocked by default." };
  if (/\b(copy\s+.*program|pg_read_file|pg_ls_dir|lo_import|lo_export|load_file|into\s+outfile|into\s+dumpfile|xp_cmdshell)\b/.test(normalized)) return { code: "FILE_OR_COMMAND_SQL_BLOCKED", message: "File-system and command execution SQL helpers are blocked." };
  if (/\b(drop|truncate|alter|grant|revoke|create\s+extension)\b/.test(normalized)) return { code: "DDL_CONFIRMATION_REQUIRED", message: "Schema/permission changes require confirmation." };
  if (/\bdelete\s+from\b/.test(normalized) && !/\bwhere\b/.test(normalized)) return { code: "DELETE_WITHOUT_WHERE", message: "DELETE without WHERE requires confirmation." };
  if (/\b(update|delete)\b/.test(normalized) && !/\bwhere\b/.test(normalized)) return { code: "WRITE_WITHOUT_WHERE", message: "UPDATE/DELETE without WHERE requires confirmation." };
  if (/\b(update|insert|delete|drop|alter|create|truncate|grant|revoke)\b/.test(normalized)) return { code: "WRITE_QUERY_CONFIRMATION_REQUIRED", message: "Write queries require confirmation." };
  if (normalized.length > 0 && !/^(select|show|with|explain|describe|info|client\s+list)\b/.test(normalized)) return { code: "READ_ONLY_VERB_REQUIRED", message: "Read-only mode only allows SELECT/SHOW/WITH/EXPLAIN/DESCRIBE style statements." };
  return null;
}

router.use(requireAuth);

router.get("/snippets", requirePermission("database.query"), asyncHandler(async (req, res) => ok(res, "SQL snippets", { snippets })));

router.post("/execute", requirePermission("database.query"), validate(queryDto), asyncHandler(async (req, res) => {
  const danger = analyzeSql(req.body.query);
  if (danger && (req.body.readOnly || !req.body.confirmDangerous)) {
    return fail(res, 409, danger.message, "DANGEROUS_SQL_CONFIRMATION_REQUIRED", danger);
  }

  const started = Date.now();
  const queryLog = await prisma.databaseQuery.create({
    data: {
      serverId: req.body.serverId,
      userId: req.user.id,
      databaseName: req.body.databaseName,
      queryHash: sha256(req.body.query),
      queryMasked: maskSql(req.body.query),
      durationMs: Date.now() - started,
      rowCount: 0,
      success: true
    }
  });

  await prisma.auditLog.create({ data: { userId: req.user.id, action: "sql_query_executed", resource: "database_query", resourceId: queryLog.id, metadata: { readOnly: req.body.readOnly, confirmed: req.body.confirmDangerous } } });

  return ok(res, "Query accepted by the security layer", {
    queryLog,
    result: {
      columns: ["status", "adapter", "limit"],
      rows: [{ id: "safe-layer", status: "accepted", adapter: "wire engine adapter in production", limit: req.body.limit }],
      note: "OpenDeploy blocked dangerous SQL by default. Real engine execution must use parameterized adapters with timeout and result limits."
    }
  });
}));

module.exports = router;
