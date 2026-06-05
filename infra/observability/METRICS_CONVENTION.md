# ParkShare Metrics Naming Convention

This guide establishes a consistent approach to naming metrics across the ParkShare platform. Following this convention ensures:
- **Consistency**: Easy to discover and understand metrics across services
- **Queryability**: Dashboards and alerts can be built predictably
- **Scalability**: New metrics fit naturally into the existing scheme
- **Cross-team collaboration**: Everyone instruments code the same way

## Naming Pattern

### Base Format
```
parkshare_<module>_<entity>_<metric>_<unit>
```

### Components

#### 1. Prefix: `parkshare_`
All custom metrics start with `parkshare_` to distinguish them from infrastructure metrics (node_*, process_*, etc.)

#### 2. Module: `<module>`
The NestJS module that emits the metric. Use the module name as it appears in the codebase:
- `payments` - Stripe/payment processing
- `bookings` - Booking/reservation management
- `access` - Smart gate/access control
- `marketplace` or `spots` - Marketplace/spot listings
- `reviews` - User reviews
- `users` - User management and authentication
- `auth` - Authentication flows
- `http` - HTTP/API-level metrics (for common API metrics)
- `db` - Database-level metrics (for connection pools, query performance)

#### 3. Entity: `<entity>`
The primary entity or resource being measured. Examples:
- `checkout` - Stripe checkout session
- `webhook` - Webhook event
- `booking` - Booking/reservation
- `unlock` - Gate unlock attempt
- `spot` or `listing` - Parking spot
- `review` - User review
- `request` - HTTP request
- `connection` - DB connection
- `query` - Database query

#### 4. Metric: `<metric>`
The type of measurement. Common values:
- `created` - Resource created (counter)
- `completed` - Task completed successfully (counter)
- `failed` - Task failed (counter)
- `active` - Current active/in-progress items (gauge)
- `total` - Total count (counter or gauge)
- `duration` - How long something took (histogram)
- `size` or `bytes` - Size of something (histogram/gauge)
- `rate` - Rate of something (counter, compute rate via query)
- `error` - Error occurred (counter)

#### 5. Unit: `<unit>`
The unit of measurement. Include this to clarify what you're measuring:
- `total` - A count (unitless)
- `seconds` - Duration in seconds (use with histograms)
- `bytes` - Size in bytes
- `percentage` - Percentage value (0-100 or 0-1)
- Omit for unitless counters

---

## Metric Types & Examples

### Counters (monotonically increasing values)
Used for: request counts, errors, events completed

**Format:** `parkshare_<module>_<entity>_<metric>_total`

**Examples:**
```
parkshare_payments_checkout_created_total        # Checkouts initiated
parkshare_payments_webhook_processed_total       # Webhooks processed (label: status=success/failed)
parkshare_bookings_created_total                 # Bookings created (label: status=confirmed/cancelled)
parkshare_bookings_expired_total                 # Bookings expired
parkshare_access_unlock_attempts_total           # Unlock attempts (label: status=success/failed/denied)
parkshare_marketplace_spots_created_total        # Spots created
parkshare_marketplace_reviews_created_total      # Reviews written
http_requests_total                              # All HTTP requests (label: method, path, status)
```

### Gauges (point-in-time values)
Used for: current state, capacity, counts

**Format:** `parkshare_<module>_<entity>_<metric>` (no `_total` suffix)

**Examples:**
```
parkshare_bookings_active_total              # Currently active bookings
parkshare_marketplace_spots_active_total     # Currently active listings
parkshare_access_cooldown_remaining_seconds  # Remaining cooldown on gate unlock
db_connection_pool_size                      # Connection pool size
```

### Histograms (distribution of values)
Used for: latencies, request sizes, processing times

**Format:** `parkshare_<module>_<entity>_<metric>_<unit>` (Prometheus auto-appends `_bucket`, `_count`, `_sum`)

**Examples:**
```
parkshare_payments_processing_duration_seconds       # Histogram: payment processing time
parkshare_payments_webhook_payload_bytes             # Histogram: webhook payload size
http_request_duration_seconds                        # Histogram: HTTP request duration
parkshare_bookings_checkout_duration_seconds         # Histogram: checkout duration
```

### Info Metrics (metadata)
Used for: version, config, build info

**Format:** `parkshare_<module>_info` with label values for metadata

**Examples:**
```
parkshare_app_info{version="1.2.3", environment="prod"}  # App version/environment
```

---

## Label Convention

Labels provide dimensions to your metrics. Use lowercase labels with underscores.

### Common Labels

| Label | Values | Module | Example |
|-------|--------|--------|---------|
| `status` | success, failed, denied, cancelled, confirmed | all | `parkshare_access_unlock_attempts_total{status="failed"}` |
| `reason` | See module-specific | payments, bookings | `parkshare_payments_webhook_processed_total{reason="invalid_signature"}` |
| `method` | GET, POST, PUT, DELETE | http | `http_requests_total{method="POST"}` |
| `path` | /api/v1/bookings, /api/v1/payments | http | `http_requests_total{path="/api/v1/bookings"}` |
| `provider` | stripe, local, mock | payments, access | `parkshare_payments_checkout_created_total{provider="stripe"}` |
| `gate_id` | ID of gate | access | `parkshare_access_unlock_attempts_total{gate_id="gate_001"}` |
| `spot_id` | ID of spot | marketplace | `parkshare_marketplace_spots_active{spot_id="spot_123"}` |

