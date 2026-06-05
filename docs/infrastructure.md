# Infrastructure Diagram

```mermaid
flowchart TB
  Dev[Developer branch / PR]
  Main[main branch]
  Actions[GitHub Actions]
  CI[CI\nlint + tests + build]
  CD[CD\nDocker build + push]
  DockerHub[(Docker Hub)]
  ArgoCD[ArgoCD Applications]
  KustomizeDev[Kustomize overlay: dev]
  KustomizeProd[Kustomize overlay: prod]
  Cluster[Kubernetes cluster]

  BackendPod[Backend deployment]
  FrontendPod[Frontend deployment]
  Prometheus[Prometheus]
  Grafana[Grafana]
  Alertmanager[Alertmanager]
  DiscordBridge[alertmanager-discord]
  Discord[Discord channel]
  StripeCLI[Stripe test webhooks]

  Dev --> Actions
  Main --> Actions
  Actions --> CI
  CI --> CD
  CD --> DockerHub
  DockerHub --> Cluster
  ArgoCD --> KustomizeDev
  ArgoCD --> KustomizeProd
  KustomizeDev --> Cluster
  KustomizeProd --> Cluster

  Cluster --> BackendPod
  Cluster --> FrontendPod
  Cluster --> Prometheus
  Cluster --> Grafana
  Cluster --> Alertmanager
  Alertmanager --> DiscordBridge
  DiscordBridge --> Discord
  StripeCLI --> BackendPod
  Prometheus --> BackendPod
  Prometheus --> FrontendPod
```

## Summary

GitHub Actions validates the monorepo and builds Docker images. ArgoCD applies Kubernetes manifests through Kustomize overlays. Prometheus, Grafana, Alertmanager, and the Discord bridge provide the observability path.
