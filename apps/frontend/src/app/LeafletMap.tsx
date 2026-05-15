"use client";

import { useEffect, useRef } from "react";

export default function LeafletMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (!mapRef.current) {
      return;
    }

    async function loadMap() {
      if (!mapRef.current) {
        return;
      }

      const L = await import("leaflet");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const map = L.map(mapRef.current, {
        attributionControl: false,
        zoomControl: false,
      }).setView([42.6977, 23.3219], 13);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer(
        prefersDark
          ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
        },
      ).addTo(map);

      L.tileLayer(
        prefersDark
          ? "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
        },
      ).addTo(map);

      cleanup = () => {
        map.remove();
      };
    }

    void loadMap();

    return () => {
      cleanup?.();
    };
  }, []);

  return <div ref={mapRef} className="h-screen w-screen" />;
}
