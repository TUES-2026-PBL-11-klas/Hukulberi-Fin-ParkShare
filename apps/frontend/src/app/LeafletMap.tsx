"use client";

import { useEffect, useRef, useState } from "react";

type MapTheme = "light" | "dark";

const tileLayers = {
  light: {
    base: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
  },
  dark: {
    base: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    labels: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
  },
} satisfies Record<MapTheme, { base: string; labels: string }>;

export default function LeafletMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const tileLayerRefs = useRef<import("leaflet").TileLayer[]>([]);
  const [theme, setTheme] = useState<MapTheme>("light");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

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
          <button type="button">Sign up</button>
          <button type="button">Log in</button>
        </div>
      ) : null}
      <button
        type="button"
        className="map-theme-toggle"
        aria-label={`Switch to ${nextTheme} map theme`}
        onClick={() => setTheme(nextTheme)}
      >
        <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      </button>
    </div>
  );
}
