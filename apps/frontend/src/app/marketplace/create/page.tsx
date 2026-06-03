'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import './create-spot.css';

type ListingForm = {
  title: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  pricePerHour: string;
  photoInput: string;
  photoUrls: string[];
};

type LeafletMapContainer = HTMLDivElement & {
  _leaflet_id?: number;
};

const defaultCenter: [number, number] = [42.6977, 23.3219];

export default function CreateSpotPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const pinRef = useRef<import('leaflet').Marker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formData, setFormData] = useState<ListingForm>({
    title: '',
    description: '',
    address: '',
    latitude: defaultCenter[0].toString(),
    longitude: defaultCenter[1].toString(),
    pricePerHour: '',
    photoInput: '',
    photoUrls: [],
  });

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

      const L = await import('leaflet');

      if (isDisposed || mapContainer._leaflet_id) {
        return;
      }

      const map = L.map(mapContainer, {
        attributionControl: false,
        zoomControl: true,
      }).setView(defaultCenter, 13);

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 },
      ).addTo(map);

      const pin = L.marker(defaultCenter, { draggable: true }).addTo(map);

      function setCoordinates(latitude: number, longitude: number) {
        setFormData((prev) => ({
          ...prev,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
      }

      pin.on('dragend', () => {
        const next = pin.getLatLng();
        setCoordinates(next.lat, next.lng);
      });

      map.on('click', (event) => {
        pin.setLatLng(event.latlng);
        setCoordinates(event.latlng.lat, event.latlng.lng);
      });

      mapInstanceRef.current = map;
      pinRef.current = pin;
    }

    void loadMap();

    return () => {
      isDisposed = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      pinRef.current = null;
    };
  }, []);

  useEffect(() => {
    const latitude = Number(formData.latitude);
    const longitude = Number(formData.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    pinRef.current?.setLatLng([latitude, longitude]);
  }, [formData.latitude, formData.longitude]);

  function handleInputChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleGeolocation() {
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;

        setFormData((prev) => ({
          ...prev,
          latitude: nextLatitude.toFixed(6),
          longitude: nextLongitude.toFixed(6),
        }));
        mapInstanceRef.current?.setView([nextLatitude, nextLongitude], 17);
        setNotice('Location pinned from your device. You can drag the marker to fine tune it.');
      },
      (geoError) => {
        setError(`Geolocation error: ${geoError.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function addPhotoUrl() {
    const nextUrl = formData.photoInput.trim();

    if (!nextUrl) {
      return;
    }

    try {
      const parsed = new URL(nextUrl);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      setError('Photo must be a valid http or https URL.');
      return;
    }

    setError(null);
    setFormData((prev) => ({
      ...prev,
      photoInput: '',
      photoUrls: [...prev.photoUrls, nextUrl].slice(0, 8),
    }));
  }

  function removePhotoUrl(url: string) {
    setFormData((prev) => ({
      ...prev,
      photoUrls: prev.photoUrls.filter((photoUrl) => photoUrl !== url),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const accessToken = localStorage.getItem('parkshare_access_token');

      if (!accessToken) {
        throw new Error('Please log in as a host before creating a listing.');
      }

      const latitude = Number(formData.latitude);
      const longitude = Number(formData.longitude);
      const price = Number(formData.pricePerHour);

      if (!formData.title.trim() || !formData.address.trim()) {
        throw new Error('Title and address are required.');
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Choose a valid location on the map or enter exact coordinates.');
      }

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Price must be greater than 0.');
      }

      if (formData.photoUrls.length === 0) {
        throw new Error('Add at least one photo URL so admins can verify the space.');
      }

      const response = await fetch('/api/v1/spots', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          address: formData.address.trim(),
          latitude,
          longitude,
          pricePerHour: Math.round(price * 100),
          photoUrls: formData.photoUrls,
        }),
      });

      const payload = (await response.json()) as
        | { id: string }
        | { message?: string | string[] };

      if (!response.ok) {
        const message = 'message' in payload ? payload.message : undefined;
        throw new Error(
          Array.isArray(message)
            ? message.join(' ')
            : message || 'Failed to create spot.',
        );
      }

      const newSpot = payload as { id: string };
      router.push(`/marketplace/${newSpot.id}?created=pending`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="create-spot-shell">
      <section className="create-spot-hero">
        <Link href="/" className="create-spot-back">
          Back to map
        </Link>
        <div>
          <p className="create-spot-eyebrow">Host listing</p>
          <h1>List your garage with a precise map pin</h1>
          <p>
            Add the details drivers need, pin the exact entrance, and include photos
            for admin verification before the spot appears publicly.
          </p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="create-spot-layout">
        <section className="create-spot-panel">
          {error ? <div className="listing-alert listing-alert-error">{error}</div> : null}
          {notice ? <div className="listing-alert listing-alert-info">{notice}</div> : null}

          <div className="form-section">
            <h2>Spot details</h2>
            <label className="form-group" htmlFor="title">
              <span>Listing title</span>
              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Covered garage near NDK"
                required
              />
            </label>

            <label className="form-group" htmlFor="description">
              <span>Description</span>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Mention gate access, ceiling height, lighting, security, and nearby landmarks."
                rows={5}
              />
            </label>
          </div>

          <div className="form-section">
            <h2>Location</h2>
            <label className="form-group" htmlFor="address">
              <span>Address</span>
              <input
                id="address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Street, number, city"
                required
              />
            </label>

            <div className="listing-map-picker" ref={mapRef} aria-label="Choose spot location" />

            <div className="coordinates-group">
              <label className="form-group" htmlFor="latitude">
                <span>Latitude</span>
                <input
                  id="latitude"
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  step="0.000001"
                  required
                />
              </label>
              <label className="form-group" htmlFor="longitude">
                <span>Longitude</span>
                <input
                  id="longitude"
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  step="0.000001"
                  required
                />
              </label>
            </div>

            <button type="button" onClick={handleGeolocation} className="secondary-action">
              Use my current location
            </button>
          </div>
        </section>

        <aside className="create-spot-panel create-spot-side">
          <div className="form-section">
            <h2>Pricing</h2>
            <label className="form-group" htmlFor="pricePerHour">
              <span>Price per hour</span>
              <input
                id="pricePerHour"
                type="number"
                name="pricePerHour"
                value={formData.pricePerHour}
                onChange={handleInputChange}
                placeholder="5.00"
                step="0.01"
                min="0.01"
                required
              />
            </label>
          </div>

          <div className="form-section">
            <h2>Photos</h2>
            <div className="photo-url-row">
              <label className="form-group" htmlFor="photoInput">
                <span>Photo URL</span>
                <input
                  id="photoInput"
                  type="url"
                  name="photoInput"
                  value={formData.photoInput}
                  onChange={handleInputChange}
                  placeholder="https://..."
                />
              </label>
              <button type="button" onClick={addPhotoUrl} className="secondary-action">
                Add
              </button>
            </div>

            {formData.photoUrls.length > 0 ? (
              <div className="photo-preview-grid">
                {formData.photoUrls.map((url) => (
                  <figure key={url} className="photo-preview">
                    <img src={url} alt="Parking spot preview" />
                    <button type="button" onClick={() => removePhotoUrl(url)}>
                      Remove
                    </button>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="form-hint">Add real photos of the entrance, parking bay, and access gate.</p>
            )}
          </div>

          <div className="verification-note">
            <strong>Admin verification</strong>
            <p>
              New listings are saved as pending. An admin should check the address,
              coordinates, photos, and host details before marking the spot verified.
            </p>
          </div>

          <div className="form-actions">
            <Link href="/" className="cancel-btn">
              Cancel
            </Link>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit for verification'}
            </button>
          </div>
        </aside>
      </form>
    </main>
  );
}
