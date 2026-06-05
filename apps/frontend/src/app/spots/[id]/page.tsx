"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Star } from "lucide-react";
import { mockGarages, type MapSpot } from "../../mock-garages";
import "./spot-info.css";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type SpotDetails = MapSpot & {
  description?: string;
  verificationStatus?: string;
  isActive?: boolean;
  hostUser?: {
    id?: string;
    name: string;
    email?: string;
  };
  bookings?: Array<{
    id: string;
    startAt: string;
    endAt: string;
  }>;
  reviews?: Array<{
    id: string;
    rating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
    comment?: string | null;
    createdAt?: string;
    author?: {
      id?: string;
      name: string;
    };
  }>;
};

type ApiErrorResponse = {
  message?: string | string[];
};

type ReviewRatingValue = NonNullable<SpotDetails["reviews"]>[number]["rating"];
const weekdayKeys = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
type ReservationDefaults = {
  date: string;
  startTime: string;
  endTime: string;
};

function readErrorMessage(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as ApiErrorResponse).message;

    if (Array.isArray(message)) {
      return message.join(" ");
    }

    if (typeof message === "string") {
      return message;
    }
  }

  return "Could not load this parking spot.";
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en", {
    currency: "EUR",
    currencyDisplay: "code",
    style: "currency",
  }).format(cents / 100);
}

function readToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("parkshare_access_token");
}

function toDateTimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toDateInputValue(date: Date): string {
  return toDateTimeInputValue(date).slice(0, 10);
}

function toTimeInputValue(date: Date): string {
  return toDateTimeInputValue(date).slice(11, 16);
}

function combineLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

function addOneHourWithinWindow(startTime: string, availableUntil: string): string {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [untilHour, untilMinute] = availableUntil.split(":").map(Number);
  const end = new Date(2000, 0, 1, startHour, startMinute, 0, 0);
  end.setHours(end.getHours() + 1);
  const latestEnd = new Date(2000, 0, 1, untilHour, untilMinute, 0, 0);
  const selectedEnd = end <= latestEnd ? end : latestEnd;

  return `${String(selectedEnd.getHours()).padStart(2, "0")}:${String(
    selectedEnd.getMinutes(),
  ).padStart(2, "0")}`;
}

function roundUpToNextHour(date: Date): Date {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);

  if (next <= date) {
    next.setHours(next.getHours() + 1);
  }

  return next;
}

function getDefaultReservationTimes() {
  const roundedStart = roundUpToNextHour(new Date());
  const roundedEnd = new Date(roundedStart);
  roundedEnd.setHours(roundedEnd.getHours() + 1);

  return {
    startAt: toDateTimeInputValue(roundedStart),
    endAt: toDateTimeInputValue(roundedEnd),
  };
}

function getReservationValidationMessage(
  spot: SpotDetails | null,
  selectedDate: string,
  startTime: string,
  endTime: string,
): string {
  if (!spot || !selectedDate || !startTime || !endTime) {
    return "";
  }

  const startDate = combineLocalDateTime(selectedDate, startTime);
  const endDate = combineLocalDateTime(selectedDate, endTime);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Choose valid reservation times.";
  }

  if (startDate >= endDate) {
    return "Check-out must be after check-in.";
  }

  if (startDate < new Date()) {
    return "Choose a check-in time in the future.";
  }

  const selectedDay = weekdayKeys[startDate.getDay()];
  const availableDays = spot.availableDays ?? [];

  if (availableDays.length > 0 && !availableDays.includes(selectedDay)) {
    return `This spot is only available on ${formatAvailabilityDays(availableDays)}.`;
  }

  const availableFrom = spot.availableFrom ?? "08:00";
  const availableUntil = spot.availableUntil ?? "20:00";

  if (startTime < availableFrom || endTime > availableUntil) {
    return `Choose a time between ${availableFrom} and ${availableUntil}.`;
  }

  return "";
}

function getNextAvailableReservationTimes(spot: SpotDetails): {
  date: string;
  startTime: string;
  endTime: string;
} {
  const availableDays = spot.availableDays?.length
    ? spot.availableDays
    : ["MON", "TUE", "WED", "THU", "FRI"];
  const availableFrom = spot.availableFrom ?? "08:00";
  const availableUntil = spot.availableUntil ?? "20:00";
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + dayOffset);

    if (!availableDays.includes(weekdayKeys[candidate.getDay()])) {
      continue;
    }

    const [fromHour, fromMinute] = availableFrom.split(":").map(Number);
    const [untilHour, untilMinute] = availableUntil.split(":").map(Number);
    const start = new Date(candidate);
    start.setHours(fromHour, fromMinute, 0, 0);

    if (start <= now) {
      start.setHours(now.getHours() + 1, 0, 0, 0);
    }

    const end = new Date(start);
    end.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
    const latestEnd = new Date(candidate);
    latestEnd.setHours(untilHour, untilMinute, 0, 0);

    if (start > now && end <= latestEnd) {
      return {
        date: toDateInputValue(start),
        startTime: toTimeInputValue(start),
        endTime: toTimeInputValue(end),
      };
    }
  }

  const fallback = getDefaultReservationTimes();

  return {
    date: fallback.startAt.slice(0, 10),
    startTime: fallback.startAt.slice(11, 16),
    endTime: fallback.endAt.slice(11, 16),
  };
}

function getAvailableDateOptions(spot: SpotDetails | null): ReservationDefaults[] {
  if (!spot) {
    return [];
  }

  const availableDays = spot.availableDays?.length
    ? spot.availableDays
    : ["MON", "TUE", "WED", "THU", "FRI"];
  const availableFrom = spot.availableFrom ?? "08:00";
  const availableUntil = spot.availableUntil ?? "20:00";
  const options: ReservationDefaults[] = [];
  const now = new Date();
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 21 && options.length < 6; dayOffset += 1) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + dayOffset);

    if (!availableDays.includes(weekdayKeys[candidate.getDay()])) {
      continue;
    }

    let startTime = availableFrom;
    const candidateDate = toDateInputValue(candidate);

    if (candidateDate === toDateInputValue(now)) {
      const roundedStart = roundUpToNextHour(now);
      startTime = toTimeInputValue(roundedStart) > availableFrom
        ? toTimeInputValue(roundedStart)
        : availableFrom;
    }

    const endTime = addOneHourWithinWindow(startTime, availableUntil);

    if (startTime >= availableUntil || endTime <= startTime) {
      continue;
    }

    options.push({
      date: candidateDate,
      startTime,
      endTime,
    });
  }

  return options;
}

function formatReservationDay(date: string): { day: string; date: string } {
  const parsedDate = combineLocalDateTime(date, "12:00");
  const parts = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).formatToParts(parsedDate);

  return {
    day: parts.find((part) => part.type === "weekday")?.value ?? "",
    date: `${parts.find((part) => part.type === "month")?.value ?? ""} ${
      parts.find((part) => part.type === "day")?.value ?? ""
    }`.trim(),
  };
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

function formatAvailabilityDays(days?: string[]): string {
  if (!days?.length) {
    return "Days not set";
  }

  const labels: Record<string, string> = {
    MON: "Mon",
    TUE: "Tue",
    WED: "Wed",
    THU: "Thu",
    FRI: "Fri",
    SAT: "Sat",
    SUN: "Sun",
  };

  return days.map((day) => labels[day] ?? day).join(", ");
}

function ratingToNumber(rating: ReviewRatingValue): number {
  const ratingMap = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  } satisfies Record<ReviewRatingValue, number>;

  return ratingMap[rating];
}

function SpotVisual({ spot, index }: { spot: SpotDetails; index: number }) {
  const image = spot.photoUrls?.[index];

  if (image) {
    return (
      <Image
        src={image}
        alt={`${spot.title} photo ${index + 1}`}
        fill
        sizes={index === 0 ? "(max-width: 900px) 100vw, 55vw" : "25vw"}
        unoptimized
      />
    );
  }

  return (
    <div className="spot-visual-placeholder" aria-hidden="true">
      <MapPin />
      <span>{spot.title}</span>
    </div>
  );
}

