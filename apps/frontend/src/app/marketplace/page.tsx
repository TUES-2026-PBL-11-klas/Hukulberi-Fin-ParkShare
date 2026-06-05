'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, SlidersHorizontal, MapPin, Star, Loader2 } from 'lucide-react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface Spot {
  id: string;
  title: string;
  address: string;
  pricePerHour: number;
  latitude: number;
  longitude: number;
  averageRating: number;
  reviewCount: number;
  photoUrls: string[];
  hostUser: {
    name: string;
  };
}

export default function MarketplacePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    async function fetchSpots() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (maxPrice) queryParams.append('maxPrice', (maxPrice * 100).toString());
        
        const response = await fetch(`${apiBaseUrl}/api/v1/spots?${queryParams.toString()}`);
        const data = await response.json();
        setSpots(data.data || []);
      } catch (error) {
        console.error('Failed to fetch spots:', error);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchSpots, 300); // Debounce search
    return () => clearTimeout(timer);
  }, [search, maxPrice]);

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-slate-900 font-['Inter']">
      {/* Premium Navigation Header */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-black font-['Manrope'] tracking-tighter flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-xs">P</div>
            <span>ParkShare</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/marketplace/create" className="text-sm font-bold bg-slate-100 px-5 py-2.5 rounded-2xl hover:bg-slate-200 transition-all">
              List Garage
            </Link>
            <div className="w-10 h-10 rounded-full bg-slate-900 border-4 border-white shadow-sm"></div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Search & Filter Section */}
        <div className="mb-12 space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Search by neighborhood, street, or landmark..."
                className="w-full bg-white border-2 border-slate-100 rounded-3xl py-5 pl-14 pr-6 text-slate-700 focus:border-slate-200 outline-none transition-all shadow-sm focus:shadow-md"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-8 py-5 rounded-3xl border-2 flex items-center gap-3 font-bold transition-all ${
                isFilterOpen ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
              }`}
            >
              <SlidersHorizontal size={20} />
              Filters
            </button>
          </div>

          {isFilterOpen && (
            <div className="p-8 bg-white rounded-[2rem] border-2 border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Max Budget (EUR/h)</label>
                <div className="flex items-center gap-3 font-bold">
                  <span>0</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    className="flex-1 accent-slate-900 h-1"
                    value={maxPrice || 50}
                    onChange={(e) => setMaxPrice(parseInt(e.target.value, 10))}
                  />
                  <span className="w-12 text-right">{maxPrice || 50}€</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="animate-spin text-slate-300" size={48} />
            <p className="text-slate-400 font-medium">Hunting for best spots...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {spots.map((spot) => (
              <Link href={`/spots/${spot.id}`} key={spot.id} className="group flex flex-col pointer-events-auto">
                <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden mb-5 shadow-xl shadow-slate-200/50">
                  {spot.photoUrls?.[0] ? (
                    <Image
                      src={spot.photoUrls[0]}
                      alt={spot.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-slate-100 flex items-center justify-center text-slate-300">
                      <MapPin size={48} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-5 right-5 bg-white/90 backdrop-blur px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-sm">
                    <Star className="text-amber-400 fill-amber-400" size={14} />
                    <span className="text-sm font-black">{spot.averageRating || 'N/A'}</span>
                  </div>
                </div>

                <div className="px-2">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold font-['Manrope'] pr-4 truncate group-hover:text-slate-600 transition-colors">{spot.title}</h3>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-xl font-black text-slate-900">€{spot.pricePerHour / 100}</span>
                      <span className="text-[10px] uppercase tracking-tighter font-black text-slate-400">per hour</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <MapPin size={16} />
                    <span className="truncate">{spot.address}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && spots.length === 0 && (
          <div className="text-center py-24">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
              <Search size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No spots found</h2>
            <p className="text-slate-400">Try adjusting your filters or searching another area.</p>
          </div>
        )}
      </main>
    </div>
  );
}
