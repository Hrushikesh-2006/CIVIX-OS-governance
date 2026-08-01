import React, { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, where, doc, updateDoc, serverTimestamp, deleteDoc } from '../localStore';
import { useAuth } from '../AuthContext';
import { User, Mail, Shield, Clock, CheckCircle2, AlertCircle, Building2, Truck, Zap, Droplets, GraduationCap, Edit2, X, Loader2, Trash2, Trophy, Coins, Award, Star, Flame, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { DEPARTMENTS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { calculateOfficerResponseDuration } from '../utils';

export default function Dashboard() {
  const { user, profile, deleteAccount } = useAuth();
  const [myIssues, setMyIssues] = useState<any[]>([]);
  const [editingIssue, setEditingIssue] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', description: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'issues'), where('reporterUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMyIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Dashboard snapshot error:", error);
    });
    return unsubscribe;
  }, [user]);

  const handleUpdateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue || !editFormData.title.trim() || !editFormData.description.trim()) return;

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, 'issues', editingIssue.id), {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        updatedAt: serverTimestamp()
      });
      setEditingIssue(null);
    } catch (error) {
      console.error("Update failed", error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!deletingIssueId) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'issues', deletingIssueId));
      setDeletingIssueId(null);
    } catch (error) {
      console.error("Delete failed", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getDeptIcon = (id: string | undefined) => {
    switch(id) {
      case 'municipal': return <Building2 className="w-4 h-4 text-emerald-400" />;
      case 'transport': return <Truck className="w-4 h-4 text-cyan-400" />;
      case 'electricity': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'water': return <Droplets className="w-4 h-4 text-blue-400" />;
      case 'education': return <GraduationCap className="w-4 h-4 text-purple-400" />;
      default: return <Shield className="w-4 h-4 text-zinc-400" />;
    }
  };

  // User Civic Tag / Rank Title Calculation
  const coins = Math.max(profile?.coins ?? profile?.civicCoins ?? 0, myIssues.length * 10);
  const reportsCount = myIssues.length;
  const resolvedCount = myIssues.filter(i => i.status === 'resolved' || i.status === 'completed').length;

  let civicTag = { label: '🌱 Active Citizen', color: 'from-emerald-500 to-teal-400', border: 'border-emerald-500/40' };
  if (coins >= 100 || resolvedCount >= 5) {
    civicTag = { label: '👑 Civic Legend', color: 'from-amber-400 to-yellow-300 text-slate-950', border: 'border-amber-400/50' };
  } else if (coins >= 50 || resolvedCount >= 3) {
    civicTag = { label: '⚡ City Crusader', color: 'from-cyan-400 to-blue-500 text-slate-950', border: 'border-cyan-400/50' };
  } else if (coins >= 30 || reportsCount >= 2) {
    civicTag = { label: '🛡️ Community Hero', color: 'from-purple-400 to-pink-500 text-white', border: 'border-purple-400/50' };
  } else if (coins >= 10 || reportsCount >= 1) {
    civicTag = { label: '🔰 Civic Contributor', color: 'from-emerald-400 to-teal-500 text-slate-950', border: 'border-emerald-400/50' };
  }

  // Achievements Array
  const achievements = [
    {
      id: 'first_report',
      title: 'First Reporter',
      desc: 'Submitted 1st civic complaint',
      icon: <Sparkles className="w-5 h-5 text-amber-400" />,
      unlocked: reportsCount >= 1
    },
    {
      id: 'coin_collector',
      title: 'Coin Collector',
      desc: 'Earned 10+ Civic Coins',
      icon: <Coins className="w-5 h-5 text-yellow-400" />,
      unlocked: coins >= 10
    },
    {
      id: 'community_guardian',
      title: 'City Guardian',
      desc: 'Resolved civic issue verified',
      icon: <Award className="w-5 h-5 text-emerald-400" />,
      unlocked: resolvedCount >= 1
    },
    {
      id: 'top_contributor',
      title: 'Civic Master',
      desc: 'Earned 50+ Coins',
      icon: <Trophy className="w-5 h-5 text-cyan-400" />,
      unlocked: coins >= 50
    }
  ];

  return (
    <div className="space-y-8 pb-20 font-sans text-white max-w-5xl mx-auto">
      
      {/* Profile Header Banner with High-Contrast Dark Card */}
      <div className="bg-slate-900/90 p-6 md:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative shrink-0">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-400/40 shadow-xl shadow-emerald-500/20">
            <img 
              src={profile?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'User')}&background=0f172a&color=38bdf8`} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
              alt={profile?.displayName || 'User'}
            />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 font-black shadow-lg border-2 border-slate-900">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left space-y-2">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <h1 className="text-3xl font-black text-white tracking-tight">{profile?.displayName}</h1>
            
            {/* CIVIC TAG BADGE */}
            <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r ${civicTag.color} shadow-lg border ${civicTag.border}`}>
              {civicTag.label}
            </span>
          </div>

          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-medium text-zinc-300">
            <span className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-xl border border-white/10">
              <Mail className="w-3.5 h-3.5 text-cyan-400" /> {profile?.email}
            </span>
            <span className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-xl border border-white/10 font-bold">
              {getDeptIcon(profile?.departmentId)} 
              {profile?.role === 'admin' 
                ? 'Central Administrator' 
                : profile?.role === 'official' 
                ? `Official (${DEPARTMENTS.find(d => d.id === profile.departmentId)?.name || profile.departmentId || 'Department'})` 
                : 'Citizen Member'}
            </span>
          </div>
        </div>

        {/* STATS & COINS DISPLAY */}
        <div className="flex flex-wrap justify-center gap-3 shrink-0">
          <div className="text-center px-5 py-3 bg-slate-950 rounded-2xl border border-amber-500/30 shadow-lg min-w-[100px]">
            <div className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1">
              <Coins className="w-6 h-6 text-amber-400 animate-bounce" /> {coins}
            </div>
            <div className="text-[10px] font-black text-amber-300/80 uppercase tracking-widest mt-0.5">Civic Coins</div>
          </div>

          <div className="text-center px-5 py-3 bg-slate-950 rounded-2xl border border-white/10 min-w-[90px]">
            <div className="text-2xl font-black text-white">{reportsCount}</div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Reports</div>
          </div>

          <div className="text-center px-5 py-3 bg-slate-950 rounded-2xl border border-emerald-500/30 min-w-[90px]">
            <div className="text-2xl font-black text-emerald-400">{resolvedCount}</div>
            <div className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-widest mt-0.5">Resolved</div>
          </div>
        </div>
      </div>

      {/* ACHIEVEMENTS GRID SECTION */}
      <div className="bg-slate-900/90 p-6 md:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            Civic Achievements & Badges
          </h2>
          <span className="text-xs font-mono text-amber-400 font-bold">
            {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {achievements.map(ach => (
            <div 
              key={ach.id}
              className={`p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                ach.unlocked 
                  ? 'bg-slate-950 border-amber-500/40 shadow-lg shadow-amber-500/5' 
                  : 'bg-slate-950/40 border-white/5 opacity-50'
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                ach.unlocked ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-zinc-900 border border-zinc-800'
              }`}>
                {ach.icon}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white truncate">{ach.title}</div>
                <div className="text-[10px] text-zinc-400 line-clamp-1">{ach.desc}</div>
                {ach.unlocked && (
                  <span className="text-[9px] font-mono text-emerald-400 font-bold block mt-0.5">✓ Unlocked</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MY REPORTED ISSUES TABLE */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white">My Reported Issues</h2>
        <div className="bg-slate-900/90 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-white/10 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <th className="px-6 py-4">Issue Title</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Officer Action Duration</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {myIssues.map((issue) => {
                const perf = calculateOfficerResponseDuration(issue);
                return (
                  <tr key={issue.id} className="hover:bg-slate-950/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{issue.title}</div>
                      <div className="text-xs text-zinc-400 capitalize">{issue.departmentId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        issue.status === 'resolved' || issue.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                        issue.status === 'in-progress' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-slate-800 text-zinc-300 border-white/10'
                      }`}>
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {issue.status === 'resolved' || issue.status === 'completed' ? (
                        <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${perf.badgeBg}`}>
                          ⏱️ {perf.durationText} • {perf.ratingText}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400 font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" /> Pending Action
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400 font-mono">
                      {issue.createdAt ? (
                        typeof issue.createdAt.toDate === 'function' ? format(issue.createdAt.toDate(), 'MMM d, yyyy') : format(new Date(issue.createdAt), 'MMM d, yyyy')
                      ) : 'Today'}
                    </td>
                    <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {issue.status === 'open' && (
                        <button 
                          onClick={() => {
                            setEditingIssue(issue);
                            setEditFormData({ title: issue.title, description: issue.description });
                          }}
                          className="p-2 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all border border-emerald-500/30"
                          title="Edit Issue"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => setDeletingIssueId(issue.id)}
                        className="p-2 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all border border-rose-500/30"
                        title="Delete Issue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
              {myIssues.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    You haven't reported any civic issues yet. Submit your first complaint under <span className="text-emerald-400 font-bold">Report Issue</span> to earn +10 Civic Coins!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DANGER ZONE: DELETE ACCOUNT SECTION */}
      <div className="bg-slate-900/90 border border-rose-500/30 p-6 md:p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Danger Zone: Account Deletion
            </h3>
            <p className="text-xs text-zinc-300">Permanently remove your CIVIX OS profile, civic coins, and reported complaints.</p>
          </div>
          <button
            onClick={() => setShowDeleteAccountModal(true)}
            className="px-5 py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 font-black rounded-2xl border border-rose-500/40 text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAccountModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deletingAccount && setShowDeleteAccountModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden p-8 text-center space-y-5"
            >
              <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
                <Trash2 className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Permanently Delete Account?</h3>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  This action is <span className="text-rose-400 font-bold">irreversible</span>. Your profile, all reported complaints, rank badges, and <span className="text-amber-400 font-bold">{coins} Civic Coins</span> will be permanently deleted.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteAccountModal(false)}
                  disabled={deletingAccount}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-zinc-300 font-bold rounded-2xl text-xs border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeletingAccount(true);
                    await deleteAccount();
                  }}
                  disabled={deletingAccount}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-rose-950/50"
                >
                  {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Account'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingIssueId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setDeletingIssueId(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white">Delete Issue?</h3>
              <p className="text-zinc-300 text-xs leading-relaxed">
                Are you sure you want to delete this issue? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingIssueId(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 text-zinc-300 font-bold rounded-xl text-xs border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteIssue}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg"
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Issue Modal */}
      <AnimatePresence>
        {editingIssue && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !savingEdit && setEditingIssue(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-emerald-400" /> Edit Reported Issue
                </h3>
                <button
                  onClick={() => setEditingIssue(null)}
                  className="p-1 hover:bg-slate-800 rounded-full text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateIssue} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Title</label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Description</label>
                  <textarea
                    rows={4}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingIssue(null)}
                    className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-zinc-300 text-xs font-bold rounded-xl border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 text-xs font-black rounded-xl shadow flex items-center gap-2"
                  >
                    {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
