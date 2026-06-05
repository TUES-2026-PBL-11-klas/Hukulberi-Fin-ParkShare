import { NextRequest, NextResponse } from 'next/server';
import {
  getFrontendMetricsContentType,
  getFrontendMetricsText,
  recordFrontendInteraction,
  recordFrontendPageView,
} from '@/lib/metrics';

type FrontendMetricEvent = {
  event?: string;
  page?: string;
};

export const dynamic = 'force-dynamic';

export async function GET() {
  return new NextResponse(await getFrontendMetricsText(), {
    headers: {
      'Content-Type': getFrontendMetricsContentType(),
    },
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | FrontendMetricEvent
    | null;

  const event = payload?.event?.trim() || 'event';
  const page = payload?.page?.trim() || 'unknown';

  if (event === 'page_view') {
    recordFrontendPageView(page);
  } else {
    recordFrontendInteraction(event, page);
  }

  return NextResponse.json({ recorded: true });
}