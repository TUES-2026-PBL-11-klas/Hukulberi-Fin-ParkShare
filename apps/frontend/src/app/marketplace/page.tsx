'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MapPin, Star, DollarSign } from 'lucide-react';
import './marketplace.css';

interface Spot {
  id: string;
  title: string;
  address: string;
  description?: string;
  pricePerHour: number;
  latitude: number;
  longitude: number;
  averageRating: number;
  reviewCount: number;
  hostUser: {
    id: string;
    name: string;
  };
}

interface SearchFilters {
  search?: string;
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}

export default function MarketplacePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const LIMIT = 12;

  // Fetch spots on component mount and when filters change
  const fetchSpots = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.latitude) params.append('latitude', filters.latitude.toString());
      if (filters.longitude) params.append('longitude', filters.longitude.toString());
      if (filters.radiusKm) params.append('radiusKm', filters.radiusKm.toString());
      params.append('limit', LIMIT.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/v1/spots?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch spots');

      const data = await response.json();
      setSpots(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSpots();
  }, [fetchSpots]);

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    setOffset(0);
  };

  const handlePriceFilter = (maxPrice: number | undefined) => {
    setFilters((prev) => ({ ...prev, maxPrice }));
    setOffset(0);
  };

  const handleReset = () => {
    setFilters({});
    setOffset(0);
  };

  const handleGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setFilters((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radiusKm: 5,
        }));
        setOffset(0);
      });
    }
  };

  const pagesTotal = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="marketplace-container">
      <header className="marketplace-header">
        <div className="header-content">
          <h1>Find a Parking Spot</h1>
          <p>Search and book the perfect parking space</p>
        </div>

        {/* Search & Filters */}
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by location or title..."
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <button onClick={handleGeolocation} className="geolocation-btn" title="Use my location">
            📍
          </button>
        </div>

        {/* Filter Options */}
        <div className="filter-options">
          <div className="filter-group">
            <label>Max Price/Hour</label>
            <select
              onChange={(e) => handlePriceFilter(e.target.value ? parseInt(e.target.value) : undefined)}
              className="filter-select"
            >
              <option value="">Any</option>
              <option value="1000">$10</option>
              <option value="2000">$20</option>
              <option value="5000">$50</option>
              <option value="10000">$100</option>
            </select>
          </div>

          <button onClick={handleReset} className="reset-btn">
            Reset Filters
          </button>
        </div>
      </header>

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* Loading State */}
      {loading && <div className="loading-spinner">Loading spots...</div>}

      {/* Spots Grid */}
      {!loading && spots.length > 0 && (
        <>
          <div className="spots-grid">
            {spots.map((spot) => (
              <Link key={spot.id} href={`/marketplace/${spot.id}`} className="spot-card">
                <div className="spot-image-placeholder">
                  <MapPin size={40} />
                </div>

                <div className="spot-content">
                  <h3 className="spot-title">{spot.title}</h3>

                  <div className="spot-rating">
                    <div className="stars">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < Math.round(spot.averageRating) ? 'star-filled' : 'star-empty'}
                        />
                      ))}
                    </div>
                    <span className="rating-text">
                      {spot.averageRating.toFixed(1)} ({spot.reviewCount} reviews)
                    </span>
                  </div>

                  <p className="spot-address">
                    <MapPin size={14} /> {spot.address}
                  </p>

                  <div className="spot-price">
                    <DollarSign size={16} />
                    <span>${(spot.pricePerHour / 100).toFixed(2)}/hr</span>
                  </div>

                  <p className="spot-host">Hosted by {spot.hostUser.name}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="pagination-btn"
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {currentPage} of {pagesTotal}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="pagination-btn"
            >
              Next →
            </button>
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && spots.length === 0 && (
        <div className="empty-state">
          <p>No spots found. Try adjusting your search filters.</p>
          <button onClick={handleReset} className="reset-btn">
            Clear Filters
          </button>
        </div>
      )}

      {/* Create Spot CTA */}
      <div className="create-spot-cta">
        <p>Want to list your parking spot?</p>
        <Link href="/marketplace/create" className="create-spot-btn">
          Create a Listing
        </Link>
      </div>
    </div>
  );
}
