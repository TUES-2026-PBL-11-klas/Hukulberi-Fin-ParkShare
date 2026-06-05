# ParkShare

ParkShare is a parking marketplace where hosts list private parking spaces and drivers reserve them through a map-first booking flow. The app includes authentication, host listings, admin verification, reservations, Stripe test payments, observability, and deployment manifests.

## Problem Solved

In busy cities, drivers waste time searching for parking while many private garages, courtyards, and spaces stay unused for parts of the day. ParkShare connects drivers with verified private parking spots and gives hosts a way to list available capacity with photos, coordinates, schedule, and hourly pricing.

## Features

- Driver signup, login, sign out, protected reservations, and access actions
- Host spot listing with map pinning, photos, capacity, days, and available hours
- Admin moderation for verifying, rejecting, enabling, and disabling spots
- Map search with spot pins, hover previews, available-space information, and spot details
- Reservation rules for spot availability, active bookings, and capacity
- Stripe Checkout in test mode with webhook processing and idempotent event storage
- Reviews and access event models for post-booking feedback and gate activity
- CI/CD with GitHub Actions, Docker images, Kubernetes, Kustomize, ArgoCD, Prometheus, Grafana, Alertmanager, and Discord notifications

## Repository Layout

```text
apps/
  backend/        NestJS API
  frontend/       Next.js app
packages/
  contracts/      Shared TypeScript contracts
prisma/           Prisma schema and migrations
infra/
  k8s/            Kubernetes base manifests and overlays
  argocd/         ArgoCD Application manifests
  observability/  Prometheus, Grafana, Alertmanager configs
docs/             Mermaid diagrams and architecture notes
```

## Tech Stack

| Area | Technology | Version / Notes |
| --- | --- | --- |
| Runtime | Node.js | 22+ |
| Frontend | Next.js | 16.2.6 |
| Frontend | React | 19.2.4 |
| Map | Leaflet | 1.9.4 |
| Icons | lucide-react | 1.17.0 |
| Backend | NestJS | 11.x |
| ORM | Prisma | 6.19.3 |
| Database | PostgreSQL / Supabase | Managed PostgreSQL |
| Payments | Stripe SDK | 22.1.1 |
| Metrics | prom-client | 15.1.3 |
| CI/CD | GitHub Actions | Repository workflows |
| Containers | Docker | Backend and frontend images |
| Orchestration | Kubernetes + Kustomize | Base + dev/prod overlays |
| GitOps | ArgoCD | Application manifests |
| Observability | Prometheus, Grafana, Alertmanager | Discord notifications |

## Documentation

Diagrams live in [docs](./docs/README.md):

- [Architecture](./docs/architecture.md)
- [Infrastructure](./docs/infrastructure.md)
- [Database](./docs/database.md)
- [UML](./docs/uml.md)
- [Booking and Payment Flow](./docs/booking-payment-flow.md)
- [Admin Moderation Flow](./docs/admin-moderation-flow.md)
- [API Endpoints](./docs/api-endpoints.md)
- [Formal Bulgarian Documentation](./docs/project-documentation.md)

## Architecture Diagram

The main architecture diagram is in [docs/architecture.md](./docs/architecture.md). GitHub renders the Mermaid diagram directly in the Markdown file.

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL database, Supabase recommended
- Stripe test account and Stripe CLI for local webhook testing
- Docker, optional for image builds
- kubectl and ArgoCD CLI, optional for Kubernetes deployment

## Environment Variables

Create `.env` in the repository root. Do not commit real secrets.

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
JWT_SECRET="replace-with-a-long-random-secret"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
FRONTEND_ORIGIN="http://localhost:3000"
PORT=3001
```

Frontend environment variables can be placed in `apps/frontend/.env.local` if needed:

```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"
```

## Local Development

Install dependencies:

```bash
npm ci
```

Generate Prisma client:

```bash
npx prisma generate
```

Run migrations from the repository root:

```bash
npx prisma migrate dev
```

Start the backend:

```bash
npm run dev --workspace=backend
```

Start the frontend:

```bash
npm run dev --workspace=frontend
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Docker Setup

