# API

## Response Format

Success:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Human readable error message",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

## Route Groups

- `/api/auth`
- `/api/users`
- `/api/roles`
- `/api/projects`
- `/api/deployments`
- `/api/databases`
- `/api/database-browser`
- `/api/database-query`
- `/api/redis-browser`
- `/api/mongodb-browser`
- `/api/domains`
- `/api/ssl`
- `/api/proxy`
- `/api/firewall`
- `/api/files`
- `/api/terminal`
- `/api/services`
- `/api/logs`
- `/api/monitoring`
- `/api/backups`
- `/api/system`
- `/api/update`
- `/api/settings`
- `/api/audit`