### Label Cardinality
Keep label cardinality reasonable. High cardinality labels can cause performance issues:
- ✅ **Good**: `status=success|failed|denied` (3 values)
- ✅ **Good**: `method=GET|POST|PUT|DELETE` (4 values)
- ❌ **Bad**: `user_id=<any_uuid>` (millions of unique values!)
- ❌ **Bad**: `booking_id=<any_uuid>` (millions of unique values!)

For high-cardinality dimensions, use traces instead of metrics, or pre-aggregate in your application.

---

## Module-Specific Metrics

### Payments Module
```
parkshare_payments_checkout_created_total{provider="stripe"}
parkshare_payments_webhook_processed_total{status="success|failed", reason="..."}
parkshare_payments_webhook_payload_bytes (histogram)
parkshare_payments_processing_duration_seconds (histogram, status)
parkshare_payments_webhook_signature_failures_total
```

### Bookings Module
```
parkshare_bookings_created_total{status="confirmed|cancelled|hold"}
parkshare_bookings_active_total (gauge)
parkshare_bookings_expired_total
parkshare_bookings_overlap_detected_total  # Concurrency issues
parkshare_bookings_confirmation_duration_seconds (histogram)
```

### Access Module
```
parkshare_access_unlock_attempts_total{status="success|failed|denied", gate_id="..."}
parkshare_access_unlock_duration_seconds (histogram)
parkshare_access_cooldown_remaining_seconds{gate_id="..."} (gauge)
parkshare_access_event_audit_created_total
```

### Marketplace / Spots Module
```
parkshare_marketplace_spots_created_total
parkshare_marketplace_spots_active_total (gauge)
parkshare_marketplace_spots_search_duration_seconds (histogram)
parkshare_marketplace_spots_search_results_count (histogram)
```

### Reviews Module
```
parkshare_marketplace_reviews_created_total
parkshare_marketplace_reviews_rating_sum (counter, for rating calculation)
parkshare_marketplace_reviews_rating_count (counter, for rating calculation)
# Average rating calculated as: sum / count
```

### HTTP / API (Global)
```
http_requests_total{method="GET|POST|...", path="/api/v1/...", status="200|4xx|5xx"}
http_request_duration_seconds{method, path, status} (histogram)
http_request_size_bytes{method, path} (histogram)
http_response_size_bytes{method, path, status} (histogram)
```

### Database (Global)
```
pg_stat_activity_count (gauge, PostgreSQL exporter)
pg_settings_max_connections (gauge, PostgreSQL exporter)
db_connection_pool_size (gauge, driver-specific)
db_connection_pool_available (gauge, driver-specific)
parkshare_db:connection:pool:utilized (recording rule)
parkshare_db_query_slow_rate1m (recording rule)
```

---

## Implementation Guidelines

### In NestJS Backend (@nestjs/metrics or custom)

```typescript
// Example with prom-client (recommended for NestJS)
import { Counter, Histogram, Gauge } from 'prom-client';

const checkoutCreated = new Counter({
  name: 'parkshare_payments_checkout_created_total',
  help: 'Total checkouts initiated',
  labelNames: ['provider', 'status'],
});

const processingDuration = new Histogram({
  name: 'parkshare_payments_processing_duration_seconds',
  help: 'Payment processing time in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],  // Sensible defaults for payment processing
});

// Usage
checkoutCreated.inc({ provider: 'stripe', status: 'created' });
processingDuration.observe({ status: 'success' }, 1.5);
```

### Histogram Buckets (Latency Metrics)
Choose buckets based on your SLA/expectations:
- **Fast APIs (< 1s)**: `[0.01, 0.05, 0.1, 0.25, 0.5, 1]`
- **Standard APIs (1-10s)**: `[0.1, 0.5, 1, 2, 5, 10]`
- **Batch/async (> 10s)**: `[1, 5, 10, 30, 60, 120]`

---

## Recording Rules

Recording rules pre-compute complex queries. Define them in `prometheus/recording_rules.yml`:

```yaml
- record: parkshare:payments:processing:duration:p95
  expr: histogram_quantile(0.95, rate(parkshare_payments_processing_duration_seconds_bucket[5m]))

- record: parkshare:bookings:active:total
  expr: parkshare_bookings_active_total

- record: parkshare:access:unlock:success:rate1m
  expr: rate(parkshare_access_unlock_attempts_total{status="success"}[1m])
```

---

## Alert Rules

Alerts use metrics to trigger notifications (stored in `prometheus/alert_rules.yml`):

```yaml
- alert: HighPaymentFailureRate
  expr: rate(parkshare_payments_webhook_processed_total{status="failed"}[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High payment webhook failure rate"
```

---

## Checklist for New Metrics

Before instrumenting a new metric, verify:
- [ ] Metric name follows `parkshare_<module>_<entity>_<metric>_<unit>` pattern
- [ ] Metric type is appropriate (counter, gauge, histogram)
- [ ] Labels have low cardinality (< 100 unique combinations expected)
- [ ] Unit is explicit (or metric name indicates unitless counter)
- [ ] Metric is added to `prometheus/recording_rules.yml` if it's commonly queried
- [ ] Dashboard has a panel for this metric (or will be added)
- [ ] Alert rule created if this indicates a problem condition

---

## References

- [Prometheus Naming Best Practices](https://prometheus.io/docs/practices/naming/)
- [prom-client TypeScript Library](https://github.com/siimon/prom-client)
- [Grafana Dashboard Development](https://grafana.com/docs/grafana/latest/dashboards/)
