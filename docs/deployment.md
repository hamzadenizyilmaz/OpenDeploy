# JavaScript Deployment

## Supported Project Types

- Node.js API
- Express
- Fastify
- NestJS
- Next.js
- React
- Vite
- Vue
- Nuxt
- Astro
- SvelteKit
- Static site
- Strapi
- Payload CMS

## Deployment Flow

1. Clone or pull repository.
2. Checkout branch.
3. Detect lock file.
4. Select package manager.
5. Prepare Node.js version.
6. Create `.env`.
7. Run install command.
8. Run build command.
9. Start PM2 process.
10. Generate Nginx/Apache reverse proxy.
11. Run health check.
12. Mark deployment successful or rollback.

## Package Manager Detection

| File | Package Manager |
| --- | --- |
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |
