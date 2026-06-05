# Architecture Diagram

```mermaid
flowchart LR
  Driver[Driver browser]
  Host[Host browser]
  Admin[Admin browser]

  Frontend[Next.js frontend\napps/frontend]
  Backend[NestJS API\napps/backend]
  Contracts[Shared contracts\npackages/contracts]
  Prisma[Prisma Client]
  Postgres[(Supabase PostgreSQL)]
  Stripe[Stripe Checkout + Webhooks]
  Metrics[Prometheus metrics endpoint]

  Driver --> Frontend
  Host --> Frontend
  Admin --> Frontend

  Frontend -->|REST /api/v1| Backend
  Frontend --> Contracts
  Backend --> Contracts
  Backend --> Prisma
  Prisma --> Postgres
  Backend -->|Create checkout session| Stripe
  Stripe -->|Webhook events| Backend
  Backend -->|/api/metrics| Metrics

  subgraph BackendModules[Backend modules]
    Auth[Auth]
    Users[Users]
    Spots[Spots]
    Bookings[Bookings]
    Payments[Payments]
    Reviews[Reviews]
    Access[Access]
    MetricsModule[Metrics]
  end

  Backend --> BackendModules
```

## Summary

ParkShare is a monorepo with a Next.js frontend, a NestJS backend, shared TypeScript contracts, Prisma, and Supabase PostgreSQL. Stripe handles card collection through Checkout, while the backend owns booking, payment, webhook, and moderation state.
