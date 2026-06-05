# Database Diagram

```mermaid
erDiagram
  User {
    uuid id PK
    string email UK
    string name
    string passwordHash
    UserRole role
    UserStatus status
    timestamptz createdAt
    timestamptz updatedAt
  }

  Spot {
    uuid id PK
    uuid hostUserId FK
    string title
    string address
    float latitude
    float longitude
    int pricePerHour
    int spaceCount
    json availableDays
    string availableFrom
    string availableUntil
    json photoUrls
    SpotVerificationStatus verificationStatus
    boolean isActive
  }

  Booking {
    uuid id PK
    uuid spotId FK
    string spotLabel
    uuid driverUserId FK
    BookingStatus status
    int amount
    string currency
    timestamptz startAt
    timestamptz endAt
    timestamptz expiresAt
  }

  Payment {
    uuid id PK
    uuid bookingId FK
    uuid driverUserId FK
    PaymentProviderType provider
    PaymentStatus status
    string providerCheckoutSessionId UK
    string providerPaymentIntentId
    int amount
    string currency
  }

  PaymentWebhookEvent {
    uuid id PK
    string providerEventId UK
    uuid paymentId FK
    string eventType
    WebhookProcessingStatus processingStatus
    json rawJson
  }

  Review {
    uuid id PK
    uuid bookingId FK
    uuid authorId FK
    uuid spotId FK
    ReviewRating rating
    string comment
  }

  AccessEvent {
    uuid id PK
    uuid bookingId FK
    uuid userId FK
    string gateId
    AccessEventStatus status
    string reason
  }

  User ||--o{ Spot : hosts
  User ||--o{ Booking : reserves
  User ||--o{ Payment : pays
  User ||--o{ Review : writes
  User ||--o{ AccessEvent : triggers
  Spot ||--o{ Booking : receives
  Spot ||--o{ Review : has
  Booking ||--o{ Payment : paid_by
  Booking ||--o| Review : reviewed_by
  Booking ||--o{ AccessEvent : grants
  Payment ||--o{ PaymentWebhookEvent : receives
```

## Summary

The database centers on users, spots, bookings, and payments. Spots are created by hosts, verified by admins, reserved by drivers, paid through Stripe, and reviewed after completed bookings.
