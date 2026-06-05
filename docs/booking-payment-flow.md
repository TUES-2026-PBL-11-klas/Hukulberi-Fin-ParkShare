# Booking and Payment Flow

```mermaid
sequenceDiagram
  actor Driver
  participant Frontend as Next.js frontend
  participant Bookings as Bookings API
  participant Payments as Payments API
  participant Stripe as Stripe Checkout
  participant Webhook as Stripe webhook
  participant DB as PostgreSQL

  Driver->>Frontend: Select spot, day, and time
  Frontend->>Bookings: POST /api/v1/bookings
  Bookings->>DB: Check availability, capacity, active reservations
  DB-->>Bookings: Available
  Bookings->>DB: Create booking HOLD
  Bookings-->>Frontend: Booking id
  Frontend->>Payments: POST /api/v1/payments/checkout-sessions
  Payments->>Stripe: Create Checkout Session
  Stripe-->>Payments: Checkout URL
  Payments->>DB: Store payment CREATED
  Payments-->>Frontend: Redirect URL
  Frontend->>Stripe: Redirect driver to payment
  Stripe-->>Frontend: Return success URL
  Stripe->>Webhook: checkout.session.completed
  Webhook->>DB: Mark webhook PENDING
  Webhook->>DB: Mark payment SUCCEEDED
  Webhook->>DB: Confirm booking
  Webhook->>DB: Mark webhook PROCESSED
```

## Summary

The frontend never decides payment state. Stripe returns the user to the app, but the webhook is the source of truth that confirms payment and booking status.
