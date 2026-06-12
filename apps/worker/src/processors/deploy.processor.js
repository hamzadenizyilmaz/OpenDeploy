const { prisma } = require("../db");

async function deployProcessor(job) {
  const { deploymentId } = job.data;
  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId }, select: { projectId: true } });
  const projectId = deployment?.projectId;
  if (!projectId) throw new Error("Deployment project not found");

  await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "running", startedAt: new Date() } });
  await prisma.deploymentLog.create({ data: { deploymentId, step: "start", message: "Deployment job started" } });

  await prisma.deploymentLog.create({ data: { deploymentId, step: "scaffold", message: "Deployment adapter scaffold executed" } });

  await prisma.project.update({ where: { id: projectId }, data: { status: "running" } });
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: "success", finishedAt: new Date(), durationMs: 1 }
  });

  return { deploymentId, projectId };
}

module.exports = { deployProcessor };
