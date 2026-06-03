"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Car, CheckCircle2, Clock, MapPin, ShieldCheck, Star } from "lucide-react";
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
};

type ApiErrorResponse = {
  message?: string | string[];
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
      return "New listing";
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
            <SpotVisual spot={spot} index={0} />
          </div>
          <div className="spot-info-gallery-strip">
            <SpotVisual spot={spot} index={1} />
            <SpotVisual spot={spot} index={2} />
          </div>
        </div>

        <aside className="spot-booking-panel" aria-label="Booking summary">
          <div>
            <span>Hourly rate</span>
            <strong>{formatPrice(spot.pricePerHour)}</strong>
          </div>
          <p>Choose this spot in reservations to create a hold and continue to Stripe checkout.</p>
          <Link href="/bookings">Reserve now</Link>
        </aside>
      </section>

      <section className="spot-info-layout">
        <article className="spot-info-main">
          <div className="spot-title-block">
            <h1>{spot.title}</h1>
            <p>
              <MapPin aria-hidden="true" />
              {spot.address}
            </p>
          </div>

          <div className="spot-info-facts" aria-label="Spot facts">
            <span>
              <Star aria-hidden="true" />
              {ratingLabel}
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              Admin verified
            </span>
            <span>
              <Car aria-hidden="true" />
              Private garage
            </span>
          </div>

          <section className="spot-info-section">
            <h2>About this spot</h2>
            <p>
              {spot.description ||
                "Private parking spot with clear entrance details. Review the location and availability before reserving."}
            </p>
          </section>

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
        </article>

        <aside className="spot-info-side">
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

          <section>
            <h2>Good to know</h2>
            <ul className="spot-info-list">
              <li>
                <CheckCircle2 aria-hidden="true" />
                Admin verification required before public bookings
              </li>
              <li>
                <Clock aria-hidden="true" />
                Booking holds expire before payment
              </li>
              <li>
                <Calendar aria-hidden="true" />
                Confirmed bookings block unavailable times
              </li>
            </ul>
          </section>
        </aside>
      </section>
    </main>
  );
}
