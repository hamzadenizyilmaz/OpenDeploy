# Agent

The Agent performs safe local system operations for OpenDeploy.

## Design

- Runs as `opendeploy-agent.service`.
- Listens on localhost by default.
- Requires `AGENT_TOKEN`.
- Accepts only known operation names.
- Validates arguments with schemas.
- Uses safe spawn APIs without shell interpolation.

## Operation Examples

- `system.metrics`
- `service.status`
- `service.start`
- `service.stop`
- `service.restart`
- `firewall.openPort`
- `firewall.closePort`
- `proxy.writeNginxSite`
- `ssl.issue`
- `file.read`
- `file.write`
- `pm2.restart`
