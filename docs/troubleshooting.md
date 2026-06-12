# Troubleshooting

## Services

```bash
sudo systemctl status opendeploy-api
sudo systemctl status opendeploy-web
sudo systemctl status opendeploy-agent
sudo systemctl status opendeploy-worker
```

## Logs

```bash
sudo journalctl -u opendeploy-api -f
sudo journalctl -u opendeploy-worker -f
```

## Repair

```bash
sudo ./repair.sh
```

## Common Issues

### Database connection failed

Check `DATABASE_URL` in `/etc/opendeploy/opendeploy.env`.

### Redis connection failed

Check `REDIS_URL` and Redis service status.

### Nginx config failed

Run:

```bash
sudo nginx -t
```
