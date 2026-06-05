'use client';

import { useState, useEffect } from 'react';
import { UnlockGateRequestDto } from '@parkshare/contracts';
import { MapPin, Key, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface GateUnlockerProps {
  bookingId: string;
  spotLatitude: number;
  spotLongitude: number;
}

const GEOFENCE_RADIUS_METERS = 100;

export default function GateUnlocker({ bookingId, spotLatitude, spotLongitude }: GateUnlockerProps) {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'locating' | 'ready' | 'unlocking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const locateUser = () => {
    setStatus('locating');
    setErrorMessage('');

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLat(latitude);
        setUserLng(longitude);

        const dist = calculateDistance(latitude, longitude, spotLatitude, spotLongitude);
        setDistance(dist);
        setStatus('ready');
      },
      (error) => {
        setStatus('error');
        setErrorMessage(`Unable to retrieve your location: ${error.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleUnlock = async () => {
    if (status !== 'ready' || userLat === null || userLng === null) return;

    if (distance !== null && distance > GEOFENCE_RADIUS_METERS) {
      setStatus('error');
      setErrorMessage(`You are too far from the gate. Distance: ${Math.round(distance)}m`);
      return;
    }

    setStatus('unlocking');
    setErrorMessage('');

    try {
      // In a real app, you'd want to attach the auth token here
      const res = await fetch(`/api/v1/bookings/${bookingId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer MOCK_TOKEN' // Mock token for now
        },
        body: JSON.stringify({
          latitude: userLat,
          longitude: userLng,
        } as UnlockGateRequestDto),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setCooldown(10); // 10 seconds cooldown before they can try again if they want
      } else {
        setStatus('error');
        setErrorMessage(data.message || 'Failed to unlock the gate');
      }
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(extractErrorMessage(err));
    }
  };

  const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Network error occurred';
  };

  return (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-gray-100 max-w-sm w-full mx-auto transition-all duration-300">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className="bg-blue-50 p-4 rounded-full">
          <Key className="w-8 h-8 text-blue-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Smart Gate Access</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Unlock the gate when you arrive at your parking spot.
          </p>
        </div>

        {status === 'idle' && (
          <button
            onClick={locateUser}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            Check My Location
          </button>
        )}

        {status === 'locating' && (
          <div className="flex flex-col items-center text-blue-600 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">Finding your location...</span>
          </div>
        )}

        {status === 'ready' && distance !== null && (
          <div className="w-full space-y-4">
            <div className={`p-3 rounded-lg text-sm font-medium ${distance <= GEOFENCE_RADIUS_METERS ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              Distance to gate: {Math.round(distance)}m
              {distance > GEOFENCE_RADIUS_METERS && ' (Too far)'}
            </div>
            <button
              onClick={handleUnlock}
              disabled={distance > GEOFENCE_RADIUS_METERS || cooldown > 0}
              className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Key className="w-5 h-5" />
              {cooldown > 0 ? `Wait ${cooldown}s` : 'Open Gate'}
            </button>
          </div>
        )}

        {status === 'unlocking' && (
          <div className="flex flex-col items-center text-indigo-600 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm font-medium">Communicating with gate...</span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center text-green-600 space-y-4 w-full">
            <CheckCircle2 className="w-16 h-16" />
            <div className="text-lg font-bold">Gate Unlocked!</div>
            <p className="text-sm text-gray-500">You may now proceed to park.</p>
            {cooldown > 0 ? (
              <div className="text-xs text-gray-400 mt-4">Close in {cooldown}s</div>
            ) : (
              <button 
                onClick={() => setStatus('ready')}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Unlock again
              </button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-red-600 space-y-4 w-full">
            <XCircle className="w-12 h-12" />
            <div className="text-sm font-medium text-center">{errorMessage}</div>
            <button
              onClick={locateUser}
              className="mt-2 py-2 px-4 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
