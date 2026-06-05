# ParkShare ArgoCD

This folder contains ArgoCD `Application` manifests for GitOps deployment.

## Applications

- `parkshare-dev-app.yaml` syncs `infra/k8s/overlays/dev` from the `dev` branch into the `parkshare-dev` namespace.
- `parkshare-prod-app.yaml` syncs `infra/k8s/overlays/prod` from the `main` branch into the `parkshare-prod` namespace.

## Required secrets

ArgoCD creates the app namespaces, but it does not create application secrets. Create the backend secret before syncing:

```powershell
kubectl create namespace parkshare-dev
kubectl create secret generic parkshare-backend-secrets `
  --namespace parkshare-dev `
  --from-literal=DATABASE_URL="postgresql://..." `
  --from-literal=JWT_SECRET="..." `
  --from-literal=STRIPE_SECRET_KEY="sk_test_..." `
  --from-literal=STRIPE_WEBHOOK_SECRET="whsec_..." `
  --from-literal=FRONTEND_ORIGIN="http://dev.parkshare.local"
```

Use `parkshare-prod` and production values for the production app.

## Apply

Install ArgoCD in the cluster first, then apply the app you want:

```powershell
kubectl apply -n argocd -f infra/argocd/parkshare-dev-app.yaml
```

For production:

```powershell
kubectl apply -n argocd -f infra/argocd/parkshare-prod-app.yaml
```

## Local render checks

```powershell
kubectl kustomize infra/k8s/overlays/dev
kubectl kustomize infra/k8s/overlays/prod
```
