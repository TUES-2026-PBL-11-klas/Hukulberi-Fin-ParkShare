# ParkShare Kubernetes

Kubernetes manifests are organized with Kustomize:

- `base` contains the shared backend and frontend manifests.
- `overlays/dev` deploys branch-tagged Docker images to `parkshare-dev`.
- `overlays/prod` deploys `latest` Docker images to `parkshare-prod`.

Render an overlay before applying or syncing it:

```powershell
kubectl kustomize infra/k8s/overlays/dev
kubectl kustomize infra/k8s/overlays/prod
```

Apply without ArgoCD if needed:

```powershell
kubectl apply -k infra/k8s/overlays/dev
```

The backend expects a `parkshare-backend-secrets` Secret in the target namespace.
