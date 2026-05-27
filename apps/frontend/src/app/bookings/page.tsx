"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookingStatus,
  type BookingDto,
  type BookingStatus as BookingStatusValue,
  type CreateBookingRequestDto,
  type LoginRequestDto,
  type RegisterRequestDto,
} from "@parkshare/contracts";

type MapTheme = "light" | "dark";
type AuthMode = "login" | "signup";
type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
};

type SpotOption = {
  id: string;
  label: string;
  area: string;
  access: string;
  pricePerHour: number;
  amount: number;
  distance: string;
  summary: string;
  badge: string;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const curatedSpots: SpotOption[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    label: "Central Sofia test spot",
    area: "City center",
    access: "Open access",
    pricePerHour: 6,
    amount: 1200,
    distance: "180 m",
    summary: "Covered private space near the business district with quick street access.",
    badge: "Fast commute",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    label: "Doctor's Garden garage",
    area: "Hospital zone",
    access: "Smart gate",
    pricePerHour: 7,
    amount: 1400,
    distance: "240 m",
    summary: "Secure underground bay with a gate you can open from the app.",
    badge: "Secure",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    label: "University boulevard bay",
    area: "Campus",
    access: "OPEN",
    pricePerHour: 5,
    amount: 1000,
    distance: "90 m",
    summary: "Budget-friendly spot for a quick lecture or workshop stop.",
    badge: "Best value",
  },
];

const statusStyles: Record<BookingStatusValue, string> = {
  [BookingStatus.HOLD]: "bg-amber-100 text-amber-800",
  [BookingStatus.CONFIRMED]: "bg-emerald-100 text-emerald-800",
  [BookingStatus.CANCELED]: "bg-rose-100 text-rose-700",
  [BookingStatus.EXPIRED]: "bg-slate-200 text-slate-700",
};

function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("parkshare_access_token");
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function buildLocalizedRange(startAt: string, endAt: string): string {
  return `${formatDateTime(startAt)} - ${formatDateTime(endAt)}`;
}

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

  return "An unexpected booking error occurred.";
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.trim() || null;
}