Build the backend image:

```bash
docker build -t parkshare-backend -f apps/backend/Dockerfile .
```

Build the frontend image:

```bash
docker build -t parkshare-frontend -f apps/frontend/Dockerfile .
```

Run the backend container with environment variables:

```bash
docker run --env-file .env -p 3001:3001 parkshare-backend
```

Run the frontend container:

```bash
docker run -p 3000:3000 parkshare-frontend
```

For Kubernetes deployment, use the Kustomize overlays under `infra/k8s/overlays`.

## API Endpoints

The API reference is documented in [docs/api-endpoints.md](./docs/api-endpoints.md).

Main groups:

- Auth: signup, login, current user
- Users: admin user status changes
- Spots: search, create, edit, admin verification, enable/disable
- Bookings: create, list, view, cancel
- Payments: Stripe Checkout, reconciliation, webhooks
- Reviews: create and list reviews
- Access: booking unlock/access action
- Metrics: Prometheus metrics

## Stripe Webhooks

Start the backend first, then forward Stripe test webhooks:

```bash
stripe listen --forward-to http://127.0.0.1:3001/api/v1/webhooks/stripe
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

Trigger a test event:

```bash
stripe trigger checkout.session.completed
```

The webhook endpoint stores received Stripe events, marks successful payments, and confirms the related booking.

## Admin Flow

1. Host creates a spot.
2. The spot is saved as pending and inactive.
3. Admin opens `/admin`.
4. Admin verifies or rejects the spot.
5. Verified active spots appear on the map.
6. Admin can disable a verified spot without deleting its history.

Only users with `ADMIN` role should access moderation APIs. The frontend also checks the current user before loading `/admin`.

## Useful Scripts

```bash
npm run ci:test
npm run ci:lint
npm run ci:build
npm run secret:scan
```

Workspace-specific scripts:

```bash
npm run test --workspace=backend -- --runInBand
npm run lint:check --workspace=backend
npm run build --workspace=backend
npm run lint --workspace=frontend
npm run build --workspace=frontend
```

## Docker

Build images locally:

```bash
docker build -t parkshare-backend -f apps/backend/Dockerfile .
docker build -t parkshare-frontend -f apps/frontend/Dockerfile .
```

GitHub Actions can build and push images to Docker Hub when the required Docker Hub secrets are configured.

## Kubernetes and ArgoCD

Kubernetes manifests are under `infra/k8s`.

Render a local dry run:

```bash
kubectl apply --dry-run=client -k infra/k8s/overlays/dev
```

Apply a development overlay:

```bash
kubectl apply -k infra/k8s/overlays/dev
```

ArgoCD applications are under `infra/argocd`.

```bash
kubectl apply -f infra/argocd/parkshare-dev-app.yaml
kubectl apply -f infra/argocd/parkshare-prod-app.yaml
```

## Observability

Observability manifests live under `infra/observability` and `infra/k8s/base`.

The stack includes:

- Prometheus scrape config and alert rules
- Grafana datasource and dashboard provisioning
- Alertmanager routes
- Discord webhook bridge for notifications

Alertmanager setup notes are in [infra/observability/alertmanager](./infra/observability/alertmanager/README.md).

## CI/CD Secrets

Configure repository secrets in GitHub:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `DISCORD_WEBHOOK_URL`

Optional deployment-specific values may be added for production domains, ingress hosts, or environment-specific database URLs.

## Security Notes

- Never commit `.env` or real webhook URLs.
- Use Stripe test keys locally and in CI.
- Keep admin-only endpoints protected by JWT and role guards.
- Verified and active spots are the only spots that should appear publicly.
- Use `npm run secret:scan` before pushing sensitive changes.
