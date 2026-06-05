import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateCheckoutSessionRequestDto,
  CreateCheckoutSessionResponseDto,
  ReconcileCheckoutSessionResponseDto,
  StripeWebhookResponseDto,
} from '@parkshare/contracts';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller('api/v1')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments/checkout-sessions')
  @UseGuards(JwtAuthGuard)
  createCheckoutSession(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateCheckoutSessionRequestDto,
  ): Promise<CreateCheckoutSessionResponseDto> {
    if (!request.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    return this.paymentsService.createCheckoutSession({
      ...body,
      userId: request.user.id,
    });
  }

  @Post('payments/checkout-sessions/:checkoutSessionId/reconcile')
  @UseGuards(JwtAuthGuard)
  reconcileCheckoutSession(
    @Req() request: AuthenticatedRequest,
    @Param('checkoutSessionId') checkoutSessionId: string,
  ): Promise<ReconcileCheckoutSessionResponseDto> {
    if (!request.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    return this.paymentsService.reconcileCheckoutSession({
      checkoutSessionId,
      userId: request.user.id,
    });
  }

  @Post('webhooks/stripe')
  handleStripeWebhook(
    @Req() request: RawBodyRequest,
  ): Promise<StripeWebhookResponseDto> {
    const signature = request.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      throw new BadRequestException('Stripe signature header is missing');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Raw request body is missing');
    }

    return this.paymentsService.handleStripeWebhook(request.rawBody, signature);
  }
}
