# Security Policy

OpenDeploy is designed around least privilege. The API must never become a direct root command execution layer.

## Supported Versions

Security fixes are provided for the latest minor version.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories. Do not open public issues for vulnerabilities.

## Security Baseline

- API uses JWT access tokens and refresh tokens.
- Passwords are hashed with bcrypt.
- Tokens are stored hashed where applicable.
- Dangerous actions require RBAC and audit logging.
- Agent validates every operation through an allowlist.
- File manager paths are resolved and checked against allowed roots.
- SQL execution uses timeout, max row limit and query audit logs.
- External database access requires explicit enablement and IP allowlist.
- Secrets are masked in logs, API responses and audit details.

## Out of Scope

- Physical server compromise
- Root user compromise outside OpenDeploy
- Vulnerabilities in user-deployed applications
- Misconfigured custom reverse proxy rules added manually
