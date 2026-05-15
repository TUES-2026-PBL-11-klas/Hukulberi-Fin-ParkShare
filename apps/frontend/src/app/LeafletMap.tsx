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
      const map = L.map(mapRef.current).setView([42.6977, 23.3219], 13);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

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
