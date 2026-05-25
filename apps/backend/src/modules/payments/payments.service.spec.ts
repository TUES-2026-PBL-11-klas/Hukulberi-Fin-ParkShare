import {
  BookingStatus,
  PaymentProviderType,
  PaymentStatus,
  WebhookProcessingStatus,
} from '@prisma/client';
import { PaymentsService } from './payments.service';
import { StripeClientService } from './stripe-client.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    payment: {
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    paymentWebhookEvent: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    booking: {
      updateMany: jest.Mock;
    };
  };
  let stripeClient: {
    createCheckoutSession: jest.Mock;
    constructWebhookEvent: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      payment: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      paymentWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      booking: {
        updateMany: jest.fn(),
      },
    };
    stripeClient = {
      createCheckoutSession: jest.fn(),
      constructWebhookEvent: jest.fn(),
    };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      stripeClient as unknown as StripeClientService,
    );
  });

  it('creates a Stripe Checkout Session and stores a local payment', async () => {
    prisma.payment.create.mockResolvedValue({
      id: 'payment-1',
      amount: 1200,
      currency: 'bgn',
    });
    stripeClient.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      payment_intent: 'pi_test_123',
    });
    prisma.payment.update.mockResolvedValue({
      id: 'payment-1',
      providerCheckoutSessionId: 'cs_test_123',
    });

    await expect(
      service.createCheckoutSession({
        userId: 'user-1',
        successUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      }),
    ).resolves.toEqual({
      paymentId: 'payment-1',
      checkoutSessionId: 'cs_test_123',
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        amount: 1200,
        bookingId: undefined,
        currency: 'eur',
        driverUserId: 'user-1',
        provider: PaymentProviderType.STRIPE,
        status: PaymentStatus.CREATED,
      },
    });
    expect(stripeClient.createCheckoutSession).toHaveBeenCalledWith({
      amount: 1200,
      cancelUrl: 'http://localhost:3000/payment/cancel',
      currency: 'eur',
      metadata: {
        paymentId: 'payment-1',
        userId: 'user-1',
      },
      name: 'ParkShare test parking reservation',
      successUrl: 'http://localhost:3000/payment/success',
    });
  });

  it('uses server-owned checkout details instead of client supplied pricing', async () => {
    prisma.payment.create.mockResolvedValue({
      id: 'payment-1',
      amount: 1200,
      currency: 'eur',
    });
    stripeClient.createCheckoutSession.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      payment_intent: 'pi_test_123',
    });
    prisma.payment.update.mockResolvedValue({
      id: 'payment-1',
      providerCheckoutSessionId: 'cs_test_123',
    });

    const tamperedInput: Parameters<
      PaymentsService['createCheckoutSession']
    >[0] = {
      userId: 'user-1',
      successUrl: 'http://localhost:3000/?payment=success',
      cancelUrl: 'http://localhost:3000/?payment=cancel',
    };

    Object.assign(tamperedInput, {
      amount: 50,
      currency: 'usd',
      name: 'Attacker controlled item',
    });

    await service.createCheckoutSession(tamperedInput);

    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        amount: 1200,
        bookingId: undefined,
        currency: 'eur',
        driverUserId: 'user-1',
        provider: PaymentProviderType.STRIPE,
        status: PaymentStatus.CREATED,
      },
    });
    expect(stripeClient.createCheckoutSession).toHaveBeenCalledWith({
      amount: 1200,
      cancelUrl: 'http://localhost:3000/?payment=cancel',
      currency: 'eur',
      metadata: {
        paymentId: 'payment-1',
        userId: 'user-1',
      },
      name: 'ParkShare test parking reservation',
      successUrl: 'http://localhost:3000/?payment=success',
    });
  });

  it('processes checkout.session.completed once and marks payment succeeded', async () => {
    prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    stripeClient.constructWebhookEvent.mockReturnValue({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          metadata: {
            paymentId: 'payment-1',
          },
        },
      },
    });
    prisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'webhook-1' });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({
      duplicate: false,
      eventId: 'evt_test_123',
      received: true,
    });

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'payment-1',
        providerCheckoutSessionId: 'cs_test_123',
      },
      data: {
        providerPaymentIntentId: 'pi_test_123',
        status: PaymentStatus.SUCCEEDED,
      },
    });
  });

  it('confirms a held booking after a completed checkout session', async () => {
    prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'webhook-1' });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    stripeClient.constructWebhookEvent.mockReturnValue({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          metadata: {
            bookingId: 'booking-1',
            paymentId: 'payment-1',
            userId: 'user-1',
          },
        },
      },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature');

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        driverUserId: 'user-1',
        expiresAt: { gt: expect.any(Date) as Date },
        id: 'booking-1',
        status: BookingStatus.HOLD,
      },
      data: {
        status: BookingStatus.CONFIRMED,
      },
    });
  });

  it('does not confirm expired booking holds after checkout completion', async () => {
    prisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.paymentWebhookEvent.create.mockResolvedValue({ id: 'webhook-1' });
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    stripeClient.constructWebhookEvent.mockReturnValue({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          metadata: {
            bookingId: 'booking-1',
            paymentId: 'payment-1',
            userId: 'user-1',
          },
        },
      },
    });

    await service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature');

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        driverUserId: 'user-1',
        expiresAt: { gt: expect.any(Date) as Date },
        id: 'booking-1',
        status: BookingStatus.HOLD,
      },
      data: {
        status: BookingStatus.CONFIRMED,
      },
    });
  });

  it('skips already processed webhook events', async () => {
    stripeClient.constructWebhookEvent.mockReturnValue({
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: {
            paymentId: 'payment-1',
          },
        },
      },
    });
    prisma.paymentWebhookEvent.findUnique.mockResolvedValue({
      providerEventId: 'evt_test_123',
      processingStatus: WebhookProcessingStatus.PROCESSED,
    });

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({
      duplicate: true,
      eventId: 'evt_test_123',
      received: true,
    });

    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });
});
