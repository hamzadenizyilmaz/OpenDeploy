# Changelog

## v2.2.0 Enterprise Dev - Planned

### Direction
- Developer-focused enterprise workflows.
- Environment promotion and preview environment planning.
- Policy-aware deployment plans.
- Signed automation runs.
- Provider SDK and Terraform provider planning.
- CI integration examples and release evidence bundles.

## 1.0.0 - Login validation hotfix

### Fixed
- Login form now trims and lowercases email before sending the request.
- Login requests no longer attach stale access tokens.
- Backend login validator now returns human-readable field errors instead of a generic "Validation failed" response.
- Login password validation no longer rejects normal credential checks with HTTP 422; wrong credentials return `INVALID_CREDENTIALS`.
- Setup and user creation normalize email/name input consistently.

## 1.2.0

- Fixed dark/light theme handling with persisted client-side theme toggle.
- Added protected routes and session validation around dashboard pages.
- Improved login and first setup flow.
- Added idempotent seed script for development owner account and RBAC permissions.
- Added working Users page: list, create, enable and disable users.
- Replaced dead `New` buttons with working create flows or removed them where creation is not valid.
- Added working create flows for projects, database servers, domains, firewall rules, files, terminal sessions and backups.
- Added API endpoints for user status, domain creation, file creation and terminal session records.
- Added development dry-run behavior for agent and queue operations when dependencies are not running.
- Improved dashboard, database browser, SQL console, services, monitoring, logs, settings and audit pages.

## 1.5.0

- Initial OpenDeploy monorepo scaffold.
- Next.js web dashboard.
- Express API skeleton.
- Agent service with allowlisted operations.
- Worker queues.
- Prisma schema.
- Installer/update/uninstall/repair scripts.
- Documentation and GitHub templates.

## v2.0.0 Enterprise Ops - Security hardening and panel expansion

### Security
- Added API request sanitization against prototype pollution keys, suspicious payload flags and oversized strings.
- Hardened API headers with Helmet CSP, no X-Powered-By, strict JSON parsing and safer CORS.
- Added API key management with hashed tokens and one-time reveal.
- Added API-key authentication via `X-OpenDeploy-Key` and `X-API-Key` headers.
- Expanded RBAC permissions for DNS, API Keys, PM2, Auto Cron and server updates.
- Added SQL console guard for multi-statement SQL, write queries, DDL, TRUNCATE and DELETE without WHERE.
- Hardened File Manager with protected path blocks, max editable size and file audit records.
- Hardened Terminal with allowlist, sudo confirmation and destructive command blocking.
- Added Next.js response security headers.
- Added Compliance API with tamper-evident audit export, retention policy, role history, API key usage, login history, session revocation, panel IP allowlist, 2FA/password policy, security baseline, backup compliance and destructive approval workflow.
- Added Enterprise API with SSO/SCIM control surfaces, HA API, HA DNS, multi-region DNS, DNSSEC, WAF, policy-as-code, immutable audit archive, SIEM export, long-term metrics, DR runbooks, signed release verification, agent channels, backup encryption and support bundle export.
- Added DNS Cloud Compliance API and DNS Cloud Enterprise API.

### Product
- Fixed readable role labels in user creation and all tables.
- Added DNS Manager.
- Added API Keys panel.
- Added Auto Cron panel.
- Added PM2 Manager.
- Rebuilt Monitoring, Settings, Roles, Audit Logs, Server Update, Firewall, Nginx/Apache, File Manager, SSL, Deployments, Domains, Databases, Backups, Terminal and SQL Console screens.
- Added ready presets for firewall, reverse proxy and SQL console.
- Added Compliance and Enterprise Ops pages to the main OpenDeploy panel.
- Added `/compliance` and `/enterprise` pages to the DNS Admin Panel.
- Added HA authoritative DNS, multi-region DNS, DNSSEC, SIEM, DR and nameserver enterprise profile helpers for DNS Cloud.