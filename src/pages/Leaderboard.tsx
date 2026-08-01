import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot } from '../localStore';
import { useAuth } from '../AuthContext';
import { Trophy, Award, Sparkles, Coins, Crown, Flame, ShieldCheck, CheckCircle2, User, Search, Medal, Zap, Star } from 'lucide-react';
import { motion } from 'motion/react';

interface LeaderboardUser {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  coins?: number;
  complaintsCount?: number;
  resolvedCount?: number;
  role?: string;
}

export default function Leaderboard() {
  const { user: currentUser, profile } = useAuth();
  const [rawUsers, setRawUsers] = useState<LeaderboardUser[]>([]);
  const [rawIssues, setRawIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Live subscription to registered users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeaderboardUser));
      setRawUsers(docs);
      setLoading(false);
    }, (err) => {
      console.error('Leaderboard users snapshot error:', err);
      setLoading(false);
    });

    // Live subscription to issues collection for dynamic complaint & coin calculation
    const unsubIssues = onSnapshot(collection(db, 'issues'), (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRawIssues(docs);
    }, (err) => {
      console.error('Leaderboard issues snapshot error:', err);
    });

    return () => {
      unsubUsers();
      unsubIssues();
    };
  }, []);

  // Dynamically compute real citizen standings & earned coins
  const users = useMemo(() => {
    const userMap: Record<string, LeaderboardUser> = {};

    // 1. Add all registered citizen users
    rawUsers.forEach(u => {
      if ((u.role === 'citizen' || !u.role) && !u.id.startsWith('citizen_champ_') && !u.email?.endsWith('@civix.demo')) {
        userMap[u.id] = { ...u };
      }
    });

    // 2. Ensure current logged in citizen user is present
    if (currentUser?.uid && (currentUser.email || currentUser.displayName || profile?.displayName)) {
      if (!userMap[currentUser.uid]) {
        userMap[currentUser.uid] = {
          id: currentUser.uid,
          displayName: currentUser.displayName || profile?.displayName || 'Citizen',
          email: currentUser.email || profile?.email || '',
          photoUrl: currentUser.photoURL || profile?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'Citizen')}`,
          role: 'citizen',
          coins: 0,
          complaintsCount: 0
        };
      }
    }

    // 3. Compute actual complaint counts and 10 coins per report for each citizen
    const processedList = Object.values(userMap).map(u => {
      const userIssues = rawIssues.filter(i =>
        i.reporterUid === u.id ||
        (u.email && i.reporterEmail && i.reporterEmail.toLowerCase() === u.email.toLowerCase()) ||
        (u.displayName && i.reporterName && i.reporterName.toLowerCase() === u.displayName.toLowerCase())
      );

      const actualComplaints = Math.max(u.complaintsCount || 0, userIssues.length);
      const resolvedCount = Math.max(u.resolvedCount || 0, userIssues.filter(i => i.status === 'resolved' || i.status === 'completed').length);

      // Minimum 10 coins for every reported complaint + 5 bonus coins for resolved issues
      const calculatedCoins = (actualComplaints * 10) + (resolvedCount * 5);
      const finalCoins = Math.max(u.coins || 0, calculatedCoins);

      return {
        ...u,
        complaintsCount: actualComplaints,
        resolvedCount,
        coins: finalCoins
      };
    });

    // 4. Sort by real earned coins descending, tie-break by complaints reported
    processedList.sort((a, b) => (b.coins || 0) - (a.coins || 0) || (b.complaintsCount || 0) - (a.complaintsCount || 0));
    return processedList;
  }, [rawUsers, rawIssues, currentUser, profile]);

  const filteredUsers = users.filter(u => 
    (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const top1 = filteredUsers[0];
  const top2 = filteredUsers[1];
  const top3 = filteredUsers[2];

  // Find current user's rank
  const userRankIndex = users.findIndex(u => u.id === currentUser?.uid);
  const currentUserData = userRankIndex >= 0 ? users[userRankIndex] : null;

  const getBadgeTitle = (coins: number) => {
    if (coins >= 150) return { title: '👑 Civic Legend', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
    if (coins >= 100) return { title: '⚡ City Crusader', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    if (coins >= 50) return { title: '🛡️ Community Hero', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    if (coins >= 10) return { title: '🔰 Civic Contributor', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
    return { title: '🌱 Active Citizen', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-36">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 font-sans text-zinc-100 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-emerald-950 p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-10%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Trophy className="w-4 h-4 text-amber-400" /> Real Citizen Leaderboard
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-amber-200 to-emerald-200 bg-clip-text text-transparent">
              Earn Coins. Clean Your City.
            </h1>
            <p className="text-zinc-300 text-sm max-w-xl leading-relaxed">
              Every real complaint reported earns you <strong className="text-amber-400">+10 Civic Coins</strong>. Get an extra <strong className="text-emerald-400">+5 Bonus Coins</strong> when your report is repaired by officials!
            </p>
          </div>

          {/* Current User Stats Card */}
          {currentUserData && (
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shrink-0 space-y-3 shadow-xl backdrop-blur-md min-w-[240px]">
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-between">
                <span>Your Civic Rank</span>
                <span className="text-amber-400 font-mono">#{userRankIndex + 1}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-black text-amber-300 text-lg">
                  🪙
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{currentUserData.coins || 0} <span className="text-xs text-amber-400 font-bold">Coins</span></div>
                  <div className="text-[10px] text-emerald-400 font-semibold">{currentUserData.complaintsCount || 0} Complaints Reported</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOP 3 PODIUM (Renders only when real registered users exist) */}
      {filteredUsers.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 md:gap-6 pt-4 items-end max-w-3xl mx-auto">
          {/* SILVER - #2 */}
          {top2 && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/90 border border-slate-700/60 rounded-3xl p-4 md:p-6 text-center space-y-3 relative shadow-xl backdrop-blur-md flex flex-col items-center justify-between min-h-[260px]"
            >
              <div className="absolute top-[-15px] bg-slate-700 text-slate-200 text-xs font-black px-3 py-0.5 rounded-full border border-slate-500 shadow">
                🥈 2nd Place
              </div>
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-4 border-slate-400/60 shadow-xl mx-auto mt-2">
                <img src={top2.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(top2.displayName)}`} className="w-full h-full object-cover" alt={top2.displayName} />
              </div>
              <div>
                <h3 className="font-bold text-sm md:text-base text-white truncate max-w-[140px] mx-auto">{top2.displayName}</h3>
                <div className="text-amber-400 font-black text-sm md:text-lg flex items-center justify-center gap-1 mt-0.5">
                  🪙 {top2.coins || 0}
                </div>
              </div>
              <div className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                {top2.complaintsCount || 0} Reports
              </div>
            </motion.div>
          )}

          {/* GOLD - #1 */}
          {top1 && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-900 border-2 border-amber-400/60 rounded-3xl p-5 md:p-7 text-center space-y-4 relative shadow-2xl backdrop-blur-md flex flex-col items-center justify-between min-h-[300px] z-10"
            >
              <div className="absolute top-[-18px] bg-amber-400 text-slate-950 text-xs font-black px-4 py-1 rounded-full shadow-lg flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" /> 🥇 1st Champion
              </div>
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-amber-400 shadow-2xl mx-auto mt-2 ring-4 ring-amber-400/20">
                <img src={top1.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(top1.displayName)}`} className="w-full h-full object-cover" alt={top1.displayName} />
              </div>
              <div>
                <h3 className="font-black text-base md:text-xl text-white truncate max-w-[160px] mx-auto">{top1.displayName}</h3>
                <div className="text-amber-300 font-black text-lg md:text-2xl flex items-center justify-center gap-1.5 mt-0.5">
                  🪙 {top1.coins || 0} <span className="text-xs text-amber-400 font-normal">Coins</span>
                </div>
              </div>
              <div className="text-xs bg-amber-500/20 text-amber-200 font-extrabold px-3 py-1 rounded-full border border-amber-500/40">
                🏆 {top1.complaintsCount || 0} Reports Submitted
              </div>
            </motion.div>
          )}

          {/* BRONZE - #3 */}
          {top3 && (
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-900/90 border border-amber-900/50 rounded-3xl p-4 md:p-6 text-center space-y-3 relative shadow-xl backdrop-blur-md flex flex-col items-center justify-between min-h-[260px]"
            >
              <div className="absolute top-[-15px] bg-amber-900 text-amber-200 text-xs font-black px-3 py-0.5 rounded-full border border-amber-700 shadow">
                🥉 3rd Place
              </div>
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-4 border-amber-700/60 shadow-xl mx-auto mt-2">
                <img src={top3.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(top3.displayName)}`} className="w-full h-full object-cover" alt={top3.displayName} />
              </div>
              <div>
                <h3 className="font-bold text-sm md:text-base text-white truncate max-w-[140px] mx-auto">{top3.displayName}</h3>
                <div className="text-amber-400 font-black text-sm md:text-lg flex items-center justify-center gap-1 mt-0.5">
                  🪙 {top3.coins || 0}
                </div>
              </div>
              <div className="text-[10px] bg-slate-800 text-zinc-300 px-2.5 py-1 rounded-full border border-slate-700">
                {top3.complaintsCount || 0} Reports
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* SEARCH BAR & REAL USER RANKINGS TABLE */}
      <div className="bg-slate-900/90 border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Medal className="w-5 h-5 text-amber-400" /> Active Citizen Rankings ({filteredUsers.length})
          </h2>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search registered citizen..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Rankings Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-slate-950 text-zinc-400 text-xs uppercase tracking-wider font-mono">
              <tr>
                <th className="p-4 rounded-l-xl">Rank</th>
                <th className="p-4">Citizen</th>
                <th className="p-4">Badge Tier</th>
                <th className="p-4">Complaints Reported</th>
                <th className="p-4 text-right rounded-r-xl">Civic Coins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((u, index) => {
                const badge = getBadgeTitle(u.coins || 0);
                const isCurrent = u.id === currentUser?.uid;

                return (
                  <tr key={u.id} className={`hover:bg-white/5 transition-colors ${isCurrent ? 'bg-amber-500/10 font-bold border-l-4 border-amber-400' : ''}`}>
                    <td className="p-4 font-mono font-bold text-white">
                      {index === 0 ? '🥇 #1' : index === 1 ? '🥈 #2' : index === 2 ? '🥉 #3' : `#${index + 1}`}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0">
                          <img src={u.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}`} className="w-full h-full object-cover" alt={u.displayName} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            {u.displayName}
                            {isCurrent && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded-full border border-amber-500/30">You</span>}
                          </div>
                          <div className="text-[11px] text-zinc-400">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${badge.color}`}>
                        {badge.title}
                      </span>
                    </td>

                    <td className="p-4 font-bold text-zinc-200">
                      {u.complaintsCount || 0} <span className="text-xs text-zinc-400 font-normal">reports</span>
                    </td>

                    <td className="p-4 text-right">
                      <span className="text-amber-400 font-black text-base flex items-center justify-end gap-1">
                        🪙 {u.coins || 0}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-zinc-400 space-y-2">
              <Trophy className="w-10 h-10 text-amber-400/40 mx-auto" />
              <p className="font-medium text-white">No registered citizens have reported complaints yet.</p>
              <p className="text-xs text-zinc-500">Report your first complaint to earn +10 Civic Coins and take the #1 Spot!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
