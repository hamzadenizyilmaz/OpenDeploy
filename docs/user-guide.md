# OpenDeploy User Guide

This guide explains the daily operation flow for OpenDeploy v2.0.0 Enterprise Ops.

## 1. First Install

Recommended production install:

```bash
curl -fsSL https://raw.githubusercontent.com/hamzadenizyilmaz/OpenDeploy/main/install.sh | bash -s -- \
  --domain panel.example.com \
  --nginx \
  --ssl-email admin@example.com \
  --production \
  --dns-mode creartsoft
```

Self-hosted DNS Cloud install:

```bash
curl -fsSL https://raw.githubusercontent.com/hamzadenizyilmaz/OpenDeploy/main/install.sh | bash -s -- \
  --domain panel.example.com \
  --production \
  --dns-mode self-hosted \
  --dns-api-url https://dns.example.com/api/v1 \
  --dns-admin-url https://dns.example.com \
  --dns-ns1 ns1.example.com \
  --dns-ns2 ns2.example.com
```

After install:

1. Open `http://SERVER_IP:8080/setup` or your configured domain.
2. Create the first owner account.
3. Open `Settings` and verify DNS, backup, SMTP, WAF and update settings.
4. Open `Compliance` and check the security baseline.
5. Open `Enterprise Ops` and review HA, DNS, SIEM and DR surfaces.

## 2. Day-to-Day Commands

```bash
opendeploy status
opendeploy doctor
opendeploy logs
opendeploy restart
opendeploy backup
opendeploy update
opendeploy repair
```

If Prisma query logs are too noisy, keep this in `/etc/opendeploy/opendeploy.env`:

```env
OPENDEPLOY_PRISMA_QUERY_LOGS=false
```

Only set it to `true` while debugging database queries.

## 3. Projects

Use `Projects` to create apps. Configure:

- Framework.
- Repository URL.
- Branch.
- Node version.
- Package manager.
- Install command.
- Build command.
- Start command.
- Working directory.
- Port.

Deployments are queued and audited. Failed deploys should be reviewed from `Deployments` and `Logs`.

## 4. DNS

Use `DNS Manager` for domains and records.

Hosted DNS Cloud:

- Delegate the domain to `dp-ns1.opendeploy.com` and `dp-ns2.opendeploy.com`.
- Verify NS delegation from the panel.
- Add records from OpenDeploy.

Self-hosted DNS Cloud:

- Run DNS Cloud from the `OpenDeploy DNS Cloud` repo.
- Point registrar glue/NS records to your own nameservers.
- Keep DNS_NameServer authoritative-only.

## 5. Security

Use these pages regularly:

- `WAF Rules`
- `Advanced Rules`
- `Rate Limiting`
- `Challenge Settings`
- `Audit Logs`
- `Compliance`
- `Enterprise Ops`

Recommended baseline:

- Enable 2FA enforcement for privileged accounts.
- Keep panel IP allowlist in monitor mode first, then enforce.
- Keep backup encryption enabled.
- Export audit logs periodically.
- Review session inventory and revoke unknown sessions.
- Use short-lived API keys for automation.

## 6. Backups

Use `Backups` to configure jobs and providers.

Compliance expectations:

- Encryption enabled.
- Retention policy configured.
- External backup target for production.
- Restore dry-run after provider changes.
- Backup compliance report checked before upgrades.

## 7. Updates

Use:

```bash
opendeploy update
```

The updater:

- Creates a pre-update backup unless disabled.
- Pulls the target version.
- Installs dependencies.
- Runs Prisma generate and migrations.
- Builds the web app.
- Reinstalls systemd units.
- Restarts services.
- Runs API health check.

## 8. Repair

Use:

```bash
opendeploy repair
```

Repair checks:

- Service status.
- Permissions for data, backups and logs.
- Dependencies.
- Prisma client.
- Migrations.
- Web build.
- Systemd units.
- API health.
- Nginx/Apache config tests when present.

## 9. Troubleshooting

API health:

```bash
curl http://127.0.0.1:4000/health
```

DNS Cloud health:

```bash
curl http://127.0.0.1:4300/api/v1/health
```

Logs:

```bash
journalctl -u opendeploy-api -f
journalctl -u opendeploy-web -f
journalctl -u opendeploy-agent -f
journalctl -u opendeploy-worker -f
```

Self-hosted DNS Cloud logs:

```bash
journalctl -u opendeploy-dns-cloud-api -f
journalctl -u opendeploy-dns-admin-panel -f
journalctl -u opendeploy-dns-nameserver -f
```

## 10. Release Checks

Before production release:

```bash
npm audit --audit-level=low
npm run prisma:generate
npm run build
cd "OpenDeploy DNS Cloud"
npm audit --audit-level=low
npm run check
npm run build
```
