import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  async getMetrics(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Content-Type', this.metrics.getMetricsContentType());
    return this.metrics.getMetricsText();
  }
}
