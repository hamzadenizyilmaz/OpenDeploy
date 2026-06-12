# OpenDeploy Security Hardening

OpenDeploy v2.0.0 Enterprise Ops adds defense-in-depth controls across API, Web, Agent and privileged system operations.

## Web/API hardening

- Express disables `X-Powered-By`.
- Helmet sets security headers and API CSP defaults.
- API and Web send HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.
- JSON payload limit is reduced to 1 MB.
- URL encoded body limit is 200 KB.
- Request IDs are attached to every API request.
- Prototype pollution keys are stripped from body, query and params.
- Suspicious strings such as script tags, `javascript:` URLs and path traversal patterns are flagged.
- React renders text safely without raw HTML sinks.
- Next.js disables the powered-by header and sets an application CSP for scripts, styles, images, forms and API connections.

## Authentication and authorization

- JWT access tokens remain the browser login method.
- Refresh token flow is preserved.
- Browser token persistence moved away from `localStorage`; tokens now use memory plus `sessionStorage` migration for old sessions.
- Passwords are hashed with Argon2id. Existing bcrypt hashes are verified and upgraded after a successful login.
- New API keys are hashed with Argon2id and shown only once. Legacy SHA-256 API key hashes remain verifiable for backward compatibility.
- API requests can authenticate with `X-OpenDeploy-Key` or `X-API-Key`.
- RBAC checks run on every protected API route.
- New permissions include `api_keys.manage`, `dns.manage`, `cron.manage` and `pm2.manage`.

## SQL Console protections

- Multi-statement SQL is blocked.
- DDL operations require confirmation.
- Write queries require read-only mode to be disabled and confirmation to be checked.
- `DELETE FROM` without `WHERE` is blocked unless explicitly confirmed.
- All query requests are hashed and logged to audit records.
- Real engine adapters must use timeouts, result limits and parameterized execution.

## File Manager protections

- All paths are resolved under allowed OpenDeploy project roots.
- `/etc`, `/root`, `/var/lib`, `.ssh`, `id_rsa` and PEM files are blocked from browser operations.
- Editable file size is limited.
- Create, write, rename and delete actions are audited.

## Terminal protections

- Browser terminal is modeled as an audited command launcher.
- Destructive commands such as `rm -rf /`, `dd`, `mkfs`, `shutdown` and pipe-to-shell installers are blocked.
- `sudo` requires explicit confirmation.
- Production PTY streaming must stay inside the OpenDeploy Agent allowlist.

## Agent model

- The web API never runs root shell commands directly.
- Privileged operations are routed to the local Agent.
- Agent operations are allowlisted by operation name.
- `spawn(..., { shell: false })` is used for command execution.
- PM2, Nginx/Apache config test and proxy write operations are explicit allowlist entries.

## Cryptography profile

- Argon2id is the default password hashing algorithm.
- AES-256-GCM is available for authenticated encryption of provider credentials, backup secrets and sensitive metadata.
- Envelope encryption is implemented with a random AES-256 data key wrapped by RSA-OAEP-SHA256.
- ECC keypair generation is available for future signing, ECDH and certificate workflows.
- RSA-4096 helper functions are available for key wrapping.
- OTP codes are generated with `crypto.randomInt`; TOTP remains the recommended login 2FA model.
- Cryptographic one-time pad encryption is intentionally not used for web credentials because it requires a truly random pad that is as long as the message and must never be reused.

## DNS hardening

- DNS record names and values are type-validated before storage.
- OpenDeploy DNS zones bootstrap `A`, `CNAME`, `TXT` and `NS` defaults.
- `OpenDeploy DNS Cloud/DNS_NameServer` runs as an authoritative-only UDP service and does not provide recursive resolution.

## Cryptography Baseline

- Passwords use Argon2id. Legacy bcrypt hashes are upgraded on successful login.
- Secret settings are encrypted before storage with AES-256-GCM.
- `OPENDEPLOY_ENVELOPE_PUBLIC_KEY` enables RSA-OAEP-SHA256 envelope encryption for secret payloads.
- ECC key generation helpers are available for integrations that need elliptic-curve identity or signing keys.
- OTP values should be treated as one-time passwords and stored only as HMAC-SHA256 verification hashes when persistence is required.
- Production requires `OPENDEPLOY_ENCRYPTION_KEY` or an envelope public key.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is blocked in production.
- Nameserver zone files are JSON and intended to be exported from the panel/API.

## Remaining production checklist

- Add migrations for new DNS and Auto Cron models.
- Use signed release verification for update downloads.
- Wire external backup credentials and provider tokens to `cryptoSuite.envelopeEncrypt`.
- Add CSRF token checks if switching from bearer tokens to cookie auth.
- Run SAST, dependency scanning and container scanning in CI.
