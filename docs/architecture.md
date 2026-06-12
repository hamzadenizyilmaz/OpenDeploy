# Architecture

OpenDeploy is a modular monorepo with four runtime services.

## Components

```text
Browser
  ↓
Next.js Web Dashboard
  ↓
REST API
  ↓                 ↘
PostgreSQL / Redis   Local Agent
                         ↓
                    Linux system operations
```

## Web

The web application is built with Next.js 15, React and Tailwind CSS. It contains:

- Dashboard
- Projects
- Deployments
- Database browser
- SQL console
- Domains and SSL
- Firewall
- File manager
- Logs
- Backups
- System update
- Audit logs

## API

The API owns authentication, permissions, audit logging and database persistence.

Rules:

- Every protected route requires authentication.
- Every write action requires permission checks.
- Every sensitive action creates an audit log.
- Shell/system actions are proxied to Agent, never executed directly.

## Agent

The Agent is a local service running on the same server as OpenDeploy. It supports safe operations through an allowlist:

- service status/start/stop/restart
- firewall rules
- reverse proxy config generation
- SSL certbot requests
- safe file operations within allowed roots
- PM2 process operations
- system metrics

## Worker

The Worker processes long-running queues:

- deployments
- backups
- SSL jobs
- health checks
- monitoring
- database backups
- updates

## Data Flow

1. User sends request from Web.
2. API authenticates and checks permissions.
3. API stores request state in PostgreSQL.
4. API queues long-running jobs in Redis/BullMQ.
5. Worker executes job steps.
6. Worker calls Agent when privileged system actions are needed.
7. API streams logs/status to Web.
