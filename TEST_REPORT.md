# OpenDeploy v2.0.0 Enterprise Ops Test Report

This package was checked in the build workspace with static syntax tests.

## Passed

- Node.js syntax check for API, Agent and Worker JavaScript files.
- Bash syntax check for top-level shell scripts.
- JSON parse check for root, API and Web package files.
- ZIP integrity test after packaging.

## Not executed in this sandbox

- `npm install`
- `next build`
- Live PostgreSQL migration
- Live Redis/BullMQ workers
- Real Nginx/Apache/PM2/systemd operations

## Recommended smoke test

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run prisma:generate
npm run prisma:dev
npm run seed
npm run dev
```

Login:

```txt
Email: admin@example.com
Password: ChangeMe123!
```

## Focus areas for manual test

- Login and token refresh
- New User role labels
- Roles > custom role creation
- API Keys > create/revoke
- DNS Manager > zone/record creation
- Firewall preset blocking without allowlist on DB/SSH presets
- SQL Console dangerous query guard
- File Manager path traversal block
- Terminal destructive command block
- Server Update queue and rollback queue
