# Security

## Threat Model

OpenDeploy manages code deployments, files, databases and privileged services. It must assume that:

- Admin browsers can be attacked.
- User repositories may contain malicious scripts.
- Database queries may be destructive.
- Shell commands can be dangerous.
- File paths can be used for traversal attacks.

## Core Rules

1. The API does not run raw privileged shell commands.
2. The Agent only executes allowlisted operations.
3. Every path is normalized and checked against allowed roots.
4. Every sensitive action is audited.
5. Every write endpoint checks RBAC.
6. Secrets are masked before logging or returning responses.

## Agent Security

Agent operations use this pattern:

```json
{
  "operation": "service.restart",
  "payload": {
    "service": "nginx"
  }
}
```

The Agent rejects unknown operations and unsafe parameters.

## File Manager Security

Allowed roots:

- `/var/lib/opendeploy/projects`
- `/var/backups/opendeploy`
- `/var/log/opendeploy`

Blocked roots:

- `/etc`
- `/root`
- `/var/lib/postgresql`
- `/var/lib/mysql`
- `/proc`
- `/sys`

## Command Execution Security

The terminal module is disabled by default in MVP. When enabled:

- Only owner/admin can use it.
- Dangerous commands are blocked.
- Commands are audited.
- `sudo` requires extra confirmation.
