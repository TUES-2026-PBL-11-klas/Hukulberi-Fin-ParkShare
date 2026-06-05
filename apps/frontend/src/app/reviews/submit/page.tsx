'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Star, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

enum ReviewRating {
  ONE = 'ONE',
  TWO = 'TWO',
  THREE = 'THREE',
  FOUR = 'FOUR',
  FIVE = 'FIVE'
}

const ratingLabels = {
  ONE: 'Poor',
  TWO: 'Fair',
  THREE: 'Good',
  FOUR: 'Very Good',
  FIVE: 'Excellent'
};

export default function SubmitReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const spotId = searchParams.get('spotId');

  const [rating, setRating] = useState<ReviewRating>(ReviewRating.FIVE);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(
    !bookingId || !spotId ? 'Missing booking or spot information.' : null
  );
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = localStorage.getItem('parkshare_access_token');
    if (!token) {
      setError('Please log in to submit a review.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookingId,
          spotId,
          rating,
          comment
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit review');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/spots/${spotId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-12 text-center shadow-xl shadow-slate-200/60 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
            <CheckCircle2 size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Review Submitted!</h1>
          <p className="text-slate-500">Thank you for sharing your experience. Redirecting you back to the spot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-xl mx-auto">
        <Link 
          href={`/spots/${spotId}`} 
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors mb-8 font-medium"
        >
          <ArrowLeft size={18} />
          Back to spot
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="bg-slate-900 p-8 text-white">
            <h1 className="text-2xl font-bold font-['Manrope'] mb-2">How was your stay?</h1>
            <p className="text-slate-400 opacity-90">Your feedback helps the community find the best parking spots.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-medium border border-rose-100">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Rating</label>
              <div className="flex gap-3">
                {Object.values(ReviewRating).map((r, i) => {
                  const isSelected = Object.values(ReviewRating).indexOf(rating) >= i;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRating(r)}
                      className="group flex flex-col items-center gap-1 focus:outline-none"
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                        isSelected ? 'bg-amber-100 text-amber-500 scale-110 shadow-sm' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'
                      }`}>
                        <Star fill={isSelected ? "currentColor" : "none"} size={24} />
                      </div>
                      {rating === r && (
                        <span className="text-[10px] font-bold text-amber-600 uppercase animate-in fade-in slide-in-from-top-1">
                          {ratingLabels[r]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label htmlFor="comment" className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Your Experience</label>
              <textarea
                id="comment"
                rows={5}
                className="w-full bg-slate-50 border-none rounded-2xl p-5 focus:ring-2 focus:ring-slate-200 transition-all text-slate-700 placeholder:text-slate-400 outline-none"
                placeholder="Tell us about the space, access, security..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !!error}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 group"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Submit Review
                  <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
