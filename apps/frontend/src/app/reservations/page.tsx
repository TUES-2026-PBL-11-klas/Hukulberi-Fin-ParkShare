"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  CreditCard,
  MapPin,
  MessageSquareText,
  RotateCw,
  XCircle,
} from "lucide-react";
import {
  BookingStatus,
  type BookingDto,
  type ReconcileCheckoutSessionResponseDto,
} from "@parkshare/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type ApiErrorResponse = {
  message?: string | string[];
};

const statusStyles = {
  HOLD: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-slate-200 text-slate-600",
  EXPIRED: "bg-rose-100 text-rose-700",
} satisfies Record<BookingStatus, string>;

const statusIcons = {
  HOLD: Clock3,
  CONFIRMED: CheckCircle2,
  CANCELED: XCircle,
  EXPIRED: CircleAlert,
} satisfies Record<BookingStatus, typeof Clock3>;

const statusLabels = {
  HOLD: "Awaiting payment",
  CONFIRMED: "Confirmed",
  CANCELED: "Canceled",
  EXPIRED: "Payment expired",
} satisfies Record<BookingStatus, string>;

function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("parkshare_access_token");
}

function readPayloadMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as ApiErrorResponse).message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    currency: currency.toUpperCase(),
    currencyDisplay: "code",
    style: "currency",
  }).format(cents / 100);
}

function isActiveBooking(booking: BookingDto, now = new Date()): boolean {
  if (booking.status === BookingStatus.HOLD) {
    return new Date(booking.expiresAt) > now;
  }

  if (booking.status === BookingStatus.CONFIRMED) {
    return new Date(booking.endAt) > now;
  }

  return false;
}

function canReviewBooking(booking: BookingDto, now = new Date()): boolean {
  return (
    booking.status === BookingStatus.CONFIRMED && new Date(booking.endAt) <= now
  );
}

function getPayoutWindowLabel(booking: BookingDto, now = new Date()): string {
  if (booking.status !== BookingStatus.CONFIRMED) {
    return "";
  }

  const endAt = new Date(booking.endAt);

  if (endAt > now) {
    return "Host payout waits until the reservation is complete.";
  }

  const payoutEligibleAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

  if (payoutEligibleAt > now) {
    return `24-hour review window closes ${formatDateTime(
      payoutEligibleAt.toISOString(),
    )}.`;
  }

  return "Ready for host payout review.";
}