export default function BookingsPage() {
  const router = useRouter();
  const [theme] = useState<MapTheme>("light");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [selectedSpotId, setSelectedSpotId] = useState(curatedSpots[0].id);
  const [startAt, setStartAt] = useState(() =>
    formatLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [endAt, setEndAt] = useState(() =>
    formatLocalInputValue(new Date(Date.now() + 3 * 60 * 60 * 1000)),
  );
  const [isHoldSubmitting, setIsHoldSubmitting] = useState(false);

  const selectedSpot = useMemo(
    () => curatedSpots.find((spot) => spot.id === selectedSpotId) ?? curatedSpots[0],
    [selectedSpotId],
  );

  useEffect(() => {
    const token = readToken();

    if (!token) {
      return;
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Stored session is no longer valid.");
        }

        const user = (await response.json()) as AuthUser;
        setCurrentUser(user);
      } catch {
        localStorage.removeItem("parkshare_access_token");
        setCurrentUser(null);
      }
    }

    void loadCurrentUser();
  }, []);

  useEffect(() => {
    const token = readToken();

    if (!token || !currentUser) {
      return;
    }

    async function loadBookings() {
      setIsLoadingBookings(true);
      setBookingError("");

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/bookings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await readResponsePayload(response);

        if (!response.ok) {
          throw new Error(readErrorMessage(payload));
        }

        if (!Array.isArray(payload)) {
          throw new Error("Bookings response was malformed.");
        }

        setBookings(payload as unknown as BookingDto[]);
      } catch (error) {
        setBookingError(
          error instanceof Error ? error.message : "Could not load bookings.",
        );
      } finally {
        setIsLoadingBookings(false);
      }
    }

    void loadBookings();
  }, [currentUser]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (authMode === "signup" && authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const path = authMode === "login" ? "login" : "signup";
      const requestBody: LoginRequestDto | RegisterRequestDto =
        authMode === "login"
          ? {
              email: authEmail,
              password: authPassword,
            }
          : {
              email: authEmail,
              name: authName,
              password: authPassword,
            };

      const response = await fetch(`${apiBaseUrl}/api/v1/auth/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json()) as
        | AuthResponse
        | { message?: string | string[] };

      if (!response.ok) {
        const message = "message" in payload ? payload.message : undefined;
        throw new Error(
          Array.isArray(message)
            ? message.join(" ")
            : message || "Authentication failed.",
        );
      }

      const authPayload = payload as AuthResponse;
      localStorage.setItem("parkshare_access_token", authPayload.accessToken);
      setCurrentUser(authPayload.user);
      setAuthPassword("");
      setAuthConfirmPassword("");
      setAuthMessage(
        authMode === "signup"
          ? "Account created. You can now reserve a spot."
          : "You are signed in.",
      );
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Could not reach the authentication server.",
      );
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleCreateHold() {
    setBookingError("");
    setBookingMessage("");

    const token = readToken();

    if (!token) {
      setBookingError("Sign in before creating a booking hold.");
      return;
    }

    setIsHoldSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spotId: selectedSpot.id,
          spotLabel: selectedSpot.label,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          amount: selectedSpot.amount,
          currency: "eur",
        } satisfies CreateBookingRequestDto),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      if (!isRecord(payload) || typeof payload.id !== "string") {
        throw new Error("Booking response was malformed.");
      }

      const booking = payload as unknown as BookingDto;
      setBookingMessage(`Hold created for ${booking.spotLabel}. Continue to checkout.`);
      router.push(`/checkout?bookingId=${booking.id}`);
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : "Could not create booking.",
      );
    } finally {
      setIsHoldSubmitting(false);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    const token = readToken();

    if (!token) {
      setBookingError("Sign in before canceling a booking.");
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/bookings/${bookingId}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(readErrorMessage(payload));
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId
            ? ({ ...(payload as unknown as BookingDto) } as BookingDto)
            : booking,
        ),
      );
    } catch (error) {
      setBookingError(
        error instanceof Error ? error.message : "Could not cancel booking.",
      );
    }
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ee_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 md:px-8 md:py-8">
        <header className="flex flex-col gap-4 rounded-[1.75rem] bg-white/85 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur md:flex-row md:items-center md:justify-between md:p-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">
              ParkShare booking flow
            </p>
            <h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Reserve a spot, hold it for 10 minutes, then pay with Stripe.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              This flow follows the design system: tonal surfaces, clear CTAs,
              strong status feedback, and a checkout handoff controlled by the
              backend.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Back to map
            </Link>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
              onClick={() => {
                if (!currentUser) {
                  document.getElementById("booking-auth")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  return;
                }

                document.getElementById("booking-planner")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              Start booking
            </button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Available spots
                  </p>
                  <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-900">
                    Pick a spot that fits the trip
                  </h2>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                  {currentUser ? `Signed in as ${currentUser.name}` : "Sign in to book"}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {curatedSpots.map((spot) => {
                  const isSelected = spot.id === selectedSpotId;

                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => setSelectedSpotId(spot.id)}
                      className={`grid gap-4 rounded-[1.5rem] p-4 text-left transition-all md:grid-cols-[1fr_auto] ${
                        isSelected
                          ? "bg-gradient-to-br from-emerald-50 to-teal-50 shadow-[0_10px_30px_rgba(16,185,129,0.16)] ring-2 ring-emerald-400"
                          : "bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
                            {spot.badge}
                          </span>
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                            {spot.access}
                          </span>
                        </div>
                        <h3 className="font-[var(--font-manrope)] text-lg font-semibold text-slate-900">
                          {spot.label}
                        </h3>
                        <p className="text-sm leading-6 text-slate-600">{spot.summary}</p>
                      </div>

                      <div className="flex items-start justify-between gap-4 md:flex-col md:items-end">
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-500">{spot.area}</p>
                          <p className="text-2xl font-bold tracking-tight text-slate-900">
                            €{spot.pricePerHour}/h
                          </p>
                          <p className="text-sm text-slate-500">{spot.distance} away</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                            isSelected
                              ? "bg-emerald-600 text-white"
                              : "bg-white text-slate-600"
                          }`}
                        >
                          {isSelected ? "Selected" : "Choose"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-[1.5rem] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Hold window
                </p>
                <p className="mt-2 font-[var(--font-manrope)] text-xl font-semibold text-slate-900">
                  10 minutes
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  After checkout completes, the booking is confirmed on the backend.
                </p>
              </article>
              <article className="rounded-[1.5rem] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Stripe mode
                </p>
                <p className="mt-2 font-[var(--font-manrope)] text-xl font-semibold text-slate-900">
                  Test checkout
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  The payment amount and title are controlled by the server.
                </p>
              </article>
              <article className="rounded-[1.5rem] bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Booking state
                </p>
                <p className="mt-2 font-[var(--font-manrope)] text-xl font-semibold text-slate-900">
                  HOLD → CONFIRMED
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Canceled and expired holds stay in history for traceability.
                </p>
              </article>
            </section>
          </div>

          <div className="space-y-6">
            <section
              id="booking-auth"
              className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-600">
                    Account access
                  </p>
                  <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-900">
                    {currentUser ? `Welcome, ${currentUser.name}` : "Sign in to start"}
                  </h2>
                  <p className="text-sm leading-6 text-slate-600">
                    Use the same JWT-backed auth flow as the map page.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {currentUser ? currentUser.role : "Guest"}
                </div>
              </div>

              {currentUser ? (
                <div className="mt-6 rounded-[1.25rem] bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                  You are authenticated. Create a hold below and the backend will
                  lock the slot for 10 minutes.
                </div>
              ) : (
                <form className="mt-6 grid gap-4" onSubmit={handleAuthSubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={authMode === "login"}
                      className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                        authMode === "login"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError("");
                        setAuthMessage("");
                      }}
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      aria-pressed={authMode === "signup"}
                      className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                        authMode === "signup"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError("");
                        setAuthMessage("");
                      }}
                    >
                      Sign up
                    </button>
                  </div>

                  {authMode === "signup" ? (
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      <span>Name</span>
                      <input
                        type="text"
                        autoComplete="name"
                        value={authName}
                        onChange={(event) => setAuthName(event.target.value)}
                        className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                        placeholder="Your name"
                        required
                      />
                    </label>
                  ) : null}

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    <span>Email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                      className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                      placeholder="you@example.com"
                      required
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    <span>Password</span>
                    <input
                      type="password"
                      autoComplete={
                        authMode === "login" ? "current-password" : "new-password"
                      }
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                      placeholder="••••••••"
                      minLength={6}
                      required
                    />
                  </label>

                  {authMode === "signup" ? (
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      <span>Confirm password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={authConfirmPassword}
                        onChange={(event) =>
                          setAuthConfirmPassword(event.target.value)
                        }
                        className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                        placeholder="Repeat your password"
                        minLength={6}
                        required
                      />
                    </label>
                  ) : null}

                  {authError ? (
                    <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                      {authError}
                    </p>
                  ) : null}
                  {authMessage ? (
                    <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                      {authMessage}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isAuthSubmitting}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAuthSubmitting
                      ? "Please wait..."
                      : authMode === "login"
                        ? "Log in"
                        : "Create account"}
                  </button>
                </form>
              )}
            </section>

            <section
              id="booking-planner"
              className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5"
            >
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Booking planner
                </p>
                <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-900">
                  Hold the selected spot
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  The booking request creates a short hold first, then checkout confirms it.
                </p>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.5rem] bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Selected spot
                  </p>
                  <p className="mt-2 font-[var(--font-manrope)] text-xl font-semibold text-slate-900">
                    {selectedSpot.label}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {selectedSpot.summary}
                  </p>
                </div>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>Start</span>
                  <input
                    type="datetime-local"
                    value={startAt}
                    onChange={(event) => setStartAt(event.target.value)}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  <span>End</span>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(event) => setEndAt(event.target.value)}
                    className="rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 outline-none ring-0 transition focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                </label>

                <div className="grid gap-3 rounded-[1.5rem] bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="flex items-center justify-between gap-3">
                    <span>Rate</span>
                    <strong>€{selectedSpot.pricePerHour}/h</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Estimated total</span>
                    <strong>€{(selectedSpot.amount / 100).toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Access</span>
                    <strong>{selectedSpot.access}</strong>
                  </div>
                </div>

                {bookingError ? (
                  <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {bookingError}
                  </p>
                ) : null}
                {bookingMessage ? (
                  <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {bookingMessage}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleCreateHold}
                  disabled={isHoldSubmitting}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isHoldSubmitting ? "Creating hold..." : "Reserve and continue to checkout"}
                </button>
              </div>
            </section>

            <section className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/5">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                    My bookings
                  </p>
                  <h2 className="font-[var(--font-manrope)] text-2xl font-semibold tracking-tight text-slate-900">
                    Active and past holds
                  </h2>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  onClick={() => {
                    const token = readToken();

                    if (!token) {
                      setBookingError("Sign in to refresh bookings.");
                      return;
                    }

                    setIsLoadingBookings(true);
                    void (async () => {
                      try {
                        const response = await fetch(
                          `${apiBaseUrl}/api/v1/bookings`,
                          {
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                          },
                        );

                        const payload = await readResponsePayload(response);

                        if (!response.ok) {
                          throw new Error(readErrorMessage(payload));
                        }

                        setBookings(payload as unknown as BookingDto[]);
                      } catch (error) {
                        setBookingError(
                          error instanceof Error
                            ? error.message
                            : "Could not refresh bookings.",
                        );
                      } finally {
                        setIsLoadingBookings(false);
                      }
                    })();
                  }}
                >
                  Refresh
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                {isLoadingBookings ? (
                  <div className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-500">
                    Loading bookings...
                  </div>
                ) : bookings.length ? (
                  bookings.map((booking) => (
                    <article
                      key={booking.id}
                      className="rounded-[1.5rem] bg-slate-50 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${statusStyles[booking.status]}`}
                            >
                              {booking.status}
                            </span>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                              {booking.currency.toUpperCase()}
                            </span>
                          </div>
                          <h3 className="font-[var(--font-manrope)] text-lg font-semibold text-slate-900">
                            {booking.spotLabel}
                          </h3>
                          <p className="text-sm leading-6 text-slate-600">
                            {buildLocalizedRange(booking.startAt, booking.endAt)}
                          </p>
                          <p className="text-sm text-slate-500">
                            Hold expires at {formatDateTime(booking.expiresAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold tracking-tight text-slate-900">
                            €{(booking.amount / 100).toFixed(2)}
                          </p>
                          <p className="text-sm text-slate-500">Booking total</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {booking.status === BookingStatus.HOLD ? (
                          <button
                            type="button"
                            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
                            onClick={() => router.push(`/checkout?bookingId=${booking.id}`)}
                          >
                            Continue to checkout
                          </button>
                        ) : null}
                        {booking.status === BookingStatus.CONFIRMED ? (
                          <Link
                            href={`/checkout?bookingId=${booking.id}`}
                            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Open payment summary
                          </Link>
                        ) : null}
                        {booking.status === BookingStatus.HOLD ||
                        booking.status === BookingStatus.CONFIRMED ? (
                          <button
                            type="button"
                            className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] bg-slate-50 p-5 text-sm leading-6 text-slate-600">
                    No bookings yet. Pick a spot above, create a hold, and checkout will
                    appear immediately.
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>

        <footer className="flex flex-col gap-2 rounded-[1.5rem] bg-slate-900 px-5 py-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between">
          <span>Design follows the ParkShare system: tonal surfaces, clear CTAs, strong states.</span>
          <span className="text-slate-400">Theme slot: {nextTheme}</span>
        </footer>
      </div>
    </main>
  );
}
