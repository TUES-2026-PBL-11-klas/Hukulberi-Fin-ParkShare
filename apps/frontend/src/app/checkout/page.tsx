"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BookingDto } from "@parkshare/contracts";
import PageViewBeacon from "../PageViewBeacon";
import { recordFrontendEvent } from "../../lib/frontend-metrics";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ApiErrorResponse = {
  message?: string | string[];
};

type CheckoutStep = {
  label: string;
  title: string;
  copy: string;
};

const checkoutSteps: CheckoutStep[] = [
  {
    label: "01",
    title: "Review reservation",
    copy: "The booking details come from ParkShare, not from the browser.",
  },
  {
    label: "02",
    title: "Pay in Stripe",
    copy: "Stripe collects the card details in test mode and returns safely.",
  },
  {
    label: "03",
    title: "Confirm booking",
    copy: "ParkShare confirms the reservation after payment verification.",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorMessage(
  payload: unknown,
  fallback = "Could not start Stripe Checkout.",
): string {
  if (isRecord(payload)) {
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as BookingDto | ApiErrorResponse;
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.trim() || null;
}

function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("parkshare_access_token");
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    currency: currency.toUpperCase(),
    currencyDisplay: "code",
    style: "currency",
  }).format(amount / 100);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(startAt: string, endAt: string): string {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const hours = Math.max((end - start) / (60 * 60 * 1000), 0);

  return `${hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`;
}

function getStatusLabel(status: BookingDto["status"]): string {
  if (status === "HOLD") return "Awaiting payment";
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "CANCELED") return "Canceled";
  return "Expired";
}

function getStatusClasses(status: BookingDto["status"]): string {
  if (status === "HOLD") return "bg-amber-100 text-amber-800";
  if (status === "CONFIRMED") return "bg-emerald-100 text-emerald-800";
  if (status === "CANCELED") return "bg-rose-100 text-rose-700";
  return "bg-slate-200 text-slate-700";
}

function StripeWordmark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 26"
      className="h-5 w-12"
      fill="currentColor"
    >
      <path d="M6.9 9.7c0-1.1.9-1.5 2.4-1.5 2.1 0 4.8.6 6.9 1.8V3.5C13.9 2.6 11.6 2.3 9.3 2.3 3.7 2.3 0 5.2 0 10.1c0 7.5 10.4 6.3 10.4 9.5 0 1.2-1.1 1.7-2.6 1.7-2.3 0-5.2-.9-7.6-2.2v6.6c2.6 1.1 5.2 1.5 7.6 1.5 5.7 0 9.7-2.8 9.7-7.8-.1-8.2-10.6-6.8-10.6-9.7ZM26 4.7l-7 1.5-.1 16.2c0 3 2.3 5.2 5.3 5.2 1.7 0 2.9-.3 3.6-.7v-5.7c-.7.3-3.9 1.2-3.9-1.8v-7.1h3.9V6.5h-3.9l.1-1.8ZM35.2 8.2l-.4-1.7h-6.2v20.6h7.1V13.2c1.7-2.2 4.5-1.8 5.4-1.5V6.5c-.9-.4-4.2-1.1-5.9 1.7ZM42.2 6.5h7.1v20.6h-7.1V6.5Zm0-6.2h7.1v4.9h-7.1V.3ZM57.5 6.1c-2.8 0-4.6 1.3-5.6 2.2l-.4-1.8h-6.2v27.4l7.1-1.5.1-6.7c1 .7 2.4 1.5 4.8 1.5 4.9 0 9.3-3.9 9.3-10.7 0-6.3-4.4-10.4-9.1-10.4Zm-1.7 14.9c-1.6 0-2.6-.6-3.3-1.3l-.1-6.6c.7-.8 1.8-1.4 3.4-1.4 2.6 0 4.3 2.9 4.3 4.7 0 1.9-1.7 4.6-4.3 4.6Z" />
    </svg>
  );
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(bookingId));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const authTimer = window.setTimeout(() => {
      setStoredToken(readToken());
      setIsAuthReady(true);
    }, 0);

    return () => window.clearTimeout(authTimer);
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!bookingId || !storedToken) {
      const loadingTimer = window.setTimeout(() => setIsLoading(false), 0);
      return () => window.clearTimeout(loadingTimer);
    }

    async function loadBooking() {
      setError("");
      setIsLoading(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/bookings/${bookingId}`,
          {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          },
        );

        const payload = await readResponsePayload(response);

        if (!response.ok) {
          throw new Error(
            readErrorMessage(payload, "Could not load booking details."),
          );
        }

        if (!isRecord(payload) || typeof payload.id !== "string") {
          throw new Error("Booking response was malformed.");
        }

        setBooking(payload as unknown as BookingDto);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load booking details.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadBooking();
  }, [bookingId, isAuthReady, storedToken]);

  const amount = useMemo(() => {
    if (!booking) return "EUR 0.00";
    return formatMoney(booking.amount, booking.currency);
  }, [booking]);

  const duration = useMemo(() => {
    if (!booking) return "Not loaded";
    return formatDuration(booking.startAt, booking.endAt);
  }, [booking]);

  const canPay = booking?.status === "HOLD";

  async function handleCheckout() {
    setError("");
    setIsSubmitting(true);

    try {
      void recordFrontendEvent("checkout_start", "checkout");

      if (!storedToken) {
        throw new Error("Sign in before starting checkout.");
      }

      if (!bookingId) {
        throw new Error("Missing booking id.");
      }

      const successUrl = `${window.location.origin}/reservations?payment=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = new URL("/reservations", window.location.origin);
      cancelUrl.searchParams.set("payment", "cancel");

      const response = await fetch(
        `${apiBaseUrl}/api/v1/payments/checkout-sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingId,
            successUrl,
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

      void recordFrontendEvent("checkout_redirect", "checkout");
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
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8">
      <PageViewBeacon page="checkout" />

      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <nav className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Back to map
          </Link>
          <Link
            href="/reservations"
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Reservations
          </Link>
        </nav>

        <header className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">
                Secure checkout
              </p>
              <h1 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                Review your reservation before payment.
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Stripe handles card details in test mode. ParkShare confirms the
                reservation after the payment is verified.
              </p>
            </div>
            {booking ? (
              <span
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${getStatusClasses(
                  booking.status,
                )}`}
              >
                {getStatusLabel(booking.status)}
              </span>
            ) : null}
          </div>
        </header>

        {!bookingId ? (
          <section className="rounded-2xl bg-rose-50 p-6 text-rose-700 shadow-sm">
            <h2 className="font-[var(--font-manrope)] text-xl font-bold">
              No booking selected
            </h2>
            <p className="mt-2 text-sm font-medium">
              Start from a spot page so checkout receives a booking id.
            </p>
          </section>
        ) : null}

        {isAuthReady && !storedToken ? (
          <section className="rounded-2xl bg-amber-50 p-6 text-amber-800 shadow-sm">
            <h2 className="font-[var(--font-manrope)] text-xl font-bold">
              Sign in required
            </h2>
            <p className="mt-2 text-sm font-medium">
              Checkout needs your ParkShare session to load and pay this
              reservation.
            </p>
          </section>
        ) : null}

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <article className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                Reservation
              </p>
              <h2 className="mt-3 font-[var(--font-manrope)] text-2xl font-bold tracking-tight text-slate-950">
                {isLoading
                  ? "Loading booking details"
                  : booking?.spotLabel ?? "Booking details unavailable"}
              </h2>
            </div>

            {isLoading ? (
              <div className="grid gap-4">
                <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              </div>
            ) : booking ? (
              <>
                <div className="grid gap-4 rounded-2xl bg-slate-100 p-5 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-bold text-slate-500">Starts</p>
                    <p className="mt-2 text-lg font-black text-slate-950">
                      {formatDateTime(booking.startAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-500">Ends</p>
                    <p className="mt-2 text-lg font-black text-slate-950">
                      {formatDateTime(booking.endAt)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-100 p-5">
                    <p className="text-sm font-bold text-slate-500">Duration</p>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {duration}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-5">
                    <p className="text-sm font-bold text-slate-500">Total</p>
                    <p className="mt-2 text-xl font-black text-emerald-800">
                      {amount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-5">
                    <p className="text-sm font-bold text-slate-500">Currency</p>
                    <p className="mt-2 text-xl font-black text-slate-950">
                      {booking.currency.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl bg-emerald-50 p-5 text-emerald-950">
                  <div>
                    <p className="text-sm font-bold text-emerald-700">
                      Booking id
                    </p>
                    <p className="mt-1 break-all text-sm font-bold">
                      {booking.id}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-700">
                      Spot id
                    </p>
                    <p className="mt-1 break-all text-sm font-bold">
                      {booking.spotId}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-slate-100 p-5 text-sm font-medium leading-6 text-slate-600">
                We could not load this booking. Check that you are signed in
                with the account that created the reservation.
              </div>
            )}

            {error ? (
              <p className="rounded-2xl bg-rose-50 p-5 text-sm font-bold leading-6 text-rose-700">
                {error}
              </p>
            ) : null}
          </article>

          <aside className="grid gap-6 lg:sticky lg:top-6">
            <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                    Payment
                  </p>
                  <h2 className="mt-3 font-[var(--font-manrope)] text-2xl font-bold tracking-tight text-slate-950">
                    {amount}
                  </h2>
                </div>
                <span className="rounded-full bg-[#f6f2ff] px-4 py-2 text-sm font-black text-[#635bff]">
                  TEST MODE
                </span>
              </div>

              {booking?.status === "CONFIRMED" ? (
                <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm font-bold leading-6 text-emerald-800">
                  This reservation is already confirmed. No extra payment is
                  needed.
                </div>
              ) : null}

              {booking?.status === "EXPIRED" ? (
                <div className="mt-6 rounded-2xl bg-rose-50 p-5 text-sm font-bold leading-6 text-rose-700">
                  This reservation expired. Create a new reservation from the
                  spot page.
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={!canPay || isSubmitting}
                className="mt-6 inline-flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#635bff] px-6 text-lg font-black text-white shadow-[0_18px_36px_rgba(99,91,255,0.28)] transition hover:bg-[#5548f5] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff] focus-visible:ring-offset-2"
              >
                <StripeWordmark />
                <span>{isSubmitting ? "Opening..." : "Pay with Stripe"}</span>
              </button>

              <p className="mt-4 text-sm leading-6 text-slate-500">
                Use Stripe test card `4242 4242 4242 4242` with any future
                expiry date and any CVC.
              </p>
            </section>

            <section className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm md:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Flow
              </p>
              <div className="mt-5 grid gap-3">
                {checkoutSteps.map((step) => (
                  <div key={step.label} className="rounded-2xl bg-white/7 p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-sm font-black text-slate-950">
                        {step.label}
                      </span>
                      <div>
                        <h3 className="font-[var(--font-manrope)] text-base font-bold">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-300">
                          {step.copy}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8">
          <section className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl place-items-center">
            <div className="rounded-2xl bg-white p-6 text-sm font-bold text-slate-600 shadow-sm">
              Loading checkout...
            </div>
          </section>
        </main>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
