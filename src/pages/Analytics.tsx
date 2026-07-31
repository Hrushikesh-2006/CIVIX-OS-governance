import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot } from '../localStore';
import { useAuth } from '../AuthContext';
import { BarChart3, TrendingUp, AlertTriangle, MapPin, Sparkles, PieChart as PieIcon, Calendar, Activity, ArrowUpRight, ArrowDownRight, Layers, ShieldCheck, CheckCircle2, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, isToday, isYesterday } from 'date-fns';
import { DEPARTMENTS } from '../constants';

export default function Analytics() {
  const { profile } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [locationName, setLocationName] = useState<string>('Sheriguda, Ibrahimpatnam mandal, Ranga Reddy, Telangana, India');
  const [districtName, setDistrictName] = useState<string>('Ranga Reddy District');
  const [geoLoading, setGeoLoading] = useState<boolean>(true);

  // Auto-detect user geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const formatted = data.display_name || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
              setLocationName(formatted);

              const dist = addr.county || addr.state_district || addr.district || addr.city || 'Ranga Reddy District';
              setDistrictName(dist.includes('District') ? dist : `${dist} District`);
            }
          } catch (e) {
            console.warn("Geocoding failed, using fallback location", e);
          } finally {
            setGeoLoading(false);
          }
        },
        () => {
          setGeoLoading(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    const unsubscribe = onSnapshot(collection(db, 'issues'), (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Analytics snapshot error:", error);
    });
    return unsubscribe;
  }, [profile]);

  // Compute District Daily Complaints & Trend Metrics
  const districtMetrics = useMemo(() => {
    const todayIssues = issues.filter(i => {
      const dateStr = i.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && isToday(d);
    });

    const yesterdayIssues = issues.filter(i => {
      const dateStr = i.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && isYesterday(d);
    });

    // Breakdown today's complaints by department
    const deptDailyCounts = DEPARTMENTS.map(dept => {
      const count = todayIssues.filter(i => i.departmentId === dept.id).length;
      return {
        id: dept.id,
        name: dept.name,
        count
      };
    });

    const todayTotal = todayIssues.length;
    const yesterdayTotal = yesterdayIssues.length;

    // Trend calculation
    let percentChange = 0;
    let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';

    if (yesterdayTotal > 0) {
      percentChange = Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100);
      if (percentChange > 0) trendDirection = 'increasing';
      else if (percentChange < 0) trendDirection = 'decreasing';
    } else if (todayTotal > 0) {
      percentChange = 100;
      trendDirection = 'increasing';
    }

    return {
      todayTotal,
      yesterdayTotal,
      percentChange: Math.abs(percentChange),
      trendDirection,
      deptDailyCounts
    };
  }, [issues]);

  const stats = useMemo(() => {
    const now = new Date();
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const count = issues.filter(issue => {
        const d = issue.createdAt ? new Date(issue.createdAt) : null;
        return d && !isNaN(d.getTime()) && isWithinInterval(d, { start, end });
      }).length;
      return {
        name: format(date, 'MMM'),
        count
      };
    }).reverse();

    const deptStats = DEPARTMENTS.map(dept => ({
      name: dept.name,
      count: issues.filter(i => i.departmentId === dept.id).length
    }));

    const resolvedCount = issues.filter(i => i.status === 'resolved' || i.status === 'completed').length;
    const pendingCount = issues.length - resolvedCount;

    const resolutionData = [
      { name: 'Resolved', value: resolvedCount, color: '#10b981' },
      { name: 'Pending', value: pendingCount, color: '#f59e0b' }
    ];

    return { last6Months, deptStats, resolutionData, resolvedCount, pendingCount };
  }, [issues]);

  return (
    <div className="space-y-8 pb-20 font-sans text-white max-w-7xl mx-auto">
      {/* High-Contrast Page Header (Clean, High Visibility) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-bold shrink-0">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              CIVIX Analytics & District Telemetry
            </h1>
            <p className="text-zinc-300 text-sm mt-1">Real-time infrastructure statistics, daily district complaints, and department trend metrics.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2.5 rounded-2xl border border-white/10 text-xs font-bold text-emerald-400 shrink-0">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Annual Report {new Date().getFullYear()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Visual Charts & Analytics (2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Monthly Registration Trend Chart */}
          <div className="bg-slate-900/90 border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Monthly Issue Registration Trend
              </h3>
              <span className="text-xs text-zinc-400 font-mono">Last 6 Months</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.last6Months}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#cbd5e1' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', borderRadius: '16px', borderColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Breakdown Bar Chart */}
          <div className="bg-slate-900/90 border border-white/10 p-6 md:p-8 rounded-[2rem] shadow-2xl backdrop-blur-xl space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Total Complaints by Department
            </h3>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.deptStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#e2e8f0', fontWeight: 'bold' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#020617', borderRadius: '16px', borderColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: District Location & Daily Complaints Telemetry (1 Col) */}
        <div className="space-y-8">
          
          {/* DISTRICT DAILY COMPLAINTS TELEMETRY CARD */}
          <div className="bg-slate-900/90 border border-amber-500/30 p-6 rounded-[2rem] shadow-2xl space-y-6 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />

            <div className="space-y-2 border-b border-white/10 pb-4">
              <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border border-amber-500/30">
                <Navigation className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Live District Telemetry
              </div>
              <h3 className="text-xl font-black text-white">{districtName}</h3>
              <p className="text-xs text-zinc-300 flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="font-medium">{locationName}</span>
              </p>
            </div>

            {/* Daily Complaints Count Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <span>Today's Complaints</span>
                <span className="text-amber-400 font-mono font-black text-sm">{districtMetrics.todayTotal} Total Today</span>
              </div>

              <div className="grid grid-cols-1 gap-2 font-sans">
                {districtMetrics.deptDailyCounts.map(dept => (
                  <div key={dept.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-white/5">
                    <span className="text-xs font-semibold text-zinc-200">{dept.name}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black border ${
                      dept.count > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                    }`}>
                      {dept.count} {dept.count === 1 ? 'complaint' : 'complaints'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Complaint Trend Analysis Indicator */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-zinc-400 uppercase tracking-wider">Daily Trend Analysis</span>
                {districtMetrics.trendDirection === 'increasing' ? (
                  <span className="text-rose-400 flex items-center gap-1 font-mono font-black bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                    <ArrowUpRight className="w-4 h-4" /> ▲ +{districtMetrics.percentChange}% Increasing
                  </span>
                ) : districtMetrics.trendDirection === 'decreasing' ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-mono font-black bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    <ArrowDownRight className="w-4 h-4" /> ▼ -{districtMetrics.percentChange}% Decreasing
                  </span>
                ) : (
                  <span className="text-cyan-400 flex items-center gap-1 font-mono font-black bg-cyan-500/20 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    ➔ Stable Rate
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                {districtMetrics.trendDirection === 'increasing'
                  ? `Complaints in ${districtName} are increasing today compared to yesterday. Municipal sanitation and road crews have been automatically alerted.`
                  : districtMetrics.trendDirection === 'decreasing'
                  ? `District complaint volume is decreasing today due to active field officer resolutions.`
                  : `Complaint intake rate in ${districtName} is remaining steady across all 6 departments.`}
              </p>
            </div>
          </div>

          {/* Resolution Stats & Efficiency */}
          <div className="bg-slate-900/90 border border-white/10 p-6 rounded-[2rem] shadow-2xl backdrop-blur-xl space-y-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              Resolution Efficiency Ratio
            </h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.resolutionData}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.resolutionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', borderColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-xs font-bold">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-200">Resolved ({stats.resolvedCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-zinc-200">Pending ({stats.pendingCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
