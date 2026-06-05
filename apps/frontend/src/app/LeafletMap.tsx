"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type MapTheme = "light" | "dark";
type AuthMode = "login" | "signup";
type MapSpot = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  pricePerHour: number;
  spaceCount?: number;
  availableSpaces?: number;
  availableDays?: string[];
  availableFrom?: string;
  availableUntil?: string;
  description?: string;
  photoUrls?: string[];
  hostUser?: {
    id?: string;
    name: string;
    email?: string;
  };
  averageRating?: number;
  reviewCount?: number;
};
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

type SpotSearchResponse = {
  data?: MapSpot[];
};

type PaymentMessage = {
  tone: "success" | "warning";
  title: string;
  copy: string;
};

type LeafletMapContainer = HTMLDivElement & {
  _leaflet_id?: number;
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const tileLayers = {
  light: {
    base: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    labels:
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  },
  dark: {
    base: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    labels:
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
  },
} satisfies Record<MapTheme, { base: string; labels: string }>;

const transparentTileUrl =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function getAvailableSpaces(spot: MapSpot): number {
  return Math.max(spot.availableSpaces ?? spot.spaceCount ?? 1, 0);
}

function formatAvailableSpaces(availableSpaces: number): string {
  if (availableSpaces === 0) {
    return "Fully reserved right now";
  }

  if (availableSpaces === 1) {
    return "1 space available now";
  }

  return `${availableSpaces} spaces available now`;
}

function readInitialPaymentMessage(): PaymentMessage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get("payment");

  if (paymentStatus === "success") {
    return {
      tone: "success",
      title: "Payment completed",
      copy: "Stripe accepted the test payment. The webhook will confirm it on the backend.",
    };
  }

  if (paymentStatus === "cancel") {
    return {
      tone: "warning",
      title: "Checkout canceled",
      copy: "No payment was taken. You can start another Stripe test payment when ready.",
    };
  }

  if (params.get("listing") === "pending") {
    return {
      tone: "success",
      title: "Listing submitted",
      copy: "Your parking spot is waiting for admin verification.",
    };
  }

  return null;
}

