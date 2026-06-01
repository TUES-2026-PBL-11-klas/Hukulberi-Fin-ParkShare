'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Star, DollarSign, User, MessageSquare, Calendar } from 'lucide-react';
import './spot-details.css';

interface Review {
  id: string;
  rating: string;
  comment?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
}

interface Booking {
  id: string;
  startAt: string;
  endAt: string;
}

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
    email: string;
  };
  reviews: Review[];
  bookings: Booking[];
}

export default function SpotDetailsPage() {
  const params = useParams();
  const spotId = params.id as string;

  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpot = async () => {
      try {
        const response = await fetch(`/api/v1/spots/${spotId}`);
        if (!response.ok) throw new Error('Failed to fetch spot');

        const data = await response.json();
        setSpot(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSpot();
  }, [spotId]);

  if (loading) return <div className="spot-details-container">Loading...</div>;
  if (error || !spot) return <div className="spot-details-container error">Error: {error}</div>;

  const getRatingLabel = (rating: string): number => {
    return parseInt(rating.replace(/\D/g, ''), 10);
  };

  return (
    <div className="spot-details-container">
      {/* Header */}
      <div className="spot-header">
        <Link href="/marketplace" className="back-link">
          ← Back to Marketplace
        </Link>

        <div className="spot-hero">
          <div className="spot-image-large">
            <MapPin size={80} />
          </div>

          <div className="spot-info-header">
            <h1>{spot.title}</h1>

            <div className="spot-meta">
              <div className="spot-address-header">
                <MapPin size={18} /> {spot.address}
              </div>

              <div className="spot-rating-header">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={20}
                    className={i < Math.round(spot.averageRating) ? 'star-filled' : 'star-empty'}
                  />
                ))}
                <span className="rating-number">{spot.averageRating.toFixed(1)}</span>
                <span className="review-count">({spot.reviewCount} reviews)</span>
              </div>
            </div>

            <div className="spot-price-header">
              <DollarSign size={24} />
              <span>${(spot.pricePerHour / 100).toFixed(2)}</span>
              <span>/hour</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="spot-content">
        {/* Description */}
        <section className="spot-section">
          <h2>About this Spot</h2>
          <p className="spot-description">{spot.description || 'No description provided.'}</p>
        </section>

        {/* Host Info */}
        <section className="spot-section host-info">
          <h2>Hosted by</h2>
          <div className="host-card">
            <div className="host-avatar">{spot.hostUser.name.charAt(0).toUpperCase()}</div>
            <div className="host-details">
              <p className="host-name">{spot.hostUser.name}</p>
              <p className="host-email">{spot.hostUser.email}</p>
            </div>
            <Link href={`/contact/${spot.hostUser.id}`} className="contact-btn">
              Contact Host
            </Link>
          </div>
        </section>

        {/* Availability Calendar */}
        <section className="spot-section">
          <h2>Availability</h2>
          <div className="availability-notice">
            <Calendar size={20} />
            <p>Booked dates are unavailable. Check the calendar before booking.</p>
          </div>
          {spot.bookings.length > 0 ? (
            <div className="bookings-list">
              <p>Booked dates:</p>
              <ul>
                {spot.bookings.map((booking) => (
                  <li key={booking.id}>
                    {new Date(booking.startAt).toLocaleDateString()} -{' '}
                    {new Date(booking.endAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="no-bookings">This spot is available!</p>
          )}
        </section>

        {/* Reviews */}
        <section className="spot-section reviews-section">
          <h2>
            <MessageSquare size={20} /> Reviews ({spot.reviewCount})
          </h2>

          {spot.reviews.length > 0 ? (
            <div className="reviews-list">
              {spot.reviews.map((review) => (
                <div key={review.id} className="review-card">
                  <div className="review-header">
                    <div className="review-author">
                      <div className="review-avatar">{review.author.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="review-author-name">{review.author.name}</p>
                        <p className="review-date">{new Date(review.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="review-rating">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={i < getRatingLabel(review.rating) ? 'star-filled' : 'star-empty'}
                        />
                      ))}
                    </div>
                  </div>

                  {review.comment && <p className="review-comment">{review.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-reviews">No reviews yet. Be the first to review!</p>
          )}
        </section>
      </div>

      {/* Sidebar - Booking */}
      <aside className="booking-sidebar">
        <div className="booking-card">
          <div className="booking-price">
            <span className="price-amount">${(spot.pricePerHour / 100).toFixed(2)}</span>
            <span className="price-unit">/hour</span>
          </div>

          <div className="booking-form">
            <div className="form-group">
              <label>Check-in</label>
              <input type="date" className="form-input" />
            </div>

            <div className="form-group">
              <label>Check-out</label>
              <input type="date" className="form-input" />
            </div>

            <div className="form-group">
              <label>Duration</label>
              <input type="number" placeholder="Hours" className="form-input" />
            </div>

            <div className="price-breakdown">
              <div className="price-row">
                <span>Subtotal</span>
                <span>$0.00</span>
              </div>
              <div className="price-row">
                <span>Service fee</span>
                <span>$0.00</span>
              </div>
              <div className="price-row total">
                <span>Total</span>
                <span>$0.00</span>
              </div>
            </div>

            <button className="book-btn">Reserve Now</button>
          </div>

          <div className="booking-info">
            <p>✓ Free cancellation within 24 hours</p>
            <p>✓ Instant confirmation</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
