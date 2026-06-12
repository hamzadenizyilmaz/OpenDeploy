# OpenDeploy Microservices Layout

OpenDeploy is split into small runtime services with clear ownership boundaries.

## Services

| Service | Path | Port | Responsibility |
| --- | --- | --- | --- |
| Web | `apps/web` | 8080 | Next.js UI, responsive panel, API Docs view and session client. |
| API | `apps/api` | 4000 | Auth, RBAC, audit logs, DNS, domains, deployments, backups and control-plane APIs. |
| Agent | `apps/agent` | 4100 | Privileged host operations through an allowlisted local adapter. |
| Worker | `apps/worker` | n/a | Background jobs for deploys, backups, updates and cron checks. |
| DNS Cloud API | `OpenDeploy DNS Cloud/DNS_Cloud_API` | 4300 | Central DNS control-plane for instances, domains, records, NS checks, zone sync and admin APIs. |
| DNS Admin Panel | `OpenDeploy DNS Cloud/DNS_Admin_Panel` | 4310 | Central operator dashboard for DNS Cloud instances, domains, nameservers, logs and security. |
| DNS_NameServer | `OpenDeploy DNS Cloud/DNS_NameServer` | 53/5353 | Authoritative-only DNS replies from local JSON or DNS Cloud zone snapshots. |
| Panel DNS Module | `OpenDeploy DNS Cloud/OpenDeploy_Panel_Modules/dns` | n/a | Panel-side DNS Cloud client, validators, service and Express route bridge. |
| PostgreSQL | external/container | 5432 | Primary durable data store. |
| Redis | external/container | 6379 | Queues, cache and background coordination. |

## Request Boundaries

- The Web service never executes host commands directly.
- The API validates requests, checks RBAC and writes audit records.
- The Agent is the only service expected to touch Nginx, Apache, firewall, PM2 and host-level files.
- The Worker handles long-running or scheduled work so API requests stay quick.
- DNS Cloud API owns domain verification, zone validation and authoritative snapshot generation.
- DNS_NameServer reads local JSON in development or DNS Cloud snapshots in production, then answers authoritative DNS queries only.
- The hosted control-plane model uses `dns.creartsoft.com` for DNS management and `dp-ns1.opendeploy.com` / `dp-ns2.opendeploy.com` for customer delegation.

## Deployment

- `docker-compose.yml` includes PostgreSQL, Redis, DNS Cloud API, DNS Admin Panel and DNS_NameServer for local/service testing.
- `scripts/systemd/*.service` defines Linux units for API, Web, Agent, Worker, DNS Cloud API, DNS Admin Panel and DNS_NameServer.
- `install.sh` installs all systemd services on supported Linux distributions.
- FreeBSD is detected but rc.d service generation is currently marked experimental.

## Security Rules

- Services run with least privilege where practical.
- API and Web send security headers.
- Agent commands are allowlisted and use `spawn` without shell expansion.
- DNS_NameServer does not recurse and should be firewalled to DNS ports only.
- Secrets should be stored encrypted with envelope encryption when external provider credentials are added.