export default function LeafletMap() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRefs = useRef<import("leaflet").TileLayer[]>([]);
  const tileThemeRef = useRef<MapTheme>("light");
  const spotMarkerRefs = useRef<import("leaflet").Marker[]>([]);
  const [theme, setTheme] = useState<MapTheme>("light");
  const [isMapReady, setIsMapReady] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [garageSearch, setGarageSearch] = useState("");
  const [mapSpots, setMapSpots] = useState<MapSpot[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<PaymentMessage | null>(
    null,
  );

  const loadSpotMarkers = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots?limit=100`, {
        cache: "no-store",
      });

      if (!response.ok) {
        setMapSpots([]);
        return;
      }

      const payload = (await response.json()) as SpotSearchResponse;
      const backendSpots = payload.data ?? [];
      const validBackendSpots = backendSpots.filter(
        (spot) =>
          Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude),
      );

      setMapSpots(validBackendSpots);
    } catch {
      // Map markers are helpful, but the map itself should stay usable offline.
      setMapSpots([]);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    let isDisposed = false;
    const mapContainer = mapRef.current as LeafletMapContainer;

    async function loadMap() {
      if (!mapContainer || mapContainer._leaflet_id) {
        return;
      }

      const L = await import("leaflet");

      if (isDisposed || mapInstanceRef.current || mapContainer._leaflet_id) {
        return;
      }

      leafletRef.current = L;
      const map = L.map(mapContainer, {
        attributionControl: false,
        zoomControl: false,
      }).setView([42.6977, 23.3219], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInstanceRef.current = map;

      tileLayerRefs.current = [
        L.tileLayer(tileLayers.light.base, {
          maxZoom: 19,
          errorTileUrl: transparentTileUrl,
        }).addTo(map),
        L.tileLayer(tileLayers.light.labels, {
          maxZoom: 19,
          errorTileUrl: transparentTileUrl,
        }).addTo(map),
      ];
      setIsMapReady(true);
    }

    void loadMap();

    return () => {
      isDisposed = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      tileLayerRefs.current = [];
      spotMarkerRefs.current = [];
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    if (!L || !map) {
      return;
    }

    if (tileThemeRef.current === theme) {
      return;
    }

    const previousLayers = tileLayerRefs.current;
    let settledTiles = 0;
    let didSwapLayers = false;

    const nextLayers = [
      L.tileLayer(tileLayers[theme].base, {
        maxZoom: 19,
        opacity: 0,
        errorTileUrl: transparentTileUrl,
      }).addTo(map),
      L.tileLayer(tileLayers[theme].labels, {
        maxZoom: 19,
        opacity: 0,
        errorTileUrl: transparentTileUrl,
      }).addTo(map),
    ];

    function swapLayers() {
      if (didSwapLayers) {
        return;
      }

      didSwapLayers = true;
      nextLayers.forEach((layer) => layer.setOpacity(1));
      previousLayers.forEach((layer) => layer.remove());
      tileLayerRefs.current = nextLayers;
      tileThemeRef.current = theme;
    }

    nextLayers.forEach((layer) => {
      layer.once("load tileerror", () => {
        settledTiles += 1;

        if (settledTiles >= nextLayers.length) {
          swapLayers();
        }
      });
    });

    const fallbackTimer = window.setTimeout(swapLayers, 2200);

    return () => {
      window.clearTimeout(fallbackTimer);
      nextLayers.forEach((layer) => {
        if (!didSwapLayers) {
          layer.remove();
        }
      });
    };
  }, [theme]);

  useEffect(() => {
    if (!isMapReady) {
      return;
    }

    const initialRefresh = window.setTimeout(() => {
      void loadSpotMarkers();
    }, 0);

    const refreshTimer = window.setInterval(() => {
      void loadSpotMarkers();
    }, 10000);

    window.addEventListener("focus", loadSpotMarkers);

    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", loadSpotMarkers);
    };
  }, [isMapReady, loadSpotMarkers]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    if (!L || !map || !isMapReady) {
      return;
    }

    spotMarkerRefs.current.forEach((marker) => marker.remove());
    spotMarkerRefs.current = mapSpots.map((spot) => {
      const availableSpaces = getAvailableSpaces(spot);
      const reserveAction =
        availableSpaces > 0
          ? `<a href="/spots/${encodeURIComponent(spot.id)}">Reserve now</a>`
          : '<span class="garage-popup-full">Fully reserved</span>';
      const marker = L.marker([spot.latitude, spot.longitude], {
        icon: L.divIcon({
          className: "parkshare-map-marker",
          html: '<span aria-hidden="true"></span>',
          iconSize: [34, 42],
          iconAnchor: [17, 40],
          popupAnchor: [0, -36],
        }),
      }).addTo(map);

      marker.bindPopup(
        `
          <div class="garage-popup">
            <strong>${escapeHtml(spot.title)}</strong>
            <span>${escapeHtml(spot.address)}</span>
            <em>${(spot.pricePerHour / 100).toFixed(2)} EUR / hour</em>
            <small>${escapeHtml(formatAvailableSpaces(availableSpaces))}</small>
            <div>
              ${reserveAction}
            </div>
          </div>
        `,
        { closeButton: true, maxWidth: 260 },
      );

      marker.on("mouseover", () => marker.openPopup());
      return marker;
    });

    return () => {
      spotMarkerRefs.current.forEach((marker) => marker.remove());
      spotMarkerRefs.current = [];
    };
  }, [isMapReady, mapSpots]);
  useEffect(() => {
    const accessToken = localStorage.getItem("parkshare_access_token");

    if (!accessToken) {
      return;
    }

    async function loadCurrentUser() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
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
    const params = new URLSearchParams(window.location.search);
    const initialPaymentMessage = readInitialPaymentMessage();

    if (initialPaymentMessage) {
      queueMicrotask(() => setPaymentMessage(initialPaymentMessage));
    }

    if (params.has("payment") || params.has("listing")) {
      params.delete("payment");
      params.delete("listing");
      const queryString = params.toString();
      const replacementUrl = `${window.location.pathname}${
        queryString ? `?${queryString}` : ""
      }${window.location.hash}`;
      window.history.replaceState(null, "", replacementUrl);
    }
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const normalizedGarageSearch = garageSearch.trim().toLowerCase();
  const visibleGarageResults = normalizedGarageSearch
    ? mapSpots
        .filter((spot) =>
          `${spot.title} ${spot.address}`
            .toLowerCase()
            .includes(normalizedGarageSearch),
        )
        .slice(0, 8)
    : mapSpots.slice(0, 3);

  function openAuth(mode: AuthMode) {
    setIsProfileMenuOpen(false);
    setAuthMode(mode);
    setAuthMessage("");
    setAuthError("");
    setIsAuthOpen(true);
  }

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");
    setAuthError("");

    if (authMode === "signup" && authPassword !== authConfirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/auth/${authMode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          authMode === "signup"
            ? {
                name: authName,
                email: authEmail,
                password: authPassword,
              }
            : {
                email: authEmail,
                password: authPassword,
              },
        ),
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
          ? "Account created. You are signed in."
          : "You are signed in.",
      );
      setIsAuthOpen(false);
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

  function handleSignOut() {
    localStorage.removeItem("parkshare_access_token");
    setCurrentUser(null);
    setIsProfileMenuOpen(false);
    setIsAuthOpen(false);
    setAuthPassword("");
    setAuthConfirmPassword("");
    setAuthMessage("");
    setAuthError("");
  }

  return (
    <div className="relative h-screen w-screen" data-map-theme={theme}>
      <div ref={mapRef} className="h-full w-full" />
      <nav className="map-primary-actions" aria-label="Map actions">
        <button
          type="button"
          className="map-primary-action"
          aria-expanded={isSearchOpen}
          onClick={() => {
            setIsSearchOpen((isOpen) => !isOpen);
            setGarageSearch("");
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span>Search</span>
        </button>
        <button
          type="button"
          className="map-primary-action"
          onClick={() => router.push("/reservations")}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect x="4" y="5" width="16" height="16" rx="3" />
            <path d="M4 10h16" />
            <path d="M8 15h3" />
            <path d="M14 15h2" />
          </svg>
          <span>Reservations</span>
        </button>
        <button
          type="button"
          className="map-primary-action"
          onClick={() => router.push("/marketplace/create")}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M4 20V9.5L12 4l8 5.5V20" />
            <path d="M8 20v-7h8v7" />
            <path d="M8 16h8" />
          </svg>
          <span>List garage</span>
        </button>
      </nav>
      {isSearchOpen ? (
        <section className="map-search-panel" aria-label="Garage search">
          <label className="map-search-field">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Search garages by name"
              value={garageSearch}
              onChange={(event) => setGarageSearch(event.target.value)}
              autoFocus
            />
          </label>
          <div className="map-search-results">
            {visibleGarageResults.length > 0 ? (
              visibleGarageResults.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  className="map-search-result"
                  onClick={() => {
                    setIsSearchOpen(false);
                    setGarageSearch("");
                    router.push(`/spots/${encodeURIComponent(spot.id)}`);
                  }}
                >
                  <span>
                    <strong>{spot.title}</strong>
                    <small>{spot.address}</small>
                  </span>
                  <b>{(spot.pricePerHour / 100).toFixed(2)} EUR/h</b>
                </button>
              ))
            ) : (
              <p className="map-search-empty">No garages match that search.</p>
            )}
          </div>
        </section>
      ) : null}
      {paymentMessage ? (
        <section
          className={`map-payment-toast map-payment-toast-${paymentMessage.tone}`}
          role="status"
          aria-live="polite"
        >
          <div>
            <strong>{paymentMessage.title}</strong>
            <span>{paymentMessage.copy}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss payment message"
            onClick={() => setPaymentMessage(null)}
          >
            x
          </button>
        </section>
      ) : null}
      <button
        type="button"
        className="map-profile-button"
        aria-label="Open profile menu"
        aria-expanded={isProfileMenuOpen}
        onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      </button>
      {isProfileMenuOpen ? (
        <div className="map-profile-menu">
          {currentUser ? (
            <>
              <button type="button">Signed in as {currentUser.name}</button>
              <button type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => openAuth("signup")}>
                Sign up
              </button>
              <button type="button" onClick={() => openAuth("login")}>
                Log in
              </button>
            </>
          )}
        </div>
      ) : null}
      {isAuthOpen ? (
        <div className="auth-backdrop">
          <section
            className="auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              type="button"
              className="auth-close-button"
              aria-label="Close authentication dialog"
              onClick={() => setIsAuthOpen(false)}
            >
              x
            </button>
            <div className="auth-mode-tabs" aria-label="Authentication mode">
              <button
                type="button"
                aria-pressed={authMode === "login"}
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
                onClick={() => {
                  setAuthMode("signup");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                Sign up
              </button>
            </div>
            <div>
              <h2 id="auth-title">
                {authMode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p>
                {authMode === "login"
                  ? "Log in to reserve parking spots and manage bookings."
                  : "Join ParkShare to book spots or list your own parking space."}
              </p>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" ? (
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    required
                  />
                </label>
              ) : null}
              <label>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                  placeholder="Your password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>
              {authMode === "signup" ? (
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={authConfirmPassword}
                    onChange={(event) =>
                      setAuthConfirmPassword(event.target.value)
                    }
                    minLength={6}
                    required
                  />
                </label>
              ) : null}
              {authError ? <p className="auth-error">{authError}</p> : null}
              {authMessage ? (
                <p className="auth-success">{authMessage}</p>
              ) : null}
              <button type="submit" disabled={isAuthSubmitting}>
                {isAuthSubmitting
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Log in"
                    : "Create account"}
              </button>
            </form>
            <p className="auth-switch-copy">
              {authMode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                {authMode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </section>
        </div>
      ) : null}
      <button
        type="button"
        className="map-theme-toggle"
        aria-label={`Switch to ${nextTheme} map theme`}
        onClick={() => setTheme(nextTheme)}
      >
        {theme === "dark" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M20.8 13.7A8.5 8.5 0 0 1 10.3 3.2 7 7 0 1 0 20.8 13.7Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
