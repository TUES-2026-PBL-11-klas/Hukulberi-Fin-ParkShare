import { Injectable, OnModuleInit } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register,
} from 'prom-client';

type HttpOutcome = 'success' | 'error';
type PaymentWebhookOutcome = 'processed' | 'failed' | 'duplicate';

@Injectable()
export class MetricsService implements OnModuleInit {
  private static defaultMetricsRegistered = false;

  private readonly httpRequestsTotal = this.getOrCreateCounter(
    'parkshare_http_requests_total',
    'Total HTTP requests handled by ParkShare',
    ['method', 'route', 'status'],
  );

  private readonly httpRequestErrorsTotal = this.getOrCreateCounter(
    'parkshare_http_request_errors_total',
    'Total HTTP request errors handled by ParkShare',
    ['method', 'route', 'status'],
  );

  private readonly httpRequestDuration = this.getOrCreateHistogram(
    'parkshare_http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'route', 'status'],
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  );

  private readonly bookingsCreatedTotal = this.getOrCreateCounter(
    'parkshare_bookings_created_total',
    'Total bookings created by status',
    ['status'],
  );

  private readonly bookingsCanceledTotal = this.getOrCreateCounter(
    'parkshare_bookings_canceled_total',
    'Total bookings canceled by the driver',
    [],
  );

  private readonly bookingsExpiredTotal = this.getOrCreateCounter(
    'parkshare_bookings_expired_total',
    'Total booking holds expired automatically',
    [],
  );

  private readonly paymentsCheckoutCreatedTotal = this.getOrCreateCounter(
    'parkshare_payments_checkout_created_total',
    'Total Stripe checkout sessions created',
    [],
  );

  private readonly paymentsCheckoutFailedTotal = this.getOrCreateCounter(
    'parkshare_payments_checkout_failed_total',
    'Total Stripe checkout session creation failures',
    [],
  );

  private readonly paymentsWebhookProcessedTotal = this.getOrCreateCounter(
    'parkshare_payments_webhook_processed_total',
    'Total Stripe webhooks handled by status',
    ['status', 'event_type'],
  );

  onModuleInit() {
    this.ensureDefaultMetrics();
  }

  getMetricsText(): Promise<string> {
    this.ensureDefaultMetrics();
    return register.metrics();
  }

  getMetricsContentType(): string {
    this.ensureDefaultMetrics();
    return register.contentType;
  }

  recordHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationSeconds: number;
    outcome: HttpOutcome;
  }) {
    const labels = {
      method: this.normalizeLabel(input.method),
      route: this.normalizeLabel(input.route),
      status: String(input.statusCode),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, input.durationSeconds);

    if (input.outcome === 'error' || input.statusCode >= 500) {
      this.httpRequestErrorsTotal.inc(labels);
    }
  }

  recordBookingCreated(status: BookingStatus) {
    this.bookingsCreatedTotal.inc({ status: status.toLowerCase() });
  }

  recordBookingCanceled() {
    this.bookingsCanceledTotal.inc();
  }

  recordBookingExpired(expiredCount = 1) {
    this.bookingsExpiredTotal.inc(expiredCount);
  }

  recordPaymentCheckoutCreated() {
    this.paymentsCheckoutCreatedTotal.inc();
  }

  recordPaymentCheckoutFailed() {
    this.paymentsCheckoutFailedTotal.inc();
  }

  recordPaymentWebhookProcessed(
    status: PaymentWebhookOutcome,
    eventType: string,
  ) {
    this.paymentsWebhookProcessedTotal.inc({
      event_type: this.normalizeLabel(eventType),
      status,
    });
  }

  private ensureDefaultMetrics() {
    if (MetricsService.defaultMetricsRegistered) {
      return;
    }

    collectDefaultMetrics({ register });
    MetricsService.defaultMetricsRegistered = true;
  }

  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames: string[],
  ): Counter<string> {
    const existing = register.getSingleMetric(name);

    if (existing) {
      return existing as Counter<string>;
    }

    return new Counter({
      name,
      help,
      labelNames,
      registers: [register],
    });
  }

  private getOrCreateHistogram(
    name: string,
    help: string,
    labelNames: string[],
    buckets: number[],
  ): Histogram<string> {
    const existing = register.getSingleMetric(name);

    if (existing) {
      return existing as Histogram<string>;
    }

    return new Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [register],
    });
  }

  private normalizeLabel(value: string): string {
    const normalized = value.trim().toLowerCase();

    return normalized.length > 0 ? normalized : 'unknown';
  }
}
