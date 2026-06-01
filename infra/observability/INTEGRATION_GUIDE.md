# Prometheus Metrics Integration Guide

This guide explains how to integrate Prometheus metrics into the ParkShare backend and frontend.

## Backend (NestJS + prom-client)

### 1. Install Dependencies

```bash
npm install prom-client @nestjs/prometheus
```

### 2. Set Up Metrics Module

Create `src/modules/metrics/metrics.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@nestjs/prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },  // Auto-collect Node.js/process metrics
      path: '/metrics',                    // Prometheus scrape endpoint
      defaultLabels: {
        service: 'parkshare-api',
      },
    }),
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
```

### 3. Import in App Module

```typescript
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    MetricsModule,  // Add early
    AuthModule,
    BookingsModule,
    PaymentsModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 4. Create Metrics in Your Service

Example: `src/modules/payments/payments.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class PaymentsService {
  private checkoutCreated: Counter;
  private processingDuration: Histogram;
  private webhookErrors: Counter;

  constructor() {
    // Counter: checkouts initiated
    this.checkoutCreated = new Counter({
      name: 'parkshare_payments_checkout_created_total',
      help: 'Total Stripe checkout sessions created',
      labelNames: ['provider', 'currency'],
      registers: [register],
    });

    // Histogram: payment processing time
    this.processingDuration = new Histogram({
      name: 'parkshare_payments_processing_duration_seconds',
      help: 'Payment processing duration in seconds',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    // Counter: webhook errors
    this.webhookErrors = new Counter({
      name: 'parkshare_payments_webhook_processed_total',
      help: 'Total webhooks processed',
      labelNames: ['status', 'event_type'],
      registers: [register],
    });
  }

  async createCheckout(bookingId: string, amount: number, currency: string) {
    const startTime = Date.now();

    try {
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: /* ... */ }],
        mode: 'payment',
        success_url: /* ... */,
        cancel_url: /* ... */,
      });

      // Record metric
      this.checkoutCreated.inc({
        provider: 'stripe',
        currency,
      });

      const duration = (Date.now() - startTime) / 1000;
      this.processingDuration.observe({ status: 'success' }, duration);

      return session;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.processingDuration.observe({ status: 'error' }, duration);
      throw error;
    }
  }

  async handleWebhook(event: Stripe.Event) {
    try {
      // Process webhook
      this.webhookErrors.inc({
        status: 'success',
        event_type: event.type,
      });
      return { received: true };
    } catch (error) {
      this.webhookErrors.inc({
        status: 'failed',
        event_type: event.type,
      });
      throw error;
    }
  }
}
```

### 5. Use Metrics in Other Modules

Example: `src/modules/bookings/bookings.service.ts`

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PROMETHEUS_REGISTRY } from '@nestjs/prometheus';
import { Registry, Counter, Gauge } from 'prom-client';

@Injectable()
export class BookingsService {
  private bookingsCreated: Counter;
  private bookingsActive: Gauge;

  constructor(@Inject(PROMETHEUS_REGISTRY) private prometheusRegistry: Registry) {
    this.bookingsCreated = new Counter({
      name: 'parkshare_bookings_created_total',
      help: 'Total bookings created',
      labelNames: ['status'],
      registers: [this.prometheusRegistry],
    });

    this.bookingsActive = new Gauge({
      name: 'parkshare_bookings_active_total',
      help: 'Currently active bookings',
      registers: [this.prometheusRegistry],
    });
  }

  async createBooking(spotId: string, userId: string) {
    try {
      const booking = await this.prisma.booking.create({
        data: { spotId, userId, status: 'HOLD' },
      });

      this.bookingsCreated.inc({ status: 'confirmed' });
      this.updateActiveBookings();

      return booking;
    } catch (error) {
      this.bookingsCreated.inc({ status: 'failed' });
      throw error;
    }
  }

  private async updateActiveBookings() {
    const count = await this.prisma.booking.count({
      where: { status: { in: ['HOLD', 'CONFIRMED'] } },
    });
    this.bookingsActive.set(count);
  }
}
```

---

## Frontend (Next.js - Optional)

If you want to expose basic metrics from the frontend:

### 1. Install prom-client

```bash
npm install prom-client
```

### 2. Create a Metrics API Route

`src/app/api/metrics/route.ts`:

