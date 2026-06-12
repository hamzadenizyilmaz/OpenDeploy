const { PrismaClient } = require("@prisma/client");

const logLevels = process.env.OPENDEPLOY_PRISMA_QUERY_LOGS === "true"
  ? ["query", "error", "warn"]
  : ["error", "warn"];

const prisma = new PrismaClient({
  log: logLevels
});

module.exports = { prisma };