function ReservationCard({
  booking,
  isCanceling,
  onCancel,
}: {
  booking: BookingDto;
  isCanceling: boolean;
  onCancel: (bookingId: string) => void;
}) {
  const StatusIcon = statusIcons[booking.status];
  const isHold = booking.status === BookingStatus.HOLD;
  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const isFutureOrOngoing = new Date(booking.endAt) > new Date();
  const payoutWindowLabel = getPayoutWindowLabel(booking);

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusStyles[booking.status]}`}
            >
              <StatusIcon size={14} aria-hidden="true" />
              {statusLabels[booking.status]}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
              {formatPrice(booking.amount, booking.currency)}
            </span>
          </div>

          <div>
            <h3 className="truncate text-lg font-bold text-slate-900">
              {booking.spotLabel}
            </h3>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-500">
              <MapPin size={16} aria-hidden="true" />
              Spot reservation
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-100 p-4 text-sm md:grid-cols-2">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500">
                Starts
              </span>
              <strong className="mt-1 block text-slate-900">
                {formatDateTime(booking.startAt)}
              </strong>
            </div>
            <div>
              <span className="text-xs font-bold uppercase text-slate-500">
                Ends
              </span>
              <strong className="mt-1 block text-slate-900">
                {formatDateTime(booking.endAt)}
              </strong>
            </div>
          </div>

          {isHold ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Payment is not finished yet. Complete Stripe Checkout to confirm
              this reservation.
            </p>
          ) : null}

          {payoutWindowLabel ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {payoutWindowLabel}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:w-48 md:flex-col">
          <Link
            href={`/spots/${encodeURIComponent(booking.spotId)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            View spot
          </Link>
          {isHold ? (
            <Link
              href={`/checkout?bookingId=${encodeURIComponent(booking.id)}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <CreditCard size={16} aria-hidden="true" />
              Pay now
            </Link>
          ) : null}
          {isConfirmed && isFutureOrOngoing ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-rose-50 px-4 text-sm font-bold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCanceling}
              onClick={() => onCancel(booking.id)}
            >
              {isCanceling ? "Canceling..." : "Cancel"}
            </button>
          ) : null}
          {canReviewBooking(booking) ? (
            <Link
              href={`/reviews/submit?bookingId=${encodeURIComponent(
                booking.id,
              )}&spotId=${encodeURIComponent(booking.spotId)}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <MessageSquareText size={16} aria-hidden="true" />
              Review
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ReservationSection({
  title,
  description,
  bookings,
  empty,
  cancelingId,
  onCancel,
}: {
  title: string;
  description: string;
  bookings: BookingDto[];
  empty: string;
  cancelingId: string;
  onCancel: (bookingId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {bookings.length > 0 ? (
        <div className="grid gap-4">
          {bookings.map((booking) => (
            <ReservationCard
              key={booking.id}
              booking={booking}
              isCanceling={cancelingId === booking.id}
              onCancel={onCancel}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-sm shadow-slate-200/70">
          {empty}
        </div>
      )}
    </section>
  );
}

export default function ReservationsPage() {
  const [storedToken] = useState(() => readToken());
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(storedToken));
  const [error, setError] = useState(
    storedToken ? "" : "Sign in to view your reservations.",
  );
  const [cancelingId, setCancelingId] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!storedToken || typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const payment = searchParams.get("payment");
    const checkoutSessionId = searchParams.get("session_id");

    if (payment !== "success" || !checkoutSessionId) {
      return;
    }

    const paidCheckoutSessionId = checkoutSessionId;

    if (paidCheckoutSessionId === "{CHECKOUT_SESSION_ID}") {
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    async function reconcileCheckoutSession() {
      setPaymentNotice("Confirming Stripe payment...");

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/payments/checkout-sessions/${encodeURIComponent(
            paidCheckoutSessionId,
          )}/reconcile`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          },
        );
        const payload =
          (await response.json()) as ReconcileCheckoutSessionResponseDto | ApiErrorResponse;

        if (!response.ok || !("confirmed" in payload)) {
          throw new Error(
            readPayloadMessage(payload, "Could not confirm Stripe payment."),
          );
        }

        if (payload.confirmed) {
          setPaymentNotice(
            "Payment confirmed. Your reservation is now confirmed, and host payout will wait for the 24-hour review window.",
          );
          setRefreshKey((key) => key + 1);
        } else {
          setPaymentNotice(
            "Stripe payment is still processing. Refresh in a moment if the reservation is not confirmed yet.",
          );
        }

        window.history.replaceState(null, "", window.location.pathname);
      } catch (reconcileError) {
        setPaymentNotice(
          reconcileError instanceof Error
            ? reconcileError.message
            : "Could not confirm Stripe payment.",
        );
      }
    }

    void reconcileCheckoutSession();
  }, [storedToken]);

  useEffect(() => {
    if (!storedToken) {
      return;
    }

    async function loadReservations() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/bookings`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        const payload = (await response.json()) as BookingDto[] | ApiErrorResponse;

        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(
            readPayloadMessage(payload, "Could not load reservations."),
          );
        }

        setBookings(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load reservations.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadReservations();
  }, [refreshKey, storedToken]);

  const { activeBookings, oldBookings } = useMemo(() => {
    const now = new Date();
    const active = bookings.filter((booking) => isActiveBooking(booking, now));
    const old = bookings.filter((booking) => !isActiveBooking(booking, now));

    return {
      activeBookings: active,
      oldBookings: old,
    };
  }, [bookings]);

  async function handleCancel(bookingId: string) {
    if (!storedToken) {
      setError("Sign in to cancel reservations.");
      return;
    }

    setCancelingId(bookingId);
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/bookings/${encodeURIComponent(bookingId)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        },
      );
      const payload = (await response.json()) as BookingDto | ApiErrorResponse;

      if (!response.ok || !("id" in payload)) {
        throw new Error(
          readPayloadMessage(payload, "Could not cancel reservation."),
        );
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === payload.id ? (payload as BookingDto) : booking,
        ),
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Could not cancel reservation.",
      );
    } finally {
      setCancelingId("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm shadow-slate-200/70 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center text-sm font-bold text-emerald-700 hover:text-emerald-800"
            >
              Back to map
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              My reservations
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-500">
              Track active reservations, payment state, the 24-hour review
              window, and older activity in one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-100 px-5 py-4">
              <span className="font-bold text-slate-500">Active</span>
              <strong className="mt-1 block text-2xl font-bold text-emerald-700">
                {activeBookings.length}
              </strong>
            </div>
            <div className="rounded-2xl bg-slate-100 px-5 py-4">
              <span className="font-bold text-slate-500">History</span>
              <strong className="mt-1 block text-2xl font-bold text-slate-900">
                {oldBookings.length}
              </strong>
            </div>
          </div>
        </header>

        {error ? (
          <section className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </section>
        ) : null}

        {paymentNotice ? (
          <section className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            {paymentNotice}
          </section>
        ) : null}

        {isLoading ? (
          <section className="grid gap-4">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-2xl bg-slate-200"
              />
            ))}
          </section>
        ) : (
          <>
            <ReservationSection
              title="Active reservations"
              description="Only one active reservation is allowed at a time."
              bookings={activeBookings}
              empty="You have no active reservations."
              cancelingId={cancelingId}
              onCancel={handleCancel}
            />

            <ReservationSection
              title="Old reservations"
              description="Canceled, expired, and completed bookings stay here for reference."
              bookings={oldBookings}
              empty="No older reservation activity yet."
              cancelingId={cancelingId}
              onCancel={handleCancel}
            />
          </>
        )}

        <section className="flex flex-col gap-3 rounded-3xl bg-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Need another spot?</h2>
            <p className="mt-1 text-sm text-slate-300">
              Cancel or complete your active reservation before reserving again.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              <RotateCw size={16} aria-hidden="true" />
              Refresh
            </button>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 px-4 text-sm font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <CalendarClock size={16} aria-hidden="true" />
              Find parking
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
