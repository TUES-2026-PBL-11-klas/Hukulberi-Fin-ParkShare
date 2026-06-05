'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Shield, 
  Search, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  UserX, 
  UserCheck, 
  ExternalLink,
  ChevronRight,
  Filter,
  MoreVertical,
  Loader2
} from 'lucide-react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

interface Spot {
  id: string;
  title: string;
  address: string;
  verificationStatus: string;
  isActive: boolean;
  pricePerHour: number;
  hostUser: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  createdAt: string;
}

export default function AdminDashboard() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetchSpots();
  }, []);

  const fetchSpots = async () => {
    setLoading(true);
    const token = localStorage.getItem('parkshare_access_token');
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/admin/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Unauthorized or failed to fetch');
      const data = await response.json();
      setSpots(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (spotId: string, status: 'VERIFIED' | 'REJECTED') => {
    const token = localStorage.getItem('parkshare_access_token');
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/spots/${spotId}/verification`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status, note: `Moderated via Admin Dashboard` })
      });
      if (!response.ok) throw new Error('Failed to update status');
      fetchSpots();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUserStatus = async (userId: string, status: 'ACTIVE' | 'SUSPENDED') => {
    const token = localStorage.getItem('parkshare_access_token');
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update user status');
      fetchSpots();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredSpots = spots.filter(spot => {
    const matchesSearch = spot.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         spot.hostUser.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === "ALL" || spot.verificationStatus === statusFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-slate-800" size={40} />
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 font-['Inter']">
      {/* Sidebar Layout Simulation */}
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col hidden md:flex">
          <div className="p-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <Shield className="text-white" size={24} />
              </div>
              <span className="font-black text-xl tracking-tight">AdminHub</span>
            </Link>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-xl font-semibold transition-all">
              <Search size={18} className="text-indigo-400" />
              Listing Audit
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
              <Filter size={18} />
              User Reports
            </button>
          </nav>
          
          <div className="p-8 border-t border-white/5 mt-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold">A</div>
              <div>
                <p className="text-sm font-bold">Admin Account</p>
                <Link href="/" className="text-xs text-slate-500 hover:text-white">Sign Out</Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            <h1 className="text-xl font-bold text-slate-800">Spot Moderation Dashboard</h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search spots or hosts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 w-64 transition-all"
                />
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-100 border-none rounded-xl text-sm py-2 pl-4 pr-10 focus:ring-2 focus:ring-indigo-500/20 appearance-none"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </header>

          {/* Scrollable Area */}
          <div className="flex-1 overflow-auto p-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Spot Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Host Info</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Verification</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSpots.map((spot) => (
                    <tr key={spot.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                            <MapPin className="text-slate-400" size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 line-clamp-1">{spot.title}</p>
                            <p className="text-xs text-slate-500">{spot.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-700">{spot.hostUser.name}</p>
                          <p className="text-xs text-slate-400">{spot.hostUser.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          spot.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-600' :
                          spot.verificationStatus === 'PENDING' ? 'bg-amber-100 text-amber-600' :
                          'bg-rose-100 text-rose-600'
                        }`}>
                          {spot.verificationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {spot.verificationStatus !== 'VERIFIED' && (
                            <button 
                              onClick={() => handleVerify(spot.id, 'VERIFIED')}
                              className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                              title="Approve Spot"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          )}
                          {spot.verificationStatus !== 'REJECTED' && (
                            <button 
                              onClick={() => handleVerify(spot.id, 'REJECTED')}
                              className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                              title="Reject Spot"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                          <Link 
                            href={`/spots/${spot.id}`}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center shadow-sm"
                            title="View Public Page"
                          >
                            <ExternalLink size={16} />
                          </Link>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {spot.hostUser.status === 'ACTIVE' ? (
                            <button 
                              onClick={() => handleUserStatus(spot.hostUser.id, 'SUSPENDED')}
                              className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-600 hover:text-white transition-all border border-rose-100 hover:border-rose-600 shadow-sm"
                            >
                              <UserX size={14} />
                              Ban Host
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleUserStatus(spot.hostUser.id, 'ACTIVE')}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 hover:border-emerald-600 shadow-sm"
                            >
                              <UserCheck size={14} />
                              Unban
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSpots.length === 0 && (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <AlertTriangle size={32} />
                  </div>
                  <p className="text-slate-400 font-medium">No spots found matching your audit criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
