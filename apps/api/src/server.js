const { createApp } = require("./app");
const { env } = require("./config/env");
const { prisma } = require("./config/prisma");
require("./config/redis");

async function main() {
  await prisma.$connect();
  const app = createApp();

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`OpenDeploy API listening on :${env.port}`);
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}, shutting down API...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
