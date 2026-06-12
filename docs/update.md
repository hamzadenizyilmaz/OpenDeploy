# Updating OpenDeploy

## CLI Update

```bash
sudo ./update.sh --update
```

## Check Only

```bash
sudo ./update.sh --check
```

Release checks use:

```text
https://github.com/hamzadenizyilmaz/OpenDeploy
```

Override only for private forks:

```bash
OPENDEPLOY_UPDATE_REPO=https://github.com/hamzadenizyilmaz/OpenDeploy.git sudo ./update.sh --check
```

The API first checks the latest GitHub release. If the repository has tags but no release entry yet, it falls back to the latest tag from the same repository.

## Rollback

```bash
sudo ./update.sh --rollback
```

## Update Flow

1. Detect current version.
2. Check latest GitHub release.
3. Create pre-update backup.
4. Stop services.
5. Pull new code.
6. Install dependencies.
7. Run migrations.
8. Build frontend.
9. Restart API, Web, Worker and Agent.
10. Reload Nginx/Apache.
11. Run health check.
12. Rollback if health check fails.
