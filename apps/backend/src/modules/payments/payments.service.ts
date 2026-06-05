import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentProviderType,
  PaymentStatus,
  Prisma,
  WebhookProcessingStatus,
} from '@prisma/client';
import {
  CreateCheckoutSessionRequestDto,
  CreateCheckoutSessionResponseDto,
  ReconcileCheckoutSessionResponseDto,
  type BookingDto,
  StripeWebhookResponseDto,
} from '@parkshare/contracts';
import {
  StripeClientService,
  StripeWebhookEvent,
  StripeWebhookObject,
} from './stripe-client.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAYMENT_NAME = 'ParkShare parking reservation';

interface CreateCheckoutSessionInput extends CreateCheckoutSessionRequestDto {
  userId: string;
}

interface ReconcileCheckoutSessionInput {
  checkoutSessionId: string;
  userId: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeClient: StripeClientService,
    private readonly metrics: MetricsService = new MetricsService(),
  ) {}

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResponseDto> {
    const booking = await this.requireBookingForCheckout(
      input.userId,
      input.bookingId,
    );
    const existingSucceededPayment = await this.prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        driverUserId: input.userId,
        status: PaymentStatus.SUCCEEDED,
      },
    });

    if (existingSucceededPayment) {
      throw new BadRequestException('Reservation is already paid for');
    }

    const amount = booking.amount;
    const currency = booking.currency.toLowerCase();
    const name = `${DEFAULT_PAYMENT_NAME} · ${booking.spotLabel}`;
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

    this.metrics.recordPaymentCheckoutCreated();

    let session: Awaited<
      ReturnType<StripeClientService['createCheckoutSession']>
    >;

    try {
      session = await this.stripeClient.createCheckoutSession({
        amount,
        cancelUrl,
        currency,
        metadata: {
          paymentId: payment.id,
          userId: input.userId,
          bookingId: booking.id,
        },
        name,
        successUrl,
      });
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      this.metrics.recordPaymentCheckoutFailed();
      throw error;
    }

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
    let event: StripeWebhookEvent;

    try {
      event = this.stripeClient.constructWebhookEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const existingEvent = await this.prisma.paymentWebhookEvent.findUnique({
      where: { providerEventId: event.id },
    });

    if (existingEvent?.processingStatus === WebhookProcessingStatus.PROCESSED) {
      this.metrics.recordPaymentWebhookProcessed('duplicate', event.type);
      return {
        duplicate: true,
        eventId: event.id,
        received: true,
      };
    }

    const paymentId = this.extractPaymentId(event);

    const webhookEvent = existingEvent
      ? await this.prisma.paymentWebhookEvent.update({
          where: { providerEventId: event.id },
          data: {
            paymentId,
            processingStatus: WebhookProcessingStatus.PENDING,
            rawJson: this.toJson(event),
          },
        })
      : await this.prisma.paymentWebhookEvent.create({
          data: {
            eventType: event.type,
            paymentId,
            processingStatus: WebhookProcessingStatus.PENDING,
            provider: PaymentProviderType.STRIPE,
            providerEventId: event.id,
            rawJson: this.toJson(event),
          },
        });

    try {
      await this.applyWebhookToPayment(event);
      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processingStatus: WebhookProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });
      this.metrics.recordPaymentWebhookProcessed('processed', event.type);
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processingStatus: WebhookProcessingStatus.FAILED,
          processedAt: null,
        },
      });
      this.metrics.recordPaymentWebhookProcessed('failed', event.type);
      throw error;
    }

    return {
      duplicate: false,
      eventId: event.id,
      received: true,
    };
  }

  async reconcileCheckoutSession(
    input: ReconcileCheckoutSessionInput,
  ): Promise<ReconcileCheckoutSessionResponseDto> {
    const session = await this.stripeClient.retrieveCheckoutSession(
      input.checkoutSessionId,
    );

    if (session.payment_status !== 'paid') {
      return { confirmed: false };
    }

    const paymentId = session.metadata?.paymentId;
    const bookingId = session.metadata?.bookingId;

    if (!paymentId || !bookingId || session.metadata?.userId !== input.userId) {
      throw new UnauthorizedException(
        'Checkout session does not belong to this user',
      );
    }

    const confirmed = await this.markPaidSessionSucceeded(
      session,
      input.userId,
    );
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    return {
      booking: booking ? this.toBookingDto(booking) : undefined,
      confirmed,
      paymentId,
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

    if (!session.metadata?.paymentId) {
      return;
    }

    if (event.type === 'checkout.session.completed') {
      await this.markPaidSessionSucceeded(session);
      return;
    }

    await this.prisma.payment.updateMany({
      where: {
        id: session.metadata.paymentId,
        providerCheckoutSessionId: session.id,
      },
      data: { status: PaymentStatus.CANCELED },
    });
  }

  private extractPaymentId(event: StripeWebhookEvent): string | undefined {
    const object = event.data.object;

    if (this.hasPaymentMetadata(object)) {
      return object.metadata.paymentId;
    }

    return undefined;
  }

  private defaultUrl(url: string | undefined, path: string): string {
    if (url) {
      return url;
    }

    const frontendOrigin =
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
    return `${frontendOrigin}/${path}`;
  }

  private async confirmBookingFromSession(
    session: StripeWebhookObject,
  ): Promise<boolean> {
    const bookingId = session.metadata?.bookingId;
    const userId = session.metadata?.userId;

    if (!bookingId || !userId) {
      return false;
    }

    try {
      const updated = await this.prisma.booking.updateMany({
        where: {
          driverUserId: userId,
          id: bookingId,
          status: { in: [BookingStatus.HOLD, BookingStatus.EXPIRED] },
        },
        data: {
          status: BookingStatus.CONFIRMED,
        },
      });

      if (updated?.count > 0) {
        return true;
      }
    } catch (error) {
      if (!this.isActiveBookingOverlapError(error)) {
        throw error;
      }
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });

    return booking?.status === BookingStatus.CONFIRMED;
  }

  private async markPaidSessionSucceeded(
    session: StripeWebhookObject,
    userId?: string,
  ): Promise<boolean> {
    const paymentId = session.metadata?.paymentId;

    if (!paymentId) {
      return false;
    }

    const paymentUpdate = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        providerCheckoutSessionId: session.id,
        ...(userId ? { driverUserId: userId } : {}),
      },
      data: {
        providerPaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : undefined,
        status: PaymentStatus.SUCCEEDED,
      },
    });

    if (paymentUpdate.count === 0) {
      return false;
    }

    return this.confirmBookingFromSession(session);
  }

  private isActiveBookingOverlapError(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2004'
    ) {
      return false;
    }

    return error.message.includes('bookings_no_active_overlap');
  }

  private toBookingDto(booking: {
    id: string;
    spotId: string;
    spotLabel: string;
    driverUserId: string;
    status: BookingStatus;
    amount: number;
    currency: string;
    startAt: Date;
    endAt: Date;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): BookingDto {
    return {
      id: booking.id,
      spotId: booking.spotId,
      spotLabel: booking.spotLabel,
      driverUserId: booking.driverUserId,
      status: booking.status as BookingDto['status'],
      amount: booking.amount,
      currency: booking.currency,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      expiresAt: booking.expiresAt.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  private async requireBookingForCheckout(userId: string, bookingId?: string) {
    if (!bookingId) {
      throw new BadRequestException('bookingId is required for checkout');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new BadRequestException('Booking was not found');
    }

    if (booking.driverUserId !== userId) {
      throw new UnauthorizedException('Booking does not belong to this user');
    }

    if (booking.status !== BookingStatus.HOLD) {
      throw new BadRequestException('Only held bookings can be paid for');
    }

    if (booking.expiresAt <= new Date()) {
      throw new BadRequestException('Booking hold has expired');
    }

    return booking;
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
