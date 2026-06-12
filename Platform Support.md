# OpenDeploy Platform Support

Last reviewed: 2026-06-11

OpenDeploy targets production server distributions with stable security update channels, Node.js 22+, PostgreSQL, Redis, Nginx or Apache, and systemd where available.

## Supported Matrix

| Platform | Versions | Status | Package manager | Service manager | Notes |
| --- | --- | --- | --- | --- | --- |
| Ubuntu Server | 22.04 LTS, 24.04 LTS, 26.04 LTS | Supported | apt | systemd | Recommended default path for production installs. |
| Debian | 12 Bookworm, 13 Trixie | Supported | apt | systemd | Debian stable is preferred; testing/unstable are not production targets. |
| AlmaLinux | 8.10, 9.x, 10.x | Supported | dnf | systemd | RHEL-compatible path. Use the latest minor release in each major line. |
| Rocky Linux | 8.10, 9.x, 10.x | Supported | dnf | systemd | RHEL-compatible path. Use the latest minor release in each major line. |
| RHEL-compatible | 8, 9, 10 | Best effort | dnf | systemd | Covers compatible enterprise rebuilds when repositories provide Node.js 22, PostgreSQL and Redis. |
| CentOS Stream | 9, 10 | Best effort | dnf | systemd | Suitable for staging or users intentionally tracking just ahead of RHEL. |
| FreeBSD | 14.3, 14.4, 15.0 | Experimental | pkg | rc.d/service | Scripts detect FreeBSD, install base packages and skip systemd-specific service setup. |

## Not Supported

| Platform | Reason |
| --- | --- |
| CentOS Linux 7/8 | End-of-life lineage; use AlmaLinux/Rocky/RHEL-compatible 8+ instead. |
| Debian testing/unstable | Moving package base; supported only for development experiments. |
| Ubuntu interim releases | Short maintenance window; use LTS for production. |
| Windows server deployment | Development works on Windows, but production scripts target Unix-like hosts. |

## Runtime Requirements

| Component | Required |
| --- | --- |
| CPU | x86_64/amd64 or arm64/aarch64 |
| Memory | 1 GB minimum, 2 GB+ recommended |
| Disk | 3 GB minimum, 10 GB+ recommended |
| Node.js | 22 LTS or newer |
| Database | PostgreSQL 14+ recommended |
| Cache/Queue | Redis 7+ recommended |
| Proxy | Nginx or Apache |
| Firewall | ufw, firewalld or manual pf rules on FreeBSD |

## Lifecycle Notes

- Ubuntu LTS releases receive five years of standard security maintenance; Ubuntu Pro can extend coverage.
- Debian stable has a five-year lifecycle: roughly three years of full support and two years of LTS.
- AlmaLinux 9 security support runs to 2032 and AlmaLinux 10 security support runs to 2035.
- Rocky Linux 9 reaches major-version EOL in 2032 and Rocky Linux 10 in 2035.
- FreeBSD release support is branch based; FreeBSD 14 stable is listed through November 30, 2028 and FreeBSD 15 stable through December 31, 2029.

## Installer Behavior

- `install.sh` detects `apt`, `dnf` or `pkg`.
- Linux/systemd hosts install OpenDeploy API, Web, Agent and Worker units; DNS Cloud API, DNS Admin Panel and DNS_NameServer units are available for DNS Cloud/self-hosted deployments.
- FreeBSD hosts are detected and package installation is attempted, but rc.d service generation is not automated yet.
- `scripts/nginx/create-panel-site.sh` writes Debian-style `sites-available` configs when present and RHEL-style `conf.d` configs otherwise.
- `scripts/apache/create-panel-site.sh` supports both Apache package layouts.

## Sources

- Ubuntu release lifecycle: https://ubuntu.com/about/release-cycle
- Debian releases: https://www.debian.org/releases/
- AlmaLinux release notes: https://wiki.almalinux.org/release-notes/
- Rocky Linux release guide: https://wiki.rockylinux.org/rocky/version/
- CentOS Stream overview: https://www.centos.org/centos-stream/
- FreeBSD supported releases: https://www.freebsd.org/security/
