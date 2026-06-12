# OpenDeploy Roadmap

This roadmap describes the product direction for OpenDeploy and OpenDeploy DNS Cloud.

Current release track: **v2.0.0 Enterprise Ops**  
Next release track: **v2.2.0 Enterprise Dev**

## Product Direction

OpenDeploy is moving from a self-hosted deployment panel into an enterprise-grade operations platform for:

- Application deployments.
- DNS and authoritative nameserver operations.
- Reverse proxy and firewall management.
- Database operations.
- Backups and disaster recovery.
- Compliance and governance.
- Enterprise automation.
- Security policy management.
- Monitoring and operational reporting.

## Product Principles

- Security controls must be visible, auditable and exportable.
- Privileged host operations must go through the Agent, not direct API shell execution.
- DNS Cloud must remain separate from the local OpenDeploy panel.
- DNS_NameServer must be authoritative-only and never act as a recursive resolver.
- Sensitive values must be masked by default.
- Automation must support dry-run before apply.
- Destructive actions must support approval gates.
- Enterprise features should start as clear control surfaces before vendor-specific integrations are finalized.
- Every release must keep install, update, rollback and recovery paths understandable.

## v1.0.0 Production Ready

Goal: make OpenDeploy stable for self-hosted production usage.

Core scope:

- Installer, updater, repair and uninstall scripts.
- First setup flow.
- Auth, sessions, RBAC and owner/admin roles.
- API keys with hashed tokens.
- Audit logs.
- Projects and deployments.
- PM2 Manager.
- Nginx / Apache proxy surface.
- Domains and SSL.
- DNS Manager backed by DNS Cloud.
- Firewall and Ports.
- Database management.
- Database Browser and SQL Console.
- Backups.
- Monitoring.
- Server Update.
- Settings.
- API Docs.
- Linux platform support documentation.

Quality gates:

- Main app build passes.
- Prisma generate passes.
- Dependency audit is clean.
- API health endpoint returns 200.
- Installer works on supported Linux families.
- No known critical or high security issue remains open.

## v1.2.0 Compliance and Governance

Goal: make the platform easier to operate in regulated environments.

Delivered control surfaces:

- Audit export.
- Tamper-evident SHA-256 hash chain.
- Audit retention policies.
- Role change history.
- API key usage report.
- Login history.
- Session inventory and revocation.
- Panel IP allowlist policy.
- 2FA enforcement policy.
- Password policy controls.
- Security baseline report.
- Backup compliance report.
- Destructive action approval workflow.

OpenDeploy API endpoints:

```text
GET  /api/compliance/overview
GET  /api/compliance/audit-export
GET  /api/compliance/retention
GET  /api/compliance/role-change-history
GET  /api/compliance/api-key-usage
GET  /api/compliance/login-history
GET  /api/compliance/sessions
POST /api/compliance/sessions/:id/revoke
GET  /api/compliance/panel-ip-allowlist
GET  /api/compliance/policies
PUT  /api/compliance/policies
GET  /api/compliance/security-baseline
GET  /api/compliance/backup-compliance
GET  /api/compliance/approvals
POST /api/compliance/approvals
```

DNS Cloud compliance endpoints:

```text
GET /api/v1/compliance/overview
GET /api/v1/compliance/audit-export
GET /api/v1/compliance/retention
GET /api/v1/compliance/api-key-usage
GET /api/v1/compliance/backup-compliance
GET /api/v1/compliance/security-baseline
```

Quality gates:

- Audit exports must include generated time, actor metadata, count and head hash.
- Sensitive values must be masked by default.
- Compliance reports must include time range or generated time.
- Session revocation must write audit evidence.
- Destructive action approval requests must be audit-visible.

## v1.5.0 Scale and Automation

Goal: support larger teams and automated operations.

Delivered control surfaces:

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
- Queue isolation.
- Worker concurrency controls.

OpenDeploy API endpoints:

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

Quality gates:

- Automation must be auditable.
- Bulk operations must support dry-run.
- Webhooks must be signed with HMAC-SHA256.
- Queue isolation must describe job type and concurrency.
- Project and environment permissions must be explicit.

## v2.0.0 Enterprise Ops

Goal: provide enterprise-grade operations for deployment, DNS, security, monitoring and recovery.

Delivered control surfaces:

- Multi-tenant organization model.
- SSO / SAML / OIDC control surface.
- SCIM provisioning control surface.
- Fine-grained permissions.
- HA API deployment profile.
- HA DNS_NameServer profile.
- Multi-region DNS.
- DNSSEC signing and rotation control surface.
- Enterprise WAF policies.
- Managed challenge integrations.
- Advanced rate limiting surface.
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

OpenDeploy API endpoints:

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

DNS Cloud enterprise endpoints:

```text
GET /api/v1/enterprise/overview
GET /api/v1/enterprise/ha-dns
GET /api/v1/enterprise/multi-region-dns
GET /api/v1/enterprise/dnssec
GET /api/v1/enterprise/waf
GET /api/v1/enterprise/siem
GET /api/v1/enterprise/dr
GET /api/v1/enterprise/nameserver-profile
```

Enterprise release criteria:

- HA architecture is documented.
- DNS_NameServer supports multi-node authoritative operation.
- Critical workflows support approval gates.
- Security controls are exportable for audit.
- Restore workflows include dry-run and post-restore smoke checks.
- Upgrade path from v1.0 is documented and reversible.
- Support bundle masks sensitive values.

## v2.2.0 Enterprise Dev

Goal: make enterprise operations friendlier for developers and platform teams.

Planned:

- Environment promotion workflows.
- Preview environments.
- Policy-aware deployment plans.
- Signed automation runs.
- Developer CLI improvements.
- Provider SDK and API client packages.
- Terraform provider prototype.
- GitHub Actions integration examples.
- GitLab CI integration examples.
- Deployment risk report.
- Configuration drift detection.
- Pull-request deployment comments.
- Release evidence bundle.
- Per-environment secret policy.
- Feature-flag provider planning.
- Developer self-service access requests.

Quality gates:

- Every developer workflow must support dry-run.
- Generated plans must show risk, approval requirement and rollback strategy.
- Automation signatures must be verifiable.
- CI examples must avoid plaintext secrets.
- Enterprise Dev must not weaken v2.0 security gates.

## Long-Term Research

- Kubernetes adapter.
- Nomad adapter.
- Container orchestration profiles.
- WASM plugin model.
- Open Policy Agent integration.
- External secret manager integrations.
- Hardware security module support.
- AI-assisted log triage.
- AI-assisted deployment risk scoring.
- Cross-cloud deployment targets.
- Advanced DNS traffic steering.
- Signed zone transfer planning.

## Non-Goals

- Running arbitrary shell commands directly from the API service.
- Replacing full enterprise SIEM products.
- Acting as a recursive public DNS resolver.
- Managing unsupported operating systems as production targets.
- Storing provider credentials in plaintext.
- Bypassing registrar-controlled nameserver delegation.
