'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  Euro,
  Loader2,
  MapPin,
  Save,
  ShieldCheck,
  Trash2,
  Warehouse,
} from 'lucide-react';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

const weekDays = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
] as const;

type SpotFormData = {
  title: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  pricePerHour: string;
  spaceCount: number;
  availableDays: string[];
  availableFrom: string;
  availableUntil: string;
};

const initialFormData: SpotFormData = {
  title: '',
  description: '',
  address: '',
  latitude: 0,
  longitude: 0,
  pricePerHour: '',
  spaceCount: 1,
  availableDays: [],
  availableFrom: '08:00',
  availableUntil: '20:00',
};

function formatSelectedDays(days: string[]) {
  if (days.length === 0) {
    return 'No days selected';
  }

  return weekDays
    .filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(', ');
}

export default function EditSpotPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SpotFormData>(initialFormData);

  useEffect(() => {
    async function fetchSpot() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/spots/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch spot details');
        }

        const data = (await response.json()) as Partial<SpotFormData> & {
          pricePerHour?: number;
        };

        setFormData({
          title: data.title ?? '',
          description: data.description ?? '',
          address: data.address ?? '',
          latitude: Number(data.latitude ?? 0),
          longitude: Number(data.longitude ?? 0),
          pricePerHour:
            typeof data.pricePerHour === 'number'
              ? (data.pricePerHour / 100).toString()
              : '',
          spaceCount: Number(data.spaceCount ?? 1),
          availableDays: Array.isArray(data.availableDays)
            ? data.availableDays
            : [],
          availableFrom: data.availableFrom ?? '08:00',
          availableUntil: data.availableUntil ?? '20:00',
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch spot details',
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchSpot();
  }, [id]);

  const pricePreview = useMemo(() => {
    const value = Number.parseFloat(formData.pricePerHour);
    return Number.isFinite(value) ? `EUR ${value.toFixed(2)} / hour` : 'No price';
  }, [formData.pricePerHour]);

  const validationMessage = useMemo(() => {
    if (!formData.title.trim()) {
      return 'Title is required.';
    }
    if (!formData.address.trim()) {
      return 'Address is required.';
    }
    if (formData.availableDays.length === 0) {
      return 'Choose at least one available day.';
    }
    if (formData.availableFrom >= formData.availableUntil) {
      return 'Available from time must be earlier than available until time.';
    }

    const price = Number.parseFloat(formData.pricePerHour);
    if (!Number.isFinite(price) || price < 0) {
      return 'Hourly price must be a valid number.';
    }

    return null;
  }, [formData]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const toggleDay = (day: string) => {
    setFormData((previous) => ({
      ...previous,
      availableDays: previous.availableDays.includes(day)
        ? previous.availableDays.filter((selected) => selected !== day)
        : [...previous.availableDays, day],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const token = localStorage.getItem('parkshare_access_token');
    if (!token) {
      setError('Please log in to update your listing.');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          address: formData.address.trim(),
          latitude: formData.latitude,
          longitude: formData.longitude,
          pricePerHour: Math.round(
            Number.parseFloat(formData.pricePerHour) * 100,
          ),
          spaceCount: Number.parseInt(formData.spaceCount.toString(), 10),
          availableDays: formData.availableDays,
          availableFrom: formData.availableFrom,
          availableUntil: formData.availableUntil,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message ?? 'Failed to update spot');
      }

      router.push(`/spots/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update spot');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      'Delete this listing? This cannot be undone.',
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem('parkshare_access_token');
    if (!token) {
      setError('Please log in to delete your listing.');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to delete spot');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete spot');
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={40} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/spots/${id}`}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              aria-label="Back to spot details"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </Link>
            <div>
              <p className="text-sm font-semibold text-slate-500">Host tools</p>
              <h1 className="text-3xl font-bold tracking-tight">Edit listing</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-5 py-3 font-semibold text-rose-600 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              <Trash2 size={18} aria-hidden="true" />
              Delete
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {saving ? 'Saving' : 'Save changes'}
            </button>
          </div>
        </header>

        {error ? (
          <section className="flex items-center gap-3 rounded-2xl bg-rose-50 p-4 font-semibold text-rose-700">
            <AlertCircle size={20} aria-hidden="true" />
            {error}
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="flex flex-col gap-6 rounded-3xl bg-white p-5 shadow-sm sm:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-500">Listing name</span>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="rounded-2xl bg-slate-100 px-4 py-4 text-lg font-semibold outline-none transition focus:ring-2 focus:ring-emerald-500"
                  placeholder="Covered garage near the center"
                />
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-500">Description</span>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={5}
                  className="min-h-36 resize-none rounded-2xl bg-slate-100 px-4 py-4 leading-relaxed outline-none transition focus:ring-2 focus:ring-emerald-500"
                  placeholder="Mention entrance details, gate access, lighting, roof cover, and anything drivers should know."
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-500">Hourly price</span>
                <span className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-4 focus-within:ring-2 focus-within:ring-emerald-500">
                  <Euro size={20} className="text-emerald-700" aria-hidden="true" />
                  <input
                    name="pricePerHour"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pricePerHour}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-transparent text-lg font-bold outline-none"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-500">Available spaces</span>
                <span className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-4 focus-within:ring-2 focus-within:ring-emerald-500">
                  <Warehouse size={20} className="text-emerald-700" aria-hidden="true" />
                  <input
                    name="spaceCount"
                    type="number"
                    min="1"
                    max="200"
                    value={formData.spaceCount}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-transparent text-lg font-bold outline-none"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-500">Address</span>
                <span className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-4 focus-within:ring-2 focus-within:ring-emerald-500">
                  <MapPin size={20} className="text-emerald-700" aria-hidden="true" />
                  <input
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-transparent font-semibold outline-none"
                  />
                </span>
              </label>
            </div>

            <section className="rounded-3xl bg-slate-100 p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-700">
                  <CalendarDays size={21} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-bold">Availability</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Choose when drivers can reserve this garage.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {weekDays.map((day) => {
                  const selected = formData.availableDays.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`rounded-2xl px-4 py-4 text-left font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                        selected
                          ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-100'
                          : 'bg-white text-slate-900 hover:bg-emerald-50'
                      }`}
                      aria-pressed={selected}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-500">From</span>
                  <span className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 focus-within:ring-2 focus-within:ring-emerald-500">
                    <Clock3 size={20} className="text-slate-700" aria-hidden="true" />
                    <input
                      name="availableFrom"
                      type="time"
                      value={formData.availableFrom}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-transparent text-lg font-bold outline-none"
                    />
                  </span>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-500">Until</span>
                  <span className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 focus-within:ring-2 focus-within:ring-emerald-500">
                    <Clock3 size={20} className="text-slate-700" aria-hidden="true" />
                    <input
                      name="availableUntil"
                      type="time"
                      value={formData.availableUntil}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-transparent text-lg font-bold outline-none"
                    />
                  </span>
                </label>
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">Preview</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight">
                {formData.title || 'Untitled listing'}
              </h2>
              <p className="mt-3 line-clamp-4 text-slate-500">
                {formData.description ||
                  'Add a short description so drivers know what to expect.'}
              </p>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <span className="text-sm font-semibold text-slate-500">Price</span>
                  <p className="mt-1 text-xl font-bold text-emerald-700">
                    {pricePreview}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                  <span className="text-sm font-semibold text-slate-500">Schedule</span>
                  <p className="mt-1 font-bold">
                    {formatSelectedDays(formData.availableDays)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {formData.availableFrom} - {formData.availableUntil}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={22} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-bold">Verification</h2>
                  <p className="text-sm font-semibold text-slate-500">
                    Admins may review important listing changes.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-500">Pinned entrance</p>
                <p className="mt-1 font-mono text-sm font-bold">
                  {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Coordinates stay locked here so the verified entrance cannot
                  drift during normal edits.
                </p>
              </div>
            </section>
          </aside>
        </section>
      </form>
    </main>
  );
}
