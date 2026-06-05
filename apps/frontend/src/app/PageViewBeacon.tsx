"use client";

import { useEffect } from 'react';
import { recordFrontendEvent } from '../lib/frontend-metrics';

type PageViewBeaconProps = {
  page: string;
};

export default function PageViewBeacon({ page }: PageViewBeaconProps) {
  useEffect(() => {
    void recordFrontendEvent('page_view', page);
  }, [page]);

  return null;
}