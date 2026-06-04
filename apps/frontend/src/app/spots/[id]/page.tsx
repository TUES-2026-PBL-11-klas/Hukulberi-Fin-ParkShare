"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
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
  const params = useParams<{ id: string }>();
  const spotId = params.id;
  const [spot, setSpot] = useState<SpotDetails | null>(() => {
    return mockGarages.find((garage) => garage.id === spotId) ?? null;
  });
  const [isLoading, setIsLoading] = useState(!spot);
  const [error, setError] = useState("");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

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

  const ratingLabel = useMemo(() => {
    if (!spot?.averageRating || !spot.reviewCount) {
      return "No reviews yet";
    }

    return `${spot.averageRating.toFixed(1)} (${spot.reviewCount} reviews)`;
  }, [spot]);

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
        </article>

        <aside className="spot-info-side">
          <section className="spot-booking-panel" aria-label="Booking summary">
            <div className="spot-booking-rate">
              <h2>Hourly rate</h2>
              <strong>{formatPrice(spot.pricePerHour)}</strong>
            </div>
            <p>Reservation checkout is being connected to the new spot flow.</p>
            <button type="button" disabled>
              Reserve now
            </button>
          </section>

          <section>
            <h2>Host</h2>
            <div className="spot-host-card">
              <span>{spot.hostUser?.name?.charAt(0).toUpperCase() || "P"}</span>
              <div>
                <strong>{spot.hostUser?.name || "ParkShare host"}</strong>
                <small>{spot.hostUser?.email || "Verified through ParkShare"}</small>
              </div>
            </div>
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
