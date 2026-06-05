'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Loader2, AlertCircle } from 'lucide-react';
import '../../create/create-spot.css';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const weekDays = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
];

export default function EditSpotPage() {
  const router = useRouter();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    latitude: 0,
    longitude: 0,
    pricePerHour: '',
    spaceCount: 1,
    availableDays: [] as string[],
    availableFrom: '08:00',
    availableUntil: '20:00',
  });

  useEffect(() => {
    async function fetchSpot() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/spots/${id}`);
        if (!response.ok) throw new Error('Failed to fetch spot details');
        const data = await response.json();
        
        setFormData({
          title: data.title,
          description: data.description || '',
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          pricePerHour: (data.pricePerHour / 100).toString(),
          spaceCount: data.spaceCount || 1,
          availableDays: data.availableDays || [],
          availableFrom: data.availableFrom || '08:00',
          availableUntil: data.availableUntil || '20:00',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch spot details');
      } finally {
        setLoading(false);
      }
    }
    fetchSpot();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const token = localStorage.getItem('parkshare_access_token');
    if (!token) {
      setError('Please log in to update your listing.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          pricePerHour: Math.round(parseFloat(formData.pricePerHour) * 100),
          spaceCount: parseInt(formData.spaceCount.toString(), 10)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update spot');
      }

      router.push(`/spots/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update spot');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) return;
    
    const token = localStorage.getItem('parkshare_access_token');
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete spot');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete spot');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-slate-400" size={40} />
    </div>
  );

  return (
    <main className="create-spot-shell">
      <form onSubmit={handleSubmit} className="listing-workspace">
        <header className="listing-topbar">
          <Link href={`/spots/${id}`} className="create-spot-back">
            <ArrowLeft size={18} />
            Back
          </Link>
          <h1>Edit Listing</h1>
          <div className="flex gap-4">
            <button type="button" onClick={handleDelete} className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-colors">
              <Trash2 size={22} />
            </button>
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
              {!saving && <Save size={18} className="ml-2" />}
            </button>
          </div>
        </header>

        {error && (
          <div className="listing-alert listing-alert-error flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <aside className="listing-drawer py-8">
          <section className="form-section">
            <h2>Spot Details</h2>
            <label className="form-group">
              <span>Title</span>
              <input name="title" value={formData.title} onChange={handleInputChange} required />
            </label>
            <label className="form-group">
              <span>Description</span>
              <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} />
            </label>
            <label className="form-group">
              <span>EUR / hour</span>
              <input name="pricePerHour" type="number" step="0.01" value={formData.pricePerHour} onChange={handleInputChange} required />
            </label>
          </section>

          <section className="form-section">
            <h2>Availability</h2>
            <label className="form-group">
              <span>Spaces</span>
              <input name="spaceCount" type="number" value={formData.spaceCount} onChange={handleInputChange} min="1" required />
            </label>
            <div className="form-group">
              <span>Days</span>
              <div className="day-chip-grid">
                {weekDays.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    className={`day-chip ${formData.availableDays.includes(day.value) ? 'day-chip-selected' : ''}`}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="time-grid">
              <label className="form-group">
                <span>From</span>
                <input name="availableFrom" type="time" value={formData.availableFrom} onChange={handleInputChange} required />
              </label>
              <label className="form-group">
                <span>Until</span>
                <input name="availableUntil" type="time" value={formData.availableUntil} onChange={handleInputChange} required />
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>Entrance</h2>
            <label className="form-group">
              <span>Address</span>
              <input name="address" value={formData.address} onChange={handleInputChange} required />
            </label>
            <div className="coordinate-grid">
              <div className="form-group">
                <span>Lat</span>
                <div className="bg-slate-100 p-3 rounded-xl text-slate-500 text-sm font-mono">{formData.latitude}</div>
              </div>
              <div className="form-group">
                <span>Lng</span>
                <div className="bg-slate-100 p-3 rounded-xl text-slate-500 text-sm font-mono">{formData.longitude}</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 px-2 italic text-center">Location coordinates cannot be changed after creation for security reasons.</p>
          </section>
        </aside>
      </form>
    </main>
  );
}
