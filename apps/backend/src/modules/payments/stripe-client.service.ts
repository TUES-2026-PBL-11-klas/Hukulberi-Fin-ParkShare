import { Injectable, InternalServerErrorException } from '@nestjs/common';
import StripeConstructor from 'stripe';

type StripeClient = InstanceType<typeof StripeConstructor>;

interface CheckoutSessionInput {
  amount: number;
  currency: string;
  name: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  payment_intent: string | null | object;
  payment_status?: string;
  status?: string | null;
  metadata?: Record<string, string> | null;
}

export interface StripeWebhookObject {
  id: string;
  metadata?: Record<string, string> | null;
  payment_intent?: string | null | object;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: StripeWebhookObject;
  };
}

@Injectable()
export class StripeClientService {
  private readonly stripe: StripeClient;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY is not set');
    }

    this.stripe = new StripeConstructor(secretKey);
  }

  async createCheckoutSession(
    input: CheckoutSessionInput,
  ): Promise<StripeCheckoutSession> {
    return this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            product_data: {
              name: input.name,
            },
            unit_amount: input.amount,
          },
        },
      ],
      metadata: input.metadata,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
  }

  async retrieveCheckoutSession(
    checkoutSessionId: string,
  ): Promise<StripeCheckoutSession> {
    return this.stripe.checkout.sessions.retrieve(checkoutSessionId);
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): StripeWebhookEvent {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRET is not set',
      );
    }

    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    ) as StripeWebhookEvent;
  }
}
