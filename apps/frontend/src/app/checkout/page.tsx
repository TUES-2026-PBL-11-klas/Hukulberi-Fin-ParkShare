"use client";

import Link from "next/link";
import { useState } from "react";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const checkoutAmount = 1200;
const checkoutCurrency = "eur";
const checkoutDisplayAmount = new Intl.NumberFormat("en", {
  currency: checkoutCurrency.toUpperCase(),
  currencyDisplay: "code",
  style: "currency",
}).format(checkoutAmount / 100);

type CheckoutResponse = {
  checkoutUrl: string;
};

type ApiErrorResponse = {
  message?: string | string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorMessage(payload: unknown): string {
  if (isRecord(payload)) {
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return "Could not start Stripe Checkout.";
}

async function readResponsePayload(
  response: Response,
): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as CheckoutResponse | ApiErrorResponse;
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.trim() || null;
}

function CheckoutContent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setError("");
    setIsSubmitting(true);

    try {
      const accessToken = localStorage.getItem("parkshare_access_token");

      if (!accessToken) {
        throw new Error("Sign in before starting checkout.");
      }

      const mapUrl = new URL("/", window.location.origin);
      const successUrl = new URL(mapUrl);
      successUrl.searchParams.set("payment", "success");
      const cancelUrl = new URL(mapUrl);
      cancelUrl.searchParams.set("payment", "cancel");

      const response = await fetch(
        `${apiBaseUrl}/api/v1/payments/checkout-sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            successUrl: successUrl.toString(),
            cancelUrl: cancelUrl.toString(),
          }),
        },
      );

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      if (
        !isRecord(payload) ||
        typeof payload.checkoutUrl !== "string" ||
        !payload.checkoutUrl
      ) {
        throw new Error("Stripe did not return a checkout URL.");
      }

      window.location.assign(payload.checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start Stripe Checkout.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-panel" aria-labelledby="checkout-title">
        <div className="checkout-copy">
          <Link href="/" className="checkout-back-link">
            Back to map
          </Link>
          <p className="checkout-eyebrow">Stripe test checkout</p>
          <h1 id="checkout-title">Reserve your ParkShare spot</h1>
          <p>
            Use Stripe&apos;s hosted checkout to test the payment flow. Card
            details are entered only on Stripe, never inside ParkShare.
          </p>
        </div>

        <div className="checkout-summary" aria-label="Reservation summary">
          <div>
            <span>Parking session</span>
            <strong>Central Sofia test spot</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>2 hours</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{checkoutDisplayAmount}</strong>
          </div>
        </div>

        {error ? (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="stripe-checkout-button"
          type="button"
          onClick={handleCheckout}
          disabled={isSubmitting}
        >
          <span className="stripe-logo" aria-hidden="true">
            <svg viewBox="0 0 64 28" role="img">
              <path
                d="M59.6 14.4c0-4.2-2-7.5-5.9-7.5s-6.3 3.3-6.3 7.5c0 5 2.8 7.4 6.8 7.4 2 0 3.4-.4 4.6-1.1v-3.3c-1.1.6-2.5.9-4.1.9-1.6 0-3-.6-3.2-2.5h8.1v-1.4Zm-8.1-1.5c0-1.8 1.1-2.6 2.1-2.6s2 .8 2 2.6h-4.1ZM40.9 6.9c-1.6 0-2.7.7-3.3 1.2l-.2-.9h-3.7v19.1l4.2-.9v-4.6c.6.5 1.5 1 3 1 3 0 5.7-2.4 5.7-7.6-.1-4.8-2.8-7.3-5.7-7.3Zm-1 11.2c-.9 0-1.5-.3-2-.8v-6c.4-.5 1.1-.8 2-.8 1.5 0 2.5 1.7 2.5 3.8 0 2.3-1 3.8-2.5 3.8ZM28 5.9l4.2-.9V1.6l-4.2.9v3.4Zm0 1.3h4.2v14.3H28V7.2ZM23.5 8.4l-.3-1.2h-3.6v14.3h4.2v-9.7c1-.9 2.8-.8 3.3-.7V7.2c-.6-.2-2.5-.5-3.6 1.2ZM15.1 3.7l-4.1.9v13.1c0 2.4 1.8 4.2 4.2 4.2 1.3 0 2.2-.2 2.7-.5V18c-.5.2-2.7.8-2.7-1.3v-5.9h2.7V7.2h-2.8V3.7ZM6.5 11.3c0-.7.6-1 1.5-1 1.3 0 3 .4 4.3 1.1V7.6c-1.4-.6-2.8-.8-4.3-.8-3.5 0-5.9 1.8-5.9 4.9 0 4.8 6.6 4 6.6 6.1 0 .8-.7 1.1-1.7 1.1-1.4 0-3.3-.6-4.7-1.4v3.8c1.6.7 3.2 1 4.7 1 3.6 0 6.1-1.8 6.1-4.9 0-5.2-6.6-4.3-6.6-6.1Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span>{isSubmitting ? "Opening Checkout..." : "Pay with Stripe"}</span>
        </button>

        <p className="checkout-test-card">
          Test card: 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
      </section>
    </main>
  );
}

export default function CheckoutPage() {
  return <CheckoutContent />;
}
