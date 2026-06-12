# Installation

## One-command Install

```bash
curl -fsSL https://raw.githubusercontent.com/hamzadenizyilmaz/OpenDeploy/main/install.sh | bash
```

## With Domain

```bash
curl -fsSL https://raw.githubusercontent.com/hamzadenizyilmaz/OpenDeploy/main/install.sh | bash -s -- \
  --domain panel.example.com \
  --nginx \
  --ssl-email admin@example.com \
  --production
```

## Supported Systems

- Ubuntu Server 22.04 LTS, 24.04 LTS, 26.04 LTS
- Debian 12 Bookworm, Debian 13 Trixie
- AlmaLinux 8.10, 9.x, 10.x
- Rocky Linux 8.10, 9.x, 10.x
- RHEL-compatible 8, 9, 10 as best effort
- CentOS Stream 9, 10 as best effort
- FreeBSD 14.3+ as experimental

## What the Installer Does

- Checks root permission
- Detects OS and package manager
- Checks internet access
- Checks RAM, disk and CPU architecture
- Installs Git, curl, wget, unzip, tar, OpenSSL and certificates
- Installs Node.js LTS, npm, pnpm and PM2
- Installs PostgreSQL and Redis unless skipped
- Installs Nginx or Apache
- Clones OpenDeploy into `/opt/opendeploy`
- Generates secure secrets
- Creates `.env`
- Creates database and runs Prisma migrations
- Builds web app
- Creates systemd services
- Configures DNS Cloud mode and writes DNS Cloud environment values
- Enables and starts services
- Configures reverse proxy
- Opens firewall ports
- Prints the final panel URL

## DNS Cloud

OpenDeploy defaults to a central DNS Cloud model. A GitHub-installed OpenDeploy panel does not have to run an authoritative DNS server locally; it can send domain and record changes to the configured DNS Cloud API.

Default hosted DNS model:

- DNS API: `https://dns.creartsoft.com/api/v1`
- DNS management panel: `https://dns.creartsoft.com`
- Primary nameserver: `dp-ns1.opendeploy.com`
- Secondary nameserver: `dp-ns2.opendeploy.com`

Installer examples:

```bash
./install.sh --dns-mode creartsoft
./install.sh --dns-mode creartsoft --dns-registration-token <token-from-dns-cloud>
./install.sh --dns-mode self-hosted --dns-api-url https://dns.example.com/api/v1 --dns-admin-url https://dns.example.com --dns-ns1 ns1.example.com --dns-ns2 ns2.example.com
```

After a customer connects a domain, the panel sends the zone to DNS Cloud and the customer delegates the domain at the registrar to the configured nameserver pair.

Hosted DNS Cloud registration requires `--dns-registration-token` so a random public install cannot register itself as a trusted control plane. Self-hosted operators can run the API, admin panel and authoritative nameserver from the separate `OpenDeploy DNS Cloud` repository, then point OpenDeploy at that API URL.

## Manual Install

```bash
git clone https://github.com/hamzadenizyilmaz/OpenDeploy.git /opt/opendeploy
cd /opt/opendeploy
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run build
```
