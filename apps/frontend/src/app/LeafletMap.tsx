"use client";

import { useEffect, useRef, useState } from "react";

type MapTheme = "light" | "dark";
type AuthMode = "login" | "signup";

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

export default function LeafletMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRefs = useRef<import("leaflet").TileLayer[]>([]);
  const [theme, setTheme] = useState<MapTheme>("light");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) {
      return;
    }

    async function loadMap() {
      if (!mapRef.current) {
        return;
      }

      const L = await import("leaflet");
      leafletRef.current = L;
      const map = L.map(mapRef.current, {
        attributionControl: false,
        zoomControl: false,
      }).setView([42.6977, 23.3219], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapInstanceRef.current = map;

      tileLayerRefs.current = [
        L.tileLayer(tileLayers.light.base, { maxZoom: 19 }).addTo(map),
        L.tileLayer(tileLayers.light.labels, { maxZoom: 19 }).addTo(map),
      ];
    }

    void loadMap();

    return () => {
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      tileLayerRefs.current = [];
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    if (!L || !map) {
      return;
    }

    tileLayerRefs.current.forEach((layer) => layer.remove());
    tileLayerRefs.current = [
      L.tileLayer(tileLayers[theme].base, { maxZoom: 19 }).addTo(map),
      L.tileLayer(tileLayers[theme].labels, { maxZoom: 19 }).addTo(map),
    ];
  }, [theme]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  function openAuth(mode: AuthMode) {
    setIsProfileMenuOpen(false);
    setAuthMode(mode);
    setIsAuthOpen(true);
  }

  return (
    <div className="relative h-screen w-screen" data-map-theme={theme}>
      <div ref={mapRef} className="h-full w-full" />
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
          <button type="button" onClick={() => openAuth("signup")}>
            Sign up
          </button>
          <button type="button" onClick={() => openAuth("login")}>
            Log in
          </button>
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
                onClick={() => setAuthMode("login")}
              >
                Log in
              </button>
              <button
                type="button"
                aria-pressed={authMode === "signup"}
                onClick={() => setAuthMode("signup")}
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
            <form className="auth-form">
              {authMode === "signup" ? (
                <label>
                  <span>Username</span>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="parkshare_user"
                  />
                </label>
              ) : null}
              <label>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
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
                />
              </label>
              {authMode === "signup" ? (
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                  />
                </label>
              ) : null}
              <button type="button">
                {authMode === "login" ? "Log in" : "Create account"}
              </button>
            </form>
            <p className="auth-switch-copy">
              {authMode === "login"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() =>
                  setAuthMode(authMode === "login" ? "signup" : "login")
                }
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
