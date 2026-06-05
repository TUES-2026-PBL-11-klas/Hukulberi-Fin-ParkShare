# API Endpoints

Base URL in local development: `http://localhost:3001`.

Most protected endpoints require:

```http
Authorization: Bearer <access_token>
```

## Authentication

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/signup` | Public | Create a user account |
| `POST` | `/api/v1/auth/login` | Public | Log in and receive an access token |
| `GET` | `/api/v1/auth/me` | Authenticated | Return the current user |

## Users

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `PATCH` | `/api/v1/users/:id/status` | Admin | Suspend or reactivate a user |

## Spots

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/spots` | Public | Search verified active spots |
| `GET` | `/api/v1/spots/:id` | Public | Get one verified active spot |
| `POST` | `/api/v1/spots` | Authenticated | Create a host spot listing |
| `PUT` | `/api/v1/spots/:id` | Owner | Edit a host spot listing |
| `DELETE` | `/api/v1/spots/:id` | Owner | Delete a host spot listing |
| `GET` | `/api/v1/spots/host/:hostUserId` | Public/internal | List spots by host |
| `GET` | `/api/v1/spots/admin/list` | Admin | List all spots for moderation |
| `PATCH` | `/api/v1/spots/:id/verification` | Admin | Verify or reject a spot |
| `PATCH` | `/api/v1/spots/:id/admin-active` | Admin | Enable or disable a spot |

## Bookings

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/bookings` | Authenticated | Create a reservation hold |
| `GET` | `/api/v1/bookings` | Authenticated | List current user's reservations |
| `GET` | `/api/v1/bookings/:id` | Authenticated | Get one reservation |
| `POST` | `/api/v1/bookings/:id/cancel` | Authenticated | Cancel a reservation |

## Payments

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/payments/checkout-sessions` | Authenticated | Create a Stripe Checkout Session |
| `POST` | `/api/v1/payments/checkout-sessions/:checkoutSessionId/reconcile` | Authenticated | Reconcile a returned Stripe Checkout Session |
| `POST` | `/api/v1/webhooks/stripe` | Stripe webhook | Process Stripe webhook events |

## Reviews

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/reviews` | Authenticated | Create a review after a booking |
| `GET` | `/api/v1/reviews/booking/:bookingId` | Authenticated | Get review for a booking |
| `GET` | `/api/v1/reviews/spot/:spotId` | Public | List reviews for a spot |
| `GET` | `/api/v1/reviews/author/:authorId` | Public/internal | List reviews by author |
| `GET` | `/api/v1/reviews/stats/spot/:spotId` | Public | Get spot review statistics |

## Access

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/access/:id/unlock` | Authenticated | Attempt to unlock access for a confirmed booking |

## Metrics

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/metrics` | Internal/observability | Prometheus metrics endpoint |
