"use client";

import { useEffect, useRef, useState } from "react";

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

type PaymentMessage = {
  tone: "success" | "warning";
  title: string;
  copy: string;
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

  return null;
}

export default function LeafletMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRefs = useRef<import("leaflet").TileLayer[]>([]);
  const [theme, setTheme] = useState<MapTheme>("light");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
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
    readInitialPaymentMessage,
  );

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

    if (params.has("payment")) {
      params.delete("payment");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

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
