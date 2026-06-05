#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-parkshare-dev}"
ENV_FILE="${ENV_FILE:-.env.k8s.local}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required but was not found in PATH." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE." >&2
  echo "Create it from your local .env and add DISCORD_WEBHOOK_URL." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

required_vars=(
  DATABASE_URL
  DIRECT_URL
  JWT_SECRET
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  DISCORD_WEBHOOK_URL
)

for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    echo "Missing required variable in $ENV_FILE: $var_name" >&2
    exit 1
  fi
done

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic parkshare-backend-secrets \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=DIRECT_URL="$DIRECT_URL" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  --from-literal=STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  --from-literal=FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://dev.parkshare.local}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic alertmanager-discord-webhook \
  --from-literal=url="$DISCORD_WEBHOOK_URL" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Kubernetes runtime secrets are ready in namespace: $NAMESPACE"
