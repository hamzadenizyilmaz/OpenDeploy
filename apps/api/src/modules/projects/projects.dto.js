const { z } = require("zod");

const projectCreateDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  framework: z.string().min(2),
  repositoryUrl: z.string().url().optional().or(z.literal("")),
  branch: z.string().default("main"),
  nodeVersion: z.string().default("lts"),
  packageManager: z.enum(["auto", "npm", "pnpm", "yarn"]).default("auto"),
  installCommand: z.string().optional(),
  buildCommand: z.string().optional(),
  startCommand: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  domain: z.string().optional()
});

module.exports = { projectCreateDto };
