# Alertmanager

This directory contains the minimal ParkShare Alertmanager setup.

It provides:

- Alertmanager routing configuration
- One Alertmanager webhook receiver
- An `alertmanager-discord` adapter that converts Alertmanager webhook payloads
  into Discord webhook messages
- Kubernetes Deployment and Service manifests
- A local secret template for the webhook URL

Prometheus is not configured here yet. When Prometheus is added, point it at:

```text
http://alertmanager.observability.svc.cluster.local:9093
```

## Configure the Discord webhook secret

Do not commit the real Discord webhook URL. Create the secret locally before
applying Alertmanager:

```powershell
kubectl create namespace observability
kubectl create secret generic alertmanager-discord-webhook `
  --namespace observability `
  --from-literal=url="https://discord.com/api/webhooks/..."
```

Then apply the manifests:

```powershell
kubectl apply -f infra/observability/alertmanager/
```

## Testing

After Alertmanager is running, port-forward it:

```powershell
kubectl -n observability port-forward svc/alertmanager 9093:9093
```

Then post a sample alert:

```powershell
$body = @'
[
  {
    "labels": {
      "alertname": "ParkShareTestAlert",
      "severity": "warning",
      "service": "manual-test"
    },
    "annotations": {
      "summary": "Alertmanager Discord route test",
      "description": "This is a manual test alert from ParkShare."
    },
    "startsAt": "2026-05-25T12:00:00Z"
  }
]
'@

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:9093/api/v2/alerts `
  -ContentType "application/json" `
  -Body $body
```
