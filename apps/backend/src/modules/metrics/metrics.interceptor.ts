import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.originalUrl.startsWith('/metrics')) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = process.hrtime.bigint();
    let statusCode = 200;

    return next.handle().pipe(
      catchError((error: unknown) => {
        statusCode = this.getStatusCode(error);
        this.metrics.recordHttpRequest({
          durationSeconds: this.elapsedSeconds(startedAt),
          method: request.method,
          outcome: 'error',
          route: this.getRoute(request),
          statusCode,
        });

        return throwError(() => error);
      }),
      finalize(() => {
        if (statusCode < 400) {
          statusCode = response.statusCode || statusCode;
          this.metrics.recordHttpRequest({
            durationSeconds: this.elapsedSeconds(startedAt),
            method: request.method,
            outcome: 'success',
            route: this.getRoute(request),
            statusCode,
          });
        }
      }),
    );
  }

  private getRoute(request: Request): string {
    const baseUrl = request.baseUrl ?? '';
    return `${baseUrl}${request.path}`;
  }

  private getStatusCode(error: unknown): number {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    return 500;
  }

  private elapsedSeconds(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  }
}
