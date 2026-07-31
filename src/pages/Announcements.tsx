import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from '../localStore';
import { useAuth } from '../AuthContext';
import { DEPARTMENTS } from '../constants';
import { Megaphone, AlertTriangle, Calendar, MapPin, Plus, Search, Filter, ShieldCheck, Clock, Trash2, X, Loader2, Sparkles, Building2, Truck, Zap, Droplets, GraduationCap, HeartPulse } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Announcement {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  area: string;
  category: string;
  duration: string;
  priority: 'Urgent' | 'Warning' | 'Info';
  description: string;
  officialName: string;
  createdAt: any;
}

export default function Announcements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    title: '',
    departmentId: profile?.departmentId || 'transport',
    area: '',
    category: 'Road Closure',
    duration: '',
    priority: 'Warning' as 'Urgent' | 'Warning' | 'Info',
    description: ''
  });

  const isOfficialOrAdmin = profile?.role === 'official' || profile?.role === 'admin';

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Announcement[];
      setAnnouncements(docs);
    }, (error) => {
      console.error("Announcements snapshot error:", error);
    });
    return unsubscribe;
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficialOrAdmin) {
      alert("Permission denied: Only verified city officials can publish advisories.");
      return;
    }
    if (!formData.title || !formData.area || !formData.duration || !formData.description) return;

    setSubmitting(true);
    try {
      const deptObj = DEPARTMENTS.find(d => d.id === formData.departmentId);
      await addDoc(collection(db, 'announcements'), {
        ...formData,
        departmentName: deptObj?.name || 'Municipal Administration',
        officialName: profile?.displayName || 'Department Official',
        createdAt: new Date().toISOString()
      });

      setShowCreateModal(false);
      setFormData({
        title: '',
        departmentId: profile?.departmentId || 'transport',
        area: '',
        category: 'Road Closure',
        duration: '',
        priority: 'Warning',
        description: ''
      });
    } catch (err) {
      console.error("Failed to post announcement", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      console.error("Delete announcement error:", err);
    }
  };

  const getDeptIcon = (id: string) => {
    switch(id) {
      case 'transport': return <Truck className="w-4 h-4 text-cyan-400" />;
      case 'electricity': return <Zap className="w-4 h-4 text-amber-400" />;
      case 'water': return <Droplets className="w-4 h-4 text-blue-400" />;
      case 'municipal': return <Building2 className="w-4 h-4 text-emerald-400" />;
      case 'education': return <GraduationCap className="w-4 h-4 text-purple-400" />;
      case 'health': return <HeartPulse className="w-4 h-4 text-rose-400" />;
      default: return <Megaphone className="w-4 h-4 text-zinc-400" />;
    }
  };

  const filteredAnnouncements = announcements.filter(item => {
    const matchesDept = selectedDept === 'all' || item.departmentId === selectedDept;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-20 font-sans text-white max-w-6xl mx-auto">
      
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-white/10 p-6 md:p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <motion.div 
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-16 h-16 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-rose-500/20 text-slate-950 shrink-0"
          >
            <Megaphone className="w-8 h-8" />
          </motion.div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Verified Official City Broadcasts
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Public Official Advisories & Announcements
            </h1>
            <p className="text-xs text-zinc-300">Live alerts regarding road closures, power outages, water maintenance & civic repairs.</p>
          </div>
        </div>

        {/* Action Button: ONLY for Verified Department Officials / Admins */}
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          {isOfficialOrAdmin ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-xl shadow-rose-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> Broadcast Official Advisory
            </button>
          ) : (
            <div className="px-4 py-2.5 bg-slate-950/90 text-rose-300 font-bold rounded-2xl border border-rose-500/30 text-xs flex items-center gap-2 shadow">
              <ShieldCheck className="w-4 h-4 text-rose-400" /> Official Channel (Read-Only)
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 border border-white/10 p-4 md:p-6 rounded-[2rem] shadow-xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search announcements by region, road, or department..."
            className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        </div>

        {/* Department Filter Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto custom-scrollbar pb-1 md:pb-0">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedDept === 'all' 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                : 'bg-slate-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            All Departments
          </button>
          {DEPARTMENTS.map(dept => (
            <button
              key={dept.id}
              onClick={() => setSelectedDept(dept.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedDept === dept.id 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                  : 'bg-slate-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {getDeptIcon(dept.id)} {dept.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Announcements List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatePresence>
          {filteredAnnouncements.map(ann => (
            <motion.div
              key={ann.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-6 rounded-[2rem] border shadow-2xl backdrop-blur-xl space-y-4 relative overflow-hidden flex flex-col justify-between ${
                ann.priority === 'Urgent' 
                  ? 'bg-slate-900/90 border-rose-500/40 shadow-rose-950/20' 
                  : ann.priority === 'Warning'
                  ? 'bg-slate-900/90 border-amber-500/40 shadow-amber-950/20'
                  : 'bg-slate-900/90 border-white/10'
              }`}
            >
              <div className="space-y-3">
                {/* Header Badge Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      ann.priority === 'Urgent'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : ann.priority === 'Warning'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    }`}>
                      {ann.priority === 'Urgent' ? '🚨 Urgent Alert' : ann.priority === 'Warning' ? '⚠️ Advisory' : 'ℹ️ Notice'}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono bg-slate-950 px-2.5 py-0.5 rounded-full border border-white/5">
                      {ann.category}
                    </span>
                  </div>

                  {/* Delete Button for Officials */}
                  {isOfficialOrAdmin && (
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all border border-rose-500/30"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-lg font-black text-white leading-snug">{ann.title}</h3>

                {/* Description */}
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">{ann.description}</p>
              </div>

              {/* Advisory Details Footer Box */}
              <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <strong className="text-white">Affected Area:</strong> {ann.area}
                  </span>
                </div>

                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <strong className="text-white">Duration:</strong> {ann.duration}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 font-mono">
                  <span className="flex items-center gap-1">
                    {getDeptIcon(ann.departmentId)} {ann.departmentName}
                  </span>
                  <span>Posted by: {ann.officialName}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredAnnouncements.length === 0 && (
          <div className="col-span-full p-12 bg-slate-900/90 border border-white/10 rounded-[2.5rem] text-center space-y-3">
            <Megaphone className="w-10 h-10 text-zinc-500 mx-auto" />
            <h4 className="text-base font-bold text-white">No Official Announcements Found</h4>
            <p className="text-xs text-zinc-400">There are no active road closure or public advisories matching your filter.</p>
          </div>
        )}
      </div>

      {/* Broadcast Announcement Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !submitting && setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden p-6 md:p-8 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-rose-400" /> Broadcast Official Advisory
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-slate-800 rounded-full text-zinc-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Advisory Title</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g., 🚧 Road Closure: Metro Construction on Main Flyover"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Department</label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      {DEPARTMENTS.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="Road Closure">Road Closure</option>
                      <option value="Power Outage">Power Outage</option>
                      <option value="Water Maintenance">Water Maintenance</option>
                      <option value="Traffic Alert">Traffic Alert</option>
                      <option value="Health Advisory">Health Advisory</option>
                      <option value="General Notice">General Notice</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Affected Area / Region</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g., Sheriguda & Sector 4 Main Road"
                      value={formData.area}
                      onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Effective Duration</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g., Aug 1 - Aug 5 (8:00 AM - 6:00 PM)"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Priority Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Urgent', 'Warning', 'Info'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: p })}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          formData.priority === p 
                            ? p === 'Urgent' 
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow' 
                              : p === 'Warning'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow'
                            : 'bg-slate-950 text-zinc-400 border-zinc-800'
                        }`}
                      >
                        {p === 'Urgent' ? '🚨 Urgent' : p === 'Warning' ? '⚠️ Warning' : 'ℹ️ Info'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Description & Detour Guidelines</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide details, reason for closure/repair, and recommended alternate routes..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-2xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-zinc-300 text-xs font-bold rounded-xl border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publish Advisory'}
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
