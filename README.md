# OpenDeploy

OpenDeploy is a self-hosted deployment, DNS, security, database and server operations control panel for modern JavaScript applications.

Repository: [hamzadenizyilmaz/OpenDeploy](https://github.com/hamzadenizyilmaz/OpenDeploy)

Current release track: **v2.0.0 Enterprise Ops**  
Next release track: **v2.2.0 Enterprise Dev**

OpenDeploy is designed for teams that want one controlled panel for deployments, domains, DNS, firewall, reverse proxy, databases, backups, monitoring, audit, compliance and enterprise operations without turning the API service into an unsafe root shell.

## Release Path

| Version | Track | Focus |
| --- | --- | --- |
| `v1.0.0` | Production Ready | Stable install/update flow, auth, RBAC, projects, deployments, DNS, proxy, firewall, databases, backups and monitoring. |
| `v1.2.0` | Compliance and Governance | Audit export, tamper-evident hash chain, retention policy, role history, API key usage, login history, session revocation, IP allowlist, 2FA/password policy, baseline reports and destructive approval workflow. |
| `v1.5.0` | Scale and Automation | Team/project ownership, project RBAC, environment permissions, workflow automation, maintenance windows, notification routing, signed webhooks, Terraform planning, CLI dry-run, bulk dry-run, queue isolation and worker concurrency controls. |
| `v2.0.0` | Enterprise Ops | Multi-tenant control surface, SSO/SAML/OIDC planning, SCIM planning, fine-grained permissions, HA API, HA DNS, multi-region DNS, DNSSEC, enterprise WAF, policy-as-code, immutable audit archive, SIEM export, long-term metrics, DR runbooks, signed releases, agent update channels, enterprise backup encryption and support bundle export. |
| `v2.2.0` | Enterprise Dev | Developer-focused enterprise workflows: environment promotion, preview environments, policy-aware deploy plans, signed automation, provider SDKs and deeper IaC/CLI integration. |

## Monorepo Structure

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js admin dashboard. |
| `apps/api` | Express REST API, auth, RBAC, audit, Prisma and integration logic. |
| `apps/agent` | Local privileged-operation agent with allowlisted operations. |
| `apps/worker` | Queue workers for deploy, backup, SSL, monitoring and update jobs. |
| `prisma` | PostgreSQL schema and migrations. |
| `docs` | Architecture, security, install, agent, database, firewall, roadmap and troubleshooting docs. |
| `OpenDeploy DNS Cloud` | Separate repo-ready DNS Cloud project with API, Admin Panel and authoritative nameserver. |

## Core Features

- Project deployment for Node.js, Express, Fastify, NestJS, Next.js, React, Vite, Vue, Nuxt, Astro, SvelteKit, Strapi, Payload CMS, static sites and custom JavaScript apps.
- Git-based project configuration with runtime, Node version, package manager, install/build/start commands, working directory and output directory.
- PM2 manager for start, stop, restart, inspect and grouped process operations.
- Nginx / Apache reverse proxy management with templates and safer generated config review.
- Domain and DNS Manager backed by OpenDeploy DNS Cloud.
- Firewall and Ports modules with presets, detailed policy surfaces and audit logging.
- PostgreSQL, MySQL, MariaDB, MongoDB, Redis and SQLite management surfaces.
- Database Browser, Redis Browser and guarded SQL Console.
- File Manager restricted to safe project roots.
- Terminal module with audited command requests and dangerous command protections.
- Backups with local and external-provider planning, encryption controls and compliance reports.
- Monitoring for CPU, RAM, disk, services, projects, queues and DNS Cloud health.
- API Keys with hashed tokens and one-time token reveal.
- API Docs page for automation users.
- Auto Cron and Server Update surfaces.
- Security policy modules for WAF Rules, Advanced Rules, Rate Limiting and Challenge Settings.
- Compliance and Enterprise Ops panels.

## Runtime Architecture

OpenDeploy separates the browser, API, agent and workers:

```text
Browser
  -> apps/web
  -> apps/api
      -> PostgreSQL
      -> Redis / BullMQ
      -> apps/agent for host operations
      -> OpenDeploy DNS Cloud for hosted DNS
  -> apps/worker for asynchronous jobs
```

The API does not directly run arbitrary root shell commands. Host-level operations are sent to the Agent, which validates the operation, target path and arguments before execution.

## OpenDeploy DNS Cloud

OpenDeploy DNS Cloud is a separate repo-ready DNS control plane located in `OpenDeploy DNS Cloud/`.

Default hosted model:

- API: `https://dns.creartsoft.com/api/v1`
- Admin: `https://dns.creartsoft.com`
- Nameservers: `dp-ns1.opendeploy.com`, `dp-ns2.opendeploy.com`

DNS Cloud contains:

| Component | Path | Purpose |
| --- | --- | --- |
| DNS Cloud API | `OpenDeploy DNS Cloud/DNS_Cloud_API` | Registers instances, validates domains, owns zone snapshots and exposes admin/compliance/enterprise APIs. |
| DNS Admin Panel | `OpenDeploy DNS Cloud/DNS_Admin_Panel` | Next.js `.js` App Router admin panel for domains, instances, logs, compliance and enterprise DNS profiles. |
| DNS_NameServer | `OpenDeploy DNS Cloud/DNS_NameServer` | Authoritative-only DNS responder with file/cloud zone source and last-valid-zone cache. |
| Panel Bridge | `OpenDeploy DNS Cloud/OpenDeploy_Panel_Modules/dns` | Reusable DNS Cloud client/service/controller module. |

DNS Cloud provides:

- Domain onboarding with nameserver verification.
- Zone and record validation.
- Authoritative-only DNS profile.
- HA authoritative DNS profile.
- Multi-region DNS profile.
- DNSSEC signing and rotation control surface.
- Enterprise WAF, rate limit and challenge surface.
- SIEM export surface.
- Disaster recovery runbooks.
- Tamper-evident DNS audit export.
- DNS query, zone and security log retention reports.
- API key usage report.
- Backup compliance report.
- Nameserver enterprise profile helper.

## Compliance and Governance

The Compliance panel and `/api/compliance/*` endpoints implement the v1.2 governance surface:

| Capability | Endpoint |
| --- | --- |
| Overview | `GET /api/compliance/overview` |
| Audit export | `GET /api/compliance/audit-export` |
| Audit retention policies | `GET /api/compliance/retention` |
| Role change history | `GET /api/compliance/role-change-history` |
| API key usage report | `GET /api/compliance/api-key-usage` |
| Login history | `GET /api/compliance/login-history` |
| Session inventory | `GET /api/compliance/sessions` |
| Session revocation | `POST /api/compliance/sessions/:id/revoke` |
| Panel IP allowlist | `GET /api/compliance/panel-ip-allowlist` |
| 2FA/password/approval policies | `GET /api/compliance/policies` |
| Security baseline report | `GET /api/compliance/security-baseline` |
| Backup compliance report | `GET /api/compliance/backup-compliance` |
| Destructive approval workflow | `GET/POST /api/compliance/approvals` |

Audit exports are tamper-evident. Each exported event is masked, ordered and linked with a SHA-256 hash chain. The export includes the generated time, actor metadata, count and head hash.

## Scale and Automation

The Enterprise Ops panel and `/api/enterprise/*` endpoints expose the v1.5 scale and automation surface:

- Team/project ownership.
- Project-level RBAC.
- Environment-level permissions.
- Workflow automation builder.
- Maintenance windows.
- Notification routing.
- Signed webhook subscriptions.
- Terraform provider planning.
- CLI dry-run command contracts.
- Bulk import/export dry-run.
- Queue isolation by job type.
- Worker concurrency controls.

Important endpoints:

```text
GET  /api/enterprise/teams
GET  /api/enterprise/permissions
GET  /api/enterprise/workflows
GET  /api/enterprise/maintenance
GET  /api/enterprise/notifications
GET  /api/enterprise/webhooks
POST /api/enterprise/webhooks/dry-run
GET  /api/enterprise/terraform
GET  /api/enterprise/cli
POST /api/enterprise/bulk/dry-run
GET  /api/enterprise/queues
```

## Enterprise Ops

The v2.0 Enterprise Ops control surface includes:

- Multi-tenant organization model.
- SSO / SAML / OIDC control surface.
- SCIM provisioning control surface.
- Fine-grained permissions.
- HA API deployment profile.
- HA DNS_NameServer profile.
- Multi-region DNS.
- DNSSEC signing and rotation.
- Enterprise WAF policies.
- Managed challenge integrations.
- Advanced rate limiting.
- Policy-as-code import/export.
- Approval workflows.
- Immutable audit archive.
- SIEM export.
- Long-term metrics storage.
- Disaster recovery runbooks.
- Signed release verification.
- Agent auto-update channels.
- Enterprise backup encryption with key rotation planning.
- Support bundle export.

Important endpoints:

```text
GET  /api/enterprise/overview
GET  /api/enterprise/organizations
GET  /api/enterprise/sso
GET  /api/enterprise/scim
GET  /api/enterprise/ha
GET  /api/enterprise/dns
GET  /api/enterprise/dnssec
GET  /api/enterprise/waf
GET  /api/enterprise/policy-as-code
GET  /api/enterprise/immutable-audit
GET  /api/enterprise/siem
GET  /api/enterprise/metrics
GET  /api/enterprise/dr
POST /api/enterprise/releases/verify
GET  /api/enterprise/agent-channels
GET  /api/enterprise/backup-encryption
GET  /api/enterprise/support-bundle
```

## Security

Security defaults include:

- Argon2id password hashing.
- AES-256-GCM secret encryption.
- RSA envelope encryption support.
- OTP helper support.
- HSTS.
- CSP.
- X-Frame-Options / frame-ancestors denial.
- X-Content-Type-Options no-sniff.
- Permissions-Policy.
- API request sanitization.
- Zod request validation.
- Rate limiting.
- RBAC middleware.
- Session revocation.
- API key hashing.
- Secret masking.
- SQL Console write-operation guard.
- File Manager path guard.
- Terminal destructive command guard.
- Agent operation allowlist.
- Tamper-evident audit export.

Production refuses unsafe TLS overrides such as `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Supported Platforms

Production target:

- Ubuntu 22.04+
- Ubuntu 24.04+
- Debian 11+
- Debian 12+
- AlmaLinux 9+
- Rocky Linux 9+

Best-effort:

- CentOS Stream 9 compatible hosts.
- RHEL-compatible distributions with systemd.

Experimental:

- FreeBSD with manual service adaptation.

See [Platform Support.md](<Platform Support.md>).

## Installation

Development:

```bash
git clone https://github.com/hamzadenizyilmaz/OpenDeploy.git
cd OpenDeploy
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run prisma:generate
npm run prisma:dev
npm run seed
npm run dev
```

Production installer:

```bash
curl -fsSL https://raw.githubusercontent.com/hamzadenizyilmaz/OpenDeploy/main/install.sh | bash
```

Advanced example:

```bash
curl -fsSL https://raw.githubusercontent.com/hamzadenizyilmaz/OpenDeploy/main/install.sh | bash -s -- \
  --domain panel.example.com \
  --port 8080 \
  --nginx \
  --ssl-email admin@example.com \
  --production \
  --dns-mode creartsoft
```

Self-hosted DNS Cloud:

```bash
./install.sh \
  --dns-mode self-hosted \
  --dns-api-url https://dns.example.com/api/v1 \
  --dns-admin-url https://dns.example.com \
  --dns-ns1 ns1.example.com \
  --dns-ns2 ns2.example.com
```

## Environment Highlights

Main OpenDeploy:

```env
APP_URL=http://localhost:8080
API_PORT=4000
DATABASE_URL=postgresql://opendeploy:change-me@localhost:5432/opendeploy
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
OPENDEPLOY_ENCRYPTION_KEY=
AGENT_URL=http://127.0.0.1:4100
AGENT_TOKEN=
DNS_CLOUD_ENABLED=true
DNS_CLOUD_MODE=creartsoft
DNS_CLOUD_API_URL=https://dns.creartsoft.com/api/v1
DNS_CLOUD_ADMIN_URL=https://dns.creartsoft.com
DNS_DEFAULT_NS1=dp-ns1.opendeploy.com
DNS_DEFAULT_NS2=dp-ns2.opendeploy.com
```

DNS Cloud:

```env
DNS_CLOUD_API_PORT=4300
DNS_CLOUD_API_URL=https://dns.creartsoft.com/api/v1
DNS_CLOUD_ADMIN_URL=https://dns.creartsoft.com
DNS_CLOUD_CORS_ORIGINS=https://dns.creartsoft.com
DNS_CLOUD_DATABASE_URL=postgresql://opendeploy_dns:change-me@localhost:5432/opendeploy_dns
DNS_CLOUD_JWT_SECRET=
DNS_CLOUD_ADMIN_TOKEN=
DNS_DEFAULT_NS1=dp-ns1.opendeploy.com
DNS_DEFAULT_NS2=dp-ns2.opendeploy.com
DNS_ZONE_SOURCE=cloud
DNS_RECURSION_ENABLED=false
```

## Useful Commands

Main repo:

```bash
npm install
npm run prisma:generate
npm run build
npm audit --audit-level=low
npm run dev
```

DNS Cloud repo:

```bash
cd "OpenDeploy DNS Cloud"
npm install
npm audit --audit-level=low
npm run check
npm run build
```

Service helper:

```bash
opendeploy status
opendeploy start
opendeploy stop
opendeploy restart
opendeploy update
opendeploy repair
opendeploy backup
opendeploy doctor
```

## User Guide

Daily operation, first setup, DNS, backups, updates, repair and troubleshooting are documented in [docs/user-guide.md](docs/user-guide.md).

## Quality Gates

Before release:

- `npm audit --audit-level=low` returns zero vulnerabilities.
- `npm run build` succeeds.
- `npm run prisma:generate` succeeds.
- DNS Cloud `npm run check` succeeds.
- DNS Cloud Admin Panel build succeeds.
- API `/health` returns 200.
- Main panel `/dashboard`, `/dns`, `/compliance`, `/enterprise` render.
- DNS Cloud `/api/v1/health` returns 200.
- Tamper-evident audit export returns a head hash.
- No production secret uses development defaults.

## Non-Goals

- OpenDeploy does not act as a recursive public DNS resolver.
- The API service does not run arbitrary shell commands directly.
- The project does not replace a full enterprise SIEM.
- Provider credentials must not be stored in plaintext.
- Unsupported operating systems are not production targets.

## License

MIT