```typescript
import { register, Counter, Gauge } from 'prom-client';
import { NextRequest, NextResponse } from 'next/server';

// Global instance (reused across requests)
export const pageViews = new Counter({
  name: 'parkshare_frontend_page_views_total',
  help: 'Total page views',
  labelNames: ['page'],
});

export const checkoutAttempts = new Counter({
  name: 'parkshare_frontend_checkout_attempts_total',
  help: 'Total checkout button clicks',
  labelNames: ['step'],  // checkout_start, payment_submission, etc.
});

export async function GET(req: NextRequest) {
  const metrics = await register.metrics();
  return new NextResponse(metrics, {
    headers: { 'Content-Type': register.contentType },
  });
}
```

### 3. Track Events

In your React components:

```typescript
// pages/checkout.tsx
import { checkoutAttempts } from '@/app/api/metrics/route';

export default function CheckoutPage() {
  const handlePaymentSubmit = () => {
    checkoutAttempts.inc({ step: 'payment_submission' });
    // Submit payment...
  };

  return (
    <button onClick={handlePaymentSubmit}>
      Complete Payment
    </button>
  );
}
```

---

## Docker Compose Setup

Add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./infra/observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - ./infra/observability/prometheus/recording_rules.yml:/etc/prometheus/recording_rules.yml
    - ./infra/observability/prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'

grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    GF_SECURITY_ADMIN_PASSWORD: admin
    GF_PROVISIONING_DASHBOARDS_ENABLED: 'true'
  volumes:
    - ./infra/observability/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources
    - ./infra/observability/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards
    - ./infra/observability/dashboards:/etc/grafana/provisioning/dashboards/json
  depends_on:
    - prometheus
```

Then start:

```bash
docker-compose up prometheus grafana
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

---

## Verifying Metrics

### 1. Check Backend Metrics Endpoint

```bash
curl http://localhost:3000/metrics | grep parkshare_
```

Expected output:
```
# HELP parkshare_payments_checkout_created_total Total Stripe checkouts created
# TYPE parkshare_payments_checkout_created_total counter
parkshare_payments_checkout_created_total{provider="stripe",currency="usd"} 5
```

### 2. Query in Prometheus

1. Open http://localhost:9090
2. Go to **Graph** tab
3. Enter query: `parkshare_payments_checkout_created_total`
4. Click **Execute**

### 3. Check Grafana

1. Open http://localhost:3001
2. Go to **Dashboards** → **Payments Module**
3. Verify panels populate with data

---

## Common Patterns

### Rate Limiting Metrics

```typescript
private requestsPerSecond = new Gauge({
  name: 'parkshare_api_rate_limit_remaining',
  help: 'Remaining rate limit for user',
  labelNames: ['user_id'],
});

// In middleware
app.use((req, res, next) => {
  const remaining = rateLimit.getRemainingForUser(req.user.id);
  this.requestsPerSecond.set({ user_id: req.user.id }, remaining);
  next();
});
```

### Database Query Metrics

```typescript
private dbDuration = new Histogram({
  name: 'parkshare_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Wrap Prisma queries
const start = Date.now();
const result = await prisma.booking.findMany();
const duration = (Date.now() - start) / 1000;
this.dbDuration.observe({ query_type: 'findMany', table: 'booking' }, duration);
```

### Business Logic Metrics

```typescript
private bookingStatus = new Counter({
  name: 'parkshare_bookings_status_change_total',
  help: 'Booking status transitions',
  labelNames: ['from_status', 'to_status'],
});

// In business logic
await booking.update({ status: 'CONFIRMED' });
this.bookingStatus.inc({
  from_status: 'HOLD',
  to_status: 'CONFIRMED',
});
```

---

## Troubleshooting

### Metrics Not Appearing in Prometheus

1. Check backend logs: `curl http://localhost:3000/metrics`
2. Verify `prometheus.yml` scrape config targets the correct service
3. Ensure metrics registry is injected properly

### High Cardinality Errors

❌ **Problem**: Creating metrics with user IDs as labels:
```typescript
this.metric.inc({ user_id: userId });  // Millions of unique values
```

✅ **Solution**: Use low-cardinality labels or aggregate server-side:
```typescript
this.userActivityTotal.inc();  // Just count total
// Then query: increase(parkshare_user_activity_total[1h])
```

### Duplicate Metrics Error

**Problem**: Registering same metric twice

```typescript
// Wrong: Registers metric twice on each instantiation
constructor() {
  this.counter = new Counter({ name: 'my_metric' });
  this.counter = new Counter({ name: 'my_metric' });  // Error!
}
```

**Solution**: Register once per metric globally or use a factory pattern

---

## Next Steps

- Add metrics to `Bookings` module (booking creation, expiry)
- Add metrics to `Access` module (unlock attempts, success rate)
- Add metrics to `Marketplace` module (spot creation, searches)
- Create dashboard for each module (see `/infra/observability/dashboards/`)
