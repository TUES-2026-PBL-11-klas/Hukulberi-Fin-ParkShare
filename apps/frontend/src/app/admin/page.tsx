'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Loader2,
  MapPin,
  Power,
  Search,
  Shield,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
type StatusFilter =
  | 'ALL'
  | VerificationStatus
  | 'ACTIVE'
  | 'DISABLED';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
};

type HostUser = {
  id: string;
  name: string;
  email: string;
  status: string;
};

type AdminSpot = {
  id: string;
  title: string;
  description?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  pricePerHour: number;
  spaceCount: number;
  availableDays: string[];
  availableFrom: string;
  availableUntil: string;
  photoUrls?: string[];
  verificationStatus: VerificationStatus;
  verificationNote?: string | null;
  isActive: boolean;
  createdAt: string;
  hostUser: HostUser;
};

type AdminListResponse = {
  data?: AdminSpot[];
};

const statusFilters: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Verified', value: 'VERIFIED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Disabled', value: 'DISABLED' },
];

const dayLabels: Record<string, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

export default function AdminDashboard() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [mutatingSpotId, setMutatingSpotId] = useState<string | null>(null);

  const token = getAccessToken();
  const isAdmin = authUser?.role === 'ADMIN';

  const loadSpots = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setSpots([]);
      return;
    }

    setLoadingSpots(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/admin/list`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const data = (await response.json()) as AdminListResponse;
      setSpots(Array.isArray(data.data) ? data.data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load spots',
      );
      setSpots([]);
    } finally {
      setLoadingSpots(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const accessToken = getAccessToken();

      if (!accessToken) {
        setAuthReady(true);
        return;
      }

      void (async () => {
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(await readErrorMessage(response));
          }

          const user = (await response.json()) as AuthUser;
          setAuthUser(user);

          if (user.role === 'ADMIN') {
            await loadSpots();
          }
        } catch (authError) {
          setError(
            authError instanceof Error
              ? authError.message
              : 'Could not verify admin access',
          );
          setAuthUser(null);
        } finally {
          setAuthReady(true);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSpots]);

  const counts = useMemo(
    () => ({
      total: spots.length,
      pending: spots.filter((spot) => spot.verificationStatus === 'PENDING')
        .length,
      verified: spots.filter((spot) => spot.verificationStatus === 'VERIFIED')
        .length,
      disabled: spots.filter((spot) => !spot.isActive).length,
    }),
    [spots],
  );

  const filteredSpots = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return spots.filter((spot) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        spot.title.toLowerCase().includes(normalizedSearch) ||
        spot.address.toLowerCase().includes(normalizedSearch) ||
        spot.hostUser.name.toLowerCase().includes(normalizedSearch) ||
        spot.hostUser.email.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && spot.isActive) ||
        (statusFilter === 'DISABLED' && !spot.isActive) ||
        spot.verificationStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, spots, statusFilter]);

  async function updateVerification(
    spotId: string,
    status: 'VERIFIED' | 'REJECTED',
  ) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setError('Sign in as an admin to moderate spots.');
      return;
    }

    setMutatingSpotId(spotId);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/spots/${spotId}/verification`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status,
            note: `Marked ${status.toLowerCase()} by admin`,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadSpots();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Could not update verification',
      );
    } finally {
      setMutatingSpotId(null);
    }
  }

  async function updateActive(spotId: string, isActive: boolean) {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setError('Sign in as an admin to moderate spots.');
      return;
    }

    setMutatingSpotId(spotId);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/spots/${spotId}/admin-active`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isActive }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      await loadSpots();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Could not update listing visibility',
      );
    } finally {
      setMutatingSpotId(null);
    }
  }

  if (!authReady) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
        </div>
      </main>
    );
  }

  if (!token) {
    return <AccessState title="Admin sign-in required" />;
  }

  if (!isAdmin) {
    return <AccessState title="This page is only for admins" />;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to map
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Shield className="h-6 w-6" />
                </span>
                <h1 className="text-3xl font-black tracking-tight">
                  Spot moderation
                </h1>
              </div>
              <p className="mt-2 max-w-2xl text-base text-slate-500">
                Review host submissions, approve real listings, and disable
                spots that should not be bookable.
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm">
            <p className="font-black text-slate-900">{authUser.name}</p>
            <p className="text-slate-500">{authUser.email}</p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Total spots" value={counts.total} />
          <MetricCard label="Pending review" value={counts.pending} tone="amber" />
          <MetricCard label="Verified" value={counts.verified} tone="emerald" />
          <MetricCard label="Disabled" value={counts.disabled} tone="slate" />
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-14 w-full rounded-xl bg-slate-100 pl-12 pr-4 text-base font-semibold text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-500"
                placeholder="Search by spot, host, email, or address"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-xl px-4 py-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    statusFilter === filter.value
                      ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/10'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl bg-rose-50 p-4 font-bold text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="space-y-4">
          {loadingSpots ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Loader2 className="h-9 w-9 animate-spin text-emerald-700" />
            </div>
          ) : filteredSpots.length > 0 ? (
            filteredSpots.map((spot) => (
              <SpotModerationCard
                key={spot.id}
                spot={spot}
                isMutating={mutatingSpotId === spot.id}
                onUpdateVerification={updateVerification}
                onUpdateActive={updateActive}
              />
            ))
          ) : (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
              <SlidersHorizontal className="mx-auto mb-4 h-10 w-10 text-slate-300" />
              <p className="text-lg font-black text-slate-900">No spots found</p>
              <p className="mt-2 text-slate-500">
                Change the search or filter to see more listings.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SpotModerationCard({
  spot,
  isMutating,
  onUpdateVerification,
  onUpdateActive,
}: {
  spot: AdminSpot;
  isMutating: boolean;
  onUpdateVerification: (
    spotId: string,
    status: 'VERIFIED' | 'REJECTED',
  ) => Promise<void>;
  onUpdateActive: (spotId: string, isActive: boolean) => Promise<void>;
}) {
  const photos = spot.photoUrls?.filter(Boolean).slice(0, 3) ?? [];

  return (
    <article className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={spot.verificationStatus} />
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  spot.isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {spot.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              {spot.title}
            </h2>
            <p className="flex items-center gap-2 text-base font-semibold text-slate-500">
              <MapPin className="h-5 w-5 text-emerald-700" />
              {spot.address}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-right">
            <p className="text-sm font-black text-emerald-800">Hourly rate</p>
            <p className="text-2xl font-black text-emerald-800">
              {formatMoney(spot.pricePerHour)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <InfoTile label="Host" value={spot.hostUser.name} />
          <InfoTile label="Spaces" value={String(spot.spaceCount)} />
          <InfoTile label="Days" value={formatDays(spot.availableDays)} />
          <InfoTile
            label="Hours"
            value={`${spot.availableFrom} - ${spot.availableUntil}`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="rounded-2xl bg-slate-100 p-4">
            <p className="text-sm font-black uppercase text-slate-500">Host</p>
            <p className="mt-2 text-lg font-black text-slate-950">
              {spot.hostUser.email}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Account status: {spot.hostUser.status}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-4">
            <p className="text-sm font-black uppercase text-slate-500">
              Submitted
            </p>
            <p className="mt-2 text-lg font-black text-slate-950">
              {formatDate(spot.createdAt)}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)}
            </p>
          </div>
        </div>

        {spot.description ? (
          <p className="rounded-2xl bg-slate-100 p-4 text-base leading-relaxed text-slate-700">
            {spot.description}
          </p>
        ) : null}
      </div>

      <aside className="flex flex-col justify-between gap-4">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          {photos.length > 0 ? (
            photos.map((photo, index) => (
              <Image
                key={`${spot.id}-${index}`}
                src={photo}
                alt={`${spot.title} photo ${index + 1}`}
                width={320}
                height={180}
                unoptimized
                className="h-24 w-full rounded-xl object-cover lg:h-28"
              />
            ))
          ) : (
            <div className="col-span-3 flex h-28 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-400 lg:col-span-1">
              No photos
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <ActionButton
            disabled={isMutating || spot.verificationStatus === 'VERIFIED'}
            onClick={() => onUpdateVerification(spot.id, 'VERIFIED')}
            tone="approve"
          >
            <CheckCircle2 className="h-5 w-5" />
            Verify
          </ActionButton>
          <ActionButton
            disabled={isMutating || spot.verificationStatus === 'REJECTED'}
            onClick={() => onUpdateVerification(spot.id, 'REJECTED')}
            tone="reject"
          >
            <XCircle className="h-5 w-5" />
            Reject
          </ActionButton>
          <ActionButton
            disabled={isMutating}
            onClick={() => onUpdateActive(spot.id, !spot.isActive)}
            tone="neutral"
          >
            <Power className="h-5 w-5" />
            {spot.isActive ? 'Disable' : 'Enable'}
          </ActionButton>
          <Link
            href={`/spots/${spot.id}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Eye className="h-5 w-5" />
            View spot
          </Link>
        </div>
      </aside>
    </article>
  );
}

function AccessState({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-2xl bg-white p-8 text-center shadow-sm">
          <Shield className="mx-auto mb-5 h-12 w-12 text-slate-300" />
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Back to map
          </Link>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'amber' | 'emerald' | 'slate';
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : tone === 'slate'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-white text-slate-900';

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-black uppercase opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-2 text-base font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: VerificationStatus }) {
  const className =
    status === 'VERIFIED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'PENDING'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {status}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  tone: 'approve' | 'reject' | 'neutral';
}) {
  const toneClass =
    tone === 'approve'
      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
      : tone === 'reject'
        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
        : 'bg-slate-900 text-white hover:bg-slate-800';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function getAccessToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('parkshare_access_token');
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: unknown };
    if (typeof data.message === 'string') {
      return data.message;
    }
  } catch {
    // Fall through to generic status text.
  }

  return response.statusText || 'Request failed';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDays(days: string[]) {
  return days.map((day) => dayLabels[day] ?? day).join(', ');
}
