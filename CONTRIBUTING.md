# Contributing to OpenDeploy

Thank you for helping improve OpenDeploy.

## Development Workflow

1. Fork the repository.
2. Create a feature branch.
3. Keep changes focused and documented.
4. Run linting and tests.
5. Open a pull request with a clear description.

## Code Standards

- Use modular files.
- Validate input at route boundaries.
- Never execute shell commands directly from the API.
- Add audit logs for sensitive operations.
- Add permission checks for every write action.
- Mask secrets before logging.
- Prefer explicit allowlists over blocklists.

## Commit Style

Use clear commits:

```text
feat(api): add project deployment route
fix(agent): block unsafe relative paths
docs: expand database browser guide
```
