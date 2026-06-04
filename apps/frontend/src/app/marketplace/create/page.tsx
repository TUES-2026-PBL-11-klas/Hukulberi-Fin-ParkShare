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
  spaceCount: string;
  availableDays: string[];
  availableFrom: string;
  availableUntil: string;
  photoUrls: string[];
};

type LeafletMapContainer = HTMLDivElement & {
  _leaflet_id?: number;
};

const defaultCenter: [number, number] = [42.6977, 23.3219];
const maxPhotos = 6;
const maxPhotoSizeBytes = 4_000_000;
const photoMaxSidePx = 1200;
const photoQuality = 0.74;
const weekDays = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
];

export default function CreateSpotPage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const pinRef = useRef<import('leaflet').Marker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ListingForm>({
    title: '',
    description: '',
    address: '',
    latitude: defaultCenter[0].toString(),
    longitude: defaultCenter[1].toString(),
    pricePerHour: '',
    spaceCount: '1',
    availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    availableFrom: '08:00',
    availableUntil: '20:00',
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
        zoomControl: false,
      }).setView(defaultCenter, 13);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 },
      ).addTo(map);

      const pinIcon = L.divIcon({
        className: 'listing-pin-icon',
        html: '<span aria-hidden="true"></span>',
        iconSize: [42, 50],
        iconAnchor: [21, 48],
      });

      const pin = L.marker(defaultCenter, {
        draggable: true,
        icon: pinIcon,
      }).addTo(map);

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

  function toggleAvailableDay(day: string) {
    setFormData((prev) => {
      const isSelected = prev.availableDays.includes(day);
      const nextDays = isSelected
        ? prev.availableDays.filter((availableDay) => availableDay !== day)
        : [...prev.availableDays, day];

      return {
        ...prev,
        availableDays: weekDays
          .map((weekDay) => weekDay.value)
          .filter((weekDay) => nextDays.includes(weekDay)),
      };
    });
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
      },
      (geoError) => {
        setError(`Geolocation error: ${geoError.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handlePhotoFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    const remainingSlots = maxPhotos - formData.photoUrls.length;

    if (remainingSlots <= 0) {
      setError(`You can add up to ${maxPhotos} photos.`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    const invalidFile = selectedFiles.find(
      (file) => !file.type.startsWith('image/') || file.size > maxPhotoSizeBytes,
    );

    if (invalidFile) {
      setError('Choose image files under 1.2 MB each.');
      return;
    }

    const dataUrls = await Promise.all(selectedFiles.map(compressImageFile));

    setError(null);
    setFormData((prev) => ({
      ...prev,
      photoUrls: [...prev.photoUrls, ...dataUrls].slice(0, maxPhotos),
    }));
  }

  async function compressImageFile(file: File): Promise<string> {
    const imageUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error('Could not read image file.'));
        nextImage.src = imageUrl;
      });

      const scale = Math.min(
        1,
        photoMaxSidePx / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not prepare image preview.');
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/jpeg', photoQuality);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
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

    try {
      const accessToken = localStorage.getItem('parkshare_access_token');

      if (!accessToken) {
        throw new Error('Please log in as a host before creating a listing.');
      }

      const latitude = Number(formData.latitude);
      const longitude = Number(formData.longitude);
      const price = Number(formData.pricePerHour);
      const spaceCount = Number(formData.spaceCount);

      if (!formData.title.trim() || !formData.address.trim()) {
        throw new Error('Title and address are required.');
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Choose a valid location on the map or enter exact coordinates.');
      }

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Price must be greater than 0.');
      }

      if (!Number.isInteger(spaceCount) || spaceCount < 1) {
        throw new Error('Spaces available must be at least 1.');
      }

      if (formData.availableDays.length === 0) {
        throw new Error('Choose at least one available day.');
      }

      if (formData.availableFrom >= formData.availableUntil) {
        throw new Error('Available from time must be earlier than available until time.');
      }

      if (formData.photoUrls.length === 0) {
        throw new Error('Add at least one photo so admins can verify the space.');
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
          spaceCount,
          availableDays: formData.availableDays,
          availableFrom: formData.availableFrom,
          availableUntil: formData.availableUntil,
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

      router.push('/?listing=pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="create-spot-shell">
      <form onSubmit={handleSubmit} className="listing-workspace">
        <div className="listing-map-picker" ref={mapRef} aria-label="Choose spot location" />

        <header className="listing-topbar">
          <Link href="/" className="create-spot-back">
            Back
          </Link>
          <h1>Create parking listing</h1>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </header>

        {error ? <div className="listing-alert listing-alert-error">{error}</div> : null}

        <aside className="listing-drawer">
          <section className="form-section">
            <h2>Spot</h2>
            <label className="form-group" htmlFor="title">
              <span>Title</span>
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
                placeholder="Gate access, ceiling height, lighting, landmarks"
                rows={4}
              />
            </label>

            <div className="drawer-row">
              <label className="form-group" htmlFor="pricePerHour">
                <span>EUR / hour</span>
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
              <button type="button" onClick={handleGeolocation} className="secondary-action">
                Locate
              </button>
            </div>
          </section>

          <section className="form-section">
            <h2>Availability</h2>
            <label className="form-group" htmlFor="spaceCount">
              <span>Spaces available</span>
              <input
                id="spaceCount"
                type="number"
                name="spaceCount"
                value={formData.spaceCount}
                onChange={handleInputChange}
                min="1"
                step="1"
                required
              />
            </label>

            <div className="form-group">
              <span>Days</span>
              <div className="day-chip-grid" aria-label="Available days">
                {weekDays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={
                      formData.availableDays.includes(day.value)
                        ? 'day-chip day-chip-selected'
                        : 'day-chip'
                    }
                    aria-pressed={formData.availableDays.includes(day.value)}
                    onClick={() => toggleAvailableDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="time-grid">
              <label className="form-group" htmlFor="availableFrom">
                <span>From</span>
                <input
                  id="availableFrom"
                  type="time"
                  name="availableFrom"
                  value={formData.availableFrom}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label className="form-group" htmlFor="availableUntil">
                <span>Until</span>
                <input
                  id="availableUntil"
                  type="time"
                  name="availableUntil"
                  value={formData.availableUntil}
                  onChange={handleInputChange}
                  required
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>Entrance</h2>
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

            <div className="coordinate-grid">
              <label className="form-group" htmlFor="latitude">
                <span>Lat</span>
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
                <span>Lng</span>
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
          </section>
        </aside>

        <section className="photo-rail" aria-label="Parking spot photos">
          <label className="photo-upload" htmlFor="photoFiles">
            <input
              id="photoFiles"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handlePhotoFiles}
            />
            <span className="photo-upload-icon" aria-hidden="true"></span>
            <strong>Add photos</strong>
            <small>PNG, JPG, or WebP</small>
          </label>

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
          ) : null}
        </section>
      </form>
    </main>
  );
}
