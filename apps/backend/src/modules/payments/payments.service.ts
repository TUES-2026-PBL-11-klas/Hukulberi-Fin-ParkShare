import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  PaymentProviderType,
  PaymentStatus,
  Prisma,
  WebhookProcessingStatus,
} from '@prisma/client';
import {
  CreateCheckoutSessionRequestDto,
  CreateCheckoutSessionResponseDto,
  StripeWebhookResponseDto,
} from '@parkshare/contracts';
import {
  StripeClientService,
  StripeWebhookEvent,
  StripeWebhookObject,
} from './stripe-client.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CURRENCY = 'bgn';
const DEFAULT_PAYMENT_NAME = 'ParkShare parking reservation';

interface CreateCheckoutSessionInput extends CreateCheckoutSessionRequestDto {
  userId: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeClient: StripeClientService,
  ) {}

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResponseDto> {
    const amount = this.normalizeAmount(input.amount);
    const currency = this.normalizeCurrency(input.currency);
    const name = input.name?.trim() || DEFAULT_PAYMENT_NAME;
    const successUrl = this.defaultUrl(input.successUrl, 'payment/success');
    const cancelUrl = this.defaultUrl(input.cancelUrl, 'payment/cancel');

    const payment = await this.prisma.payment.create({
      data: {
        amount,
        bookingId: input.bookingId,
        currency,
        driverUserId: input.userId,
        provider: PaymentProviderType.STRIPE,
        status: PaymentStatus.CREATED,
      },
    });

    const session = await this.stripeClient.createCheckoutSession({
      amount,
      cancelUrl,
      currency,
      metadata: {
        paymentId: payment.id,
        userId: input.userId,
        ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      },
      name,
      successUrl,
    });

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe did not return a Checkout URL',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerCheckoutSessionId: session.id,
        providerPaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : undefined,
      },
    });

    return {
      paymentId: payment.id,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
    };
  }

  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<StripeWebhookResponseDto> {
    const event = this.stripeClient.constructWebhookEvent(rawBody, signature);
    const existingEvent = await this.prisma.paymentWebhookEvent.findUnique({
      where: { providerEventId: event.id },
    });

    if (existingEvent) {
      return {
        duplicate: true,
        eventId: event.id,
        received: true,
      };
    }

    const paymentId = this.extractPaymentId(event);

    await this.prisma.paymentWebhookEvent.create({
      data: {
        eventType: event.type,
        paymentId,
        processingStatus: WebhookProcessingStatus.PROCESSED,
        provider: PaymentProviderType.STRIPE,
        providerEventId: event.id,
        processedAt: new Date(),
        rawJson: this.toJson(event),
      },
    });

    await this.applyWebhookToPayment(event);

    return {
      duplicate: false,
      eventId: event.id,
      received: true,
    };
  }

  private async applyWebhookToPayment(
    event: StripeWebhookEvent,
  ): Promise<void> {
    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.expired' &&
      event.type !== 'payment_intent.payment_failed'
    ) {
      return;
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      await this.prisma.payment.updateMany({
        where: { providerPaymentIntentId: paymentIntent.id },
        data: { status: PaymentStatus.FAILED },
      });
      return;
    }

    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      return;
    }

    await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        providerCheckoutSessionId: session.id,
      },
      data: {
        providerPaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : undefined,
        status:
          event.type === 'checkout.session.completed'
            ? PaymentStatus.SUCCEEDED
            : PaymentStatus.CANCELED,
      },
    });
  }

  private extractPaymentId(event: StripeWebhookEvent): string | undefined {
    const object = event.data.object;

    if (this.hasPaymentMetadata(object)) {
      return object.metadata.paymentId;
    }

    return undefined;
  }

  private normalizeAmount(amount: number): number {
    if (!Number.isInteger(amount) || amount < 50) {
      throw new BadRequestException(
        'Amount must be an integer in minor currency units and at least 50',
      );
    }

    return amount;
  }

  private normalizeCurrency(currency?: string): string {
    const normalizedCurrency = (currency ?? DEFAULT_CURRENCY)
      .trim()
      .toLowerCase();

    if (!/^[a-z]{3}$/.test(normalizedCurrency)) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }

    return normalizedCurrency;
  }

  private defaultUrl(url: string | undefined, path: string): string {
    if (url) {
      return url;
    }

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
    return `${frontendOrigin}/${path}`;
  }

  private hasPaymentMetadata(
    object: StripeWebhookObject,
  ): object is StripeWebhookObject & { metadata: { paymentId: string } } {
    return typeof object.metadata?.paymentId === 'string';
  }

  private toJson(event: StripeWebhookEvent): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;
  }
}
