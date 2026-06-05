export async function recordFrontendEvent(
  event: string,
  page: string,
): Promise<void> {
  try {
    await fetch('/api/metrics', {
      body: JSON.stringify({ event, page }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      keepalive: true,
    });
  } catch {
    // Metrics should never break the user flow.
  }
}