"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BookingDto } from "@parkshare/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("parkshare_access_token");
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [storedToken] = useState(() => readToken());
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(bookingId && storedToken));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingId || !storedToken) {
      return;
    }

    async function loadBooking() {
      setError("");

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
          throw new Error(readErrorMessage(payload));
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
  }, [bookingId, storedToken]);

  const checkoutDisplayAmount = useMemo(() => {
    if (!booking) {
      return "€12.00";
    }

    return new Intl.NumberFormat("en", {
      currency: booking.currency.toUpperCase(),
      currencyDisplay: "code",
      style: "currency",
    }).format(booking.amount / 100);
  }, [booking]);

  async function handleCheckout() {
    setError("");
    setIsSubmitting(true);

    try {
      if (!storedToken) {
        throw new Error("Sign in before starting checkout.");
      }

      if (!bookingId) {
        throw new Error("Missing booking id.");
      }

      const successUrl = new URL("/", window.location.origin);
      successUrl.searchParams.set("payment", "success");
      const cancelUrl = new URL("/", window.location.origin);
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ee_100%)] px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[1.75rem] bg-white/85 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur md:flex-row md:items-end md:justify-between md:p-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">
              Stripe checkout
            </p>
            <h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Confirm the hold and complete payment.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              The backend creates the hold first, then Stripe only sees the
              server-owned booking details.
            </p>
          </div>
          <Link
            href="/bookings"
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Back to bookings
          </Link>
        </header>

        {!bookingId ? (
          <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
            <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-900">
              No booking selected
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create a hold from the booking flow first. The checkout page needs a
              booking id so it can fetch the server-owned reservation details.
            </p>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Booking summary
                </p>
                <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-900">
                  {booking?.spotLabel ?? "Waiting for booking details"}
                </h2>
              </div>
              {booking ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
                    booking.status === "HOLD"
                      ? "bg-amber-100 text-amber-800"
                      : booking.status === "CONFIRMED"
                        ? "bg-emerald-100 text-emerald-800"
                        : booking.status === "CANCELED"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {booking.status}
                </span>
              ) : null}
            </div>

            {isLoading ? (
              <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-500">
                Loading booking details...
              </div>
            ) : booking ? (
              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.5rem] bg-slate-50 p-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Time window
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {formatDateTime(booking.startAt)}
                      </p>
                      <p className="text-sm text-slate-600">
                        to {formatDateTime(booking.endAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Total
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {checkoutDisplayAmount}
                      </p>
                      <p className="text-sm text-slate-600">
                        Held for booking #{booking.id}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-[1.5rem] bg-emerald-50 p-5 text-sm text-emerald-900 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      Spot id
                    </p>
                    <p className="mt-2 font-medium">{booking.spotId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      Hold expires
                    </p>
                    <p className="mt-2 font-medium">
                      {formatDateTime(booking.expiresAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      Currency
                    </p>
                    <p className="mt-2 font-medium">{booking.currency.toUpperCase()}</p>
                  </div>
                </div>

                {booking.status === "CONFIRMED" ? (
                  <div className="rounded-[1.5rem] bg-emerald-50 p-5 text-sm leading-6 text-emerald-800">
                    This booking is already confirmed. You can return to your booking
                    list or review the payment result on the home map.
                  </div>
                ) : null}
                {booking.status === "EXPIRED" ? (
                  <div className="rounded-[1.5rem] bg-rose-50 p-5 text-sm leading-6 text-rose-700">
                    This hold expired. Go back to the booking planner and create a new
                    reservation.
                  </div>
                ) : null}

                {error ? (
                  <p className="rounded-[1.5rem] bg-rose-50 p-5 text-sm font-medium text-rose-700">
                    {error}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isSubmitting || booking.status !== "HOLD"}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Opening Checkout..." : "Pay with Stripe"}
                  </button>
                  <Link
                    href="/bookings"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-slate-100 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Back to bookings
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                We could not load the booking details. Check your sign-in state and go
                back to the booking planner if needed.
              </div>
            )}
          </article>

          <aside className="rounded-[1.75rem] bg-slate-900 p-6 text-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">
              What happens next
            </p>
            <h2 className="mt-2 font-[var(--font-manrope)] text-2xl font-semibold tracking-tight">
              Stripe completes the payment, then the backend confirms the hold.
            </h2>
            <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-200">
              <li className="rounded-[1.25rem] bg-white/5 p-4">
                1. The checkout request includes the booking id and server-owned
                details.
              </li>
              <li className="rounded-[1.25rem] bg-white/5 p-4">
                2. Stripe sends the event back to ParkShare through the webhook route.
              </li>
              <li className="rounded-[1.25rem] bg-white/5 p-4">
                3. The booking switches from HOLD to CONFIRMED if the webhook arrives
                before expiry.
              </li>
            </ol>
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
        <main className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef6ee_100%)] px-4 py-6 text-slate-900 md:px-8 md:py-8">
          <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
            <section className="rounded-[1.75rem] bg-white p-6 text-sm font-medium text-slate-600 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
              Loading checkout...
            </section>
          </div>
        </main>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
