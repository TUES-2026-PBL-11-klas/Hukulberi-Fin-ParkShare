'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './create-spot.css';

export default function CreateSpotPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useGeolocation, setUseGeolocation] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    pricePerHour: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          }));
          setUseGeolocation(true);
        },
        (error) => {
          setError(`Geolocation error: ${error.message}`);
        },
      );
    } else {
      setError('Geolocation is not supported by your browser');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim() || !formData.address.trim() || !formData.pricePerHour) {
        throw new Error('Please fill in all required fields');
      }

      if (isNaN(Number(formData.latitude)) || isNaN(Number(formData.longitude))) {
        throw new Error('Invalid coordinates');
      }

      if (isNaN(Number(formData.pricePerHour)) || Number(formData.pricePerHour) < 0) {
        throw new Error('Price must be a valid positive number');
      }

      const response = await fetch('/api/v1/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          address: formData.address,
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          pricePerHour: Math.round(parseFloat(formData.pricePerHour) * 100), // Convert to cents
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create spot');
      }

      const newSpot = await response.json();
      router.push(`/marketplace/${newSpot.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-spot-container">
      <div className="create-spot-form-wrapper">
        <div className="form-header">
          <h1>Create a Parking Spot</h1>
          <p>List your parking space and start earning</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="create-spot-form">
          {/* Title */}
          <div className="form-section">
            <h2>Spot Details</h2>

            <div className="form-group">
              <label htmlFor="title">Spot Title *</label>
              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Covered parking near downtown"
                className="form-input"
                required
              />
              <p className="form-hint">Make it descriptive and catchy</p>
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Tell guests what makes your spot special (e.g., covered, 24/7 access, well-lit, near transit)"
                className="form-textarea"
                rows={5}
              />
              <p className="form-hint">Optional but recommended</p>
            </div>
          </div>

          {/* Location */}
          <div className="form-section">
            <h2>Location</h2>

            <div className="form-group">
              <label htmlFor="address">Address *</label>
              <input
                id="address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Full address"
                className="form-input"
                required
              />
            </div>

            {/* Coordinates */}
            <div className="coordinates-group">
              <div className="form-group">
                <label htmlFor="latitude">Latitude *</label>
                <input
                  id="latitude"
                  type="number"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleInputChange}
                  placeholder="e.g., 40.7128"
                  step="0.0001"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="longitude">Longitude *</label>
                <input
                  id="longitude"
                  type="number"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleInputChange}
                  placeholder="e.g., -74.0060"
                  step="0.0001"
                  className="form-input"
                  required
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeolocation}
              className="geolocation-btn-form"
            >
              📍 Use My Current Location
            </button>
            {useGeolocation && <p className="form-hint success">✓ Coordinates updated</p>}
          </div>

          {/* Pricing */}
          <div className="form-section">
            <h2>Pricing</h2>

            <div className="form-group">
              <label htmlFor="pricePerHour">Price per Hour ($) *</label>
              <input
                id="pricePerHour"
                type="number"
                name="pricePerHour"
                value={formData.pricePerHour}
                onChange={handleInputChange}
                placeholder="e.g., 15.50"
                step="0.01"
                min="0"
                className="form-input"
                required
              />
              <p className="form-hint">Set competitive rates to attract more bookings</p>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <Link href="/marketplace" className="cancel-btn">
              Cancel
            </Link>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Creating...' : 'Create Spot'}
            </button>
          </div>
        </form>
      </div>

      {/* Info Panel */}
      <aside className="create-spot-info">
        <div className="info-card">
          <h3>Tips for Success</h3>
          <ul>
            <li>
              <strong>Be descriptive:</strong> Include details like covered/uncovered, lighting, security, etc.
            </li>
            <li>
              <strong>Accurate location:</strong> Guests rely on accurate coordinates
            </li>
            <li>
              <strong>Competitive pricing:</strong> Check similar spots in your area
            </li>
            <li>
              <strong>Complete profile:</strong> A verified host photo increases bookings
            </li>
            <li>
              <strong>Quick response:</strong> Reply to guest messages within 2 hours
            </li>
          </ul>
        </div>

        <div className="info-card">
          <h3>What You&apos;ll Earn</h3>
          <p className="earning-example">
            At <strong>$15/hour</strong>, a single 2-hour booking = <strong>$30</strong> (minus 15% fee)
          </p>
          <p className="earning-note">We handle payment processing. You get paid within 48 hours of booking completion.</p>
        </div>
      </aside>
    </div>
  );
}