export default function SpotInfoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const spotId = params.id;
  const [spot, setSpot] = useState<SpotDetails | null>(() => {
    return mockGarages.find((garage) => garage.id === spotId) ?? null;
  });
  const [isLoading, setIsLoading] = useState(!spot);
  const [error, setError] = useState("");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  useEffect(() => {
    if (!spotId || mockGarages.some((garage) => garage.id === spotId)) {
      return;
    }

    async function loadSpot() {
      setError("");
      setIsLoading(true);

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v1/spots/${encodeURIComponent(spotId)}`,
        );
        const payload = (await response.json()) as SpotDetails | ApiErrorResponse;

        if (!response.ok) {
          throw new Error(readErrorMessage(payload));
        }

        setSpot(payload as SpotDetails);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load this parking spot.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSpot();
  }, [spotId]);

  useEffect(() => {
    if (!spot) {
      return;
    }

    const fillTimer = window.setTimeout(() => {
      const defaults = getNextAvailableReservationTimes(spot);
      setSelectedDate((current) => current || defaults.date);
      setStartTime((current) => current || defaults.startTime);
      setEndTime((current) => current || defaults.endTime);
    }, 0);

    return () => window.clearTimeout(fillTimer);
  }, [spot]);

  const ratingLabel = useMemo(() => {
    if (!spot?.averageRating || !spot.reviewCount) {
      return "No reviews yet";
    }

    return `${spot.averageRating.toFixed(1)} (${spot.reviewCount} reviews)`;
  }, [spot]);

  const bookingSummary = useMemo(() => {
    if (!spot || !selectedDate || !startTime || !endTime) {
      return {
        amount: 0,
        hours: 0,
      };
    }

    const startDate = combineLocalDateTime(selectedDate, startTime);
    const endDate = combineLocalDateTime(selectedDate, endTime);
    const durationMs = endDate.getTime() - startDate.getTime();
    const hours = durationMs > 0 ? durationMs / (60 * 60 * 1000) : 0;

    return {
      amount: Math.round(hours * spot.pricePerHour),
      hours,
    };
  }, [endTime, selectedDate, spot, startTime]);
  const reservationValidationMessage = useMemo(
    () => getReservationValidationMessage(spot, selectedDate, startTime, endTime),
    [endTime, selectedDate, spot, startTime],
  );
  const availableDateOptions = useMemo(() => getAvailableDateOptions(spot), [spot]);
  const canReserve =
    !reservationValidationMessage &&
    bookingSummary.amount > 0 &&
    !isCreatingBooking;

  async function handleReserveNow() {
    setBookingError("");

    if (!spot) {
      return;
    }

    if (spot.id.startsWith("mock-")) {
      setBookingError("Demo spots cannot be reserved. Choose a verified real spot.");
      return;
    }

    const accessToken = readToken();

    if (!accessToken) {
      setBookingError("Sign in before reserving this spot.");
      return;
    }

    const startDate = combineLocalDateTime(selectedDate, startTime);
    const endDate = combineLocalDateTime(selectedDate, endTime);

    if (reservationValidationMessage) {
      setBookingError(reservationValidationMessage);
      return;
    }

    setIsCreatingBooking(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spotId: spot.id,
          spotLabel: spot.title,
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          amount: bookingSummary.amount,
          currency: "eur",
        }),
      });
      const payload = (await response.json()) as { id?: string } | ApiErrorResponse;

      if (!response.ok || !("id" in payload) || !payload.id) {
        throw new Error(readPayloadMessage(payload, "Could not reserve this spot."));
      }

      router.push(`/checkout?bookingId=${encodeURIComponent(payload.id)}`);
    } catch (reserveError) {
      setBookingError(
        reserveError instanceof Error
          ? reserveError.message
          : "Could not reserve this spot.",
      );
    } finally {
      setIsCreatingBooking(false);
    }
  }

  if (isLoading) {
    return (
      <main className="spot-info-shell">
        <section className="spot-info-loading" aria-label="Loading spot details">
          <span />
          <span />
          <span />
        </section>
      </main>
    );
  }

  if (error || !spot) {
    return (
      <main className="spot-info-shell">
        <section className="spot-info-state">
          <h1>Spot not available</h1>
          <p>{error || "This parking spot could not be found."}</p>
          <Link href="/">Back to map</Link>
        </section>
      </main>
    );
  }

  const reviews = spot.reviews ?? [];
  const photoCount = spot.photoUrls?.length ?? 0;
  const hasPhotos = photoCount > 0;

  return (
    <main className="spot-info-shell">
      <header className="spot-info-topbar">
        <Link href="/" className="spot-info-back">
          Back to map
        </Link>
        <Link href="/marketplace/create" className="spot-info-host-link">
          List garage
        </Link>
      </header>

      <section className="spot-info-hero">
        <div className="spot-info-gallery">
          <div className="spot-info-gallery-main">
            <SpotVisual spot={spot} index={selectedPhotoIndex} />
          </div>
          {hasPhotos ? (
            <div className="spot-info-gallery-strip" aria-label="Spot photos">
              {Array.from({ length: photoCount }).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Show photo ${index + 1}`}
                  aria-pressed={selectedPhotoIndex === index}
                  onClick={() => setSelectedPhotoIndex(index)}
                >
                  <SpotVisual spot={spot} index={index} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="spot-hero-summary">
          <div className="spot-title-block">
            <h1>{spot.title}</h1>
            <p>
              <MapPin aria-hidden="true" />
              {spot.address}
            </p>
            <p className="spot-hero-description">
              {spot.description ||
                "Private parking spot with clear entrance details. Review the location and availability before reserving."}
            </p>
          </div>

          <div className="spot-hero-host">
            <span>{spot.hostUser?.name?.charAt(0).toUpperCase() || "P"}</span>
            <div>
              <small>Hosted by</small>
              <strong>{spot.hostUser?.name || "ParkShare host"}</strong>
              <em>{spot.hostUser?.email || "Verified through ParkShare"}</em>
            </div>
          </div>

          <div className="spot-summary-row">
            <span>
              <Star aria-hidden="true" />
              {ratingLabel}
            </span>
            <strong>{formatPrice(spot.pricePerHour)} / hour</strong>
          </div>
        </div>
      </section>

      <section className="spot-info-layout">
        <article className="spot-info-main">
          <section className="spot-info-section">
            <h2>Location</h2>
            <div className="spot-location-box">
              <MapPin aria-hidden="true" />
              <div>
                <strong>{spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}</strong>
                <span>{spot.address}</span>
              </div>
            </div>
          </section>

          <section className="spot-info-section">
            <h2>Availability</h2>
            <div className="spot-availability-grid">
              <div>
                <span>Spaces</span>
                <strong>{spot.spaceCount ?? 1}</strong>
              </div>
              <div>
                <span>Days</span>
                <strong>{formatAvailabilityDays(spot.availableDays)}</strong>
              </div>
              <div>
                <span>Hours</span>
                <strong>
                  {spot.availableFrom ?? "08:00"} - {spot.availableUntil ?? "20:00"}
                </strong>
              </div>
            </div>
          </section>

          <section className="spot-info-section">
            <h2>Booking notes</h2>
            <div className="spot-notes-grid">
              <div>
                <span>Hold</span>
                <strong>10 minutes before payment</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>Stripe test checkout</strong>
              </div>
              <div>
                <span>Confirmation</span>
                <strong>After successful payment</strong>
              </div>
            </div>
          </section>
        </article>

        <aside className="spot-info-side">
          <section className="spot-booking-panel" aria-label="Booking summary">
            <div className="spot-booking-rate">
              <h2>Hourly rate</h2>
              <strong>{formatPrice(spot.pricePerHour)}</strong>
            </div>
            <div className="spot-reservation-days" aria-label="Choose reservation day">
              {availableDateOptions.map((option) => {
                const label = formatReservationDay(option.date);
                const isSelected = selectedDate === option.date;

                return (
                  <button
                    key={option.date}
                    type="button"
                    className={
                      isSelected
                        ? "spot-day-option spot-day-option-selected"
                        : "spot-day-option"
                    }
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedDate(option.date);
                      setStartTime(option.startTime);
                      setEndTime(option.endTime);
                    }}
                  >
                    <strong>{label.day}</strong>
                    <span>{label.date}</span>
                  </button>
                );
              })}
            </div>
            <div className="spot-reservation-fields spot-reservation-time-grid">
              <label>
                <span>From</span>
                <input
                  type="time"
                  min={spot.availableFrom ?? "08:00"}
                  max={spot.availableUntil ?? "20:00"}
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label>
                <span>Until</span>
                <input
                  type="time"
                  min={spot.availableFrom ?? "08:00"}
                  max={spot.availableUntil ?? "20:00"}
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </div>
            <div className="spot-booking-total">
              <span>{bookingSummary.hours > 0 ? `${bookingSummary.hours.toFixed(1)} hours` : "Choose times"}</span>
              <strong>{formatPrice(bookingSummary.amount)}</strong>
            </div>
            {reservationValidationMessage ? (
              <p className="spot-booking-warning">{reservationValidationMessage}</p>
            ) : null}
            {bookingError ? <p className="spot-booking-error">{bookingError}</p> : null}
            <button
              type="button"
              className="spot-reserve-button"
              onClick={handleReserveNow}
              disabled={!canReserve}
            >
              {isCreatingBooking ? "Creating hold..." : "Reserve now"}
            </button>
          </section>
        </aside>
      </section>

      <section className="spot-reviews">
        <div className="spot-reviews-heading">
          <h2>Reviews</h2>
          <span>{ratingLabel}</span>
        </div>

        {reviews.length > 0 ? (
          <div className="spot-review-grid">
            {reviews.slice(0, 4).map((review) => (
              <article key={review.id} className="spot-review-card">
                <div>
                  <strong>{review.author?.name || "ParkShare driver"}</strong>
                  <span>{ratingToNumber(review.rating)}.0 / 5</span>
                </div>
                <p>{review.comment || "No written comment."}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="spot-review-empty">
            <Star aria-hidden="true" />
            <p>No reviews yet. After completed bookings, driver reviews will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
