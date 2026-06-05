import {
  Counter,
  collectDefaultMetrics,
  register,
} from 'prom-client';

let initialized = false;

const pageViewsTotal = getOrCreateCounter(
  'parkshare_frontend_page_views_total',
  'Total frontend page views',
  ['page'],
);

const interactionsTotal = getOrCreateCounter(
  'parkshare_frontend_interactions_total',
  'Total frontend tracked interactions',
  ['event', 'page'],
);

function ensureInitialized() {
  if (initialized) {
    return;
  }

  collectDefaultMetrics({ register });
  initialized = true;
}

function getOrCreateCounter(
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

export function recordFrontendPageView(page: string) {
  ensureInitialized();
  pageViewsTotal.inc({ page: normalizeLabel(page) });
}

export function recordFrontendInteraction(event: string, page: string) {
  ensureInitialized();
  interactionsTotal.inc({
    event: normalizeLabel(event),
    page: normalizeLabel(page),
  });
}

export function getFrontendMetricsText(): Promise<string> {
  ensureInitialized();
  return register.metrics();
}

export function getFrontendMetricsContentType(): string {
  ensureInitialized();
  return register.contentType;
}

function normalizeLabel(value: string): string {
  const normalized = value.trim().toLowerCase();

  return normalized.length > 0 ? normalized : 'unknown';
}