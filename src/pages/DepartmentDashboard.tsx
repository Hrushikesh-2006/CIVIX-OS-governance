import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, onSnapshot, where, updateDoc, doc, serverTimestamp, pruneImagesInStore, awardUserCoins } from '../localStore';
import { useAuth } from '../AuthContext';
import { Building2, CheckCircle2, Clock, AlertCircle, Loader2, Truck, Zap, Droplets, GraduationCap, HeartPulse, Camera, Upload, MapPin, X, Check, FileText, Sparkles, ShieldCheck, Tag, Info, AlertTriangle, ShieldAlert, CheckCheck, RefreshCw, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, format } from 'date-fns';
import { compressImage } from '../utils';

export default function DepartmentDashboard() {
  const { profile, logout } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [scope, setScope] = useState<'assigned' | 'all'>('assigned');

  // Resolution modal state
  const [resolvingIssue, setResolvingIssue] = useState<any | null>(null);
  const [resolutionPhoto, setResolutionPhoto] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [resolutionLocation, setResolutionLocation] = useState<string>('');
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const resolutionFileRef = useRef<HTMLInputElement>(null);

  const getDeptIcon = (id: string | undefined) => {
    switch(id) {
      case 'municipal': return <Building2 className="text-emerald-400 w-7 h-7" />;
      case 'transport': return <Truck className="text-amber-400 w-7 h-7" />;
      case 'electricity': return <Zap className="text-yellow-400 w-7 h-7" />;
      case 'water': return <Droplets className="text-cyan-400 w-7 h-7" />;
      case 'education': return <GraduationCap className="text-purple-400 w-7 h-7" />;
      case 'health': return <HeartPulse className="text-rose-400 w-7 h-7" />;
      default: return <Building2 className="text-emerald-400 w-7 h-7" />;
    }
  };

  useEffect(() => {
    if (!profile) return;
    
    let q;
    if (profile.role === 'admin' || scope === 'all') {
      q = query(collection(db, 'issues'));
    } else {
      q = query(collection(db, 'issues'), where('departmentId', '==', profile.departmentId || 'municipal'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIssues(docs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    }, (error) => {
      console.error("Dept snapshot error:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [profile, scope]);

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    setUpdating(issueId);
    try {
      await updateDoc(doc(db, 'issues', issueId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to update status", error);
    } finally {
      setUpdating(null);
    }
  };

  const handleOpenResolveModal = (issue: any) => {
    setResolvingIssue(issue);
    setResolutionNotes(issue.resolutionNotes || `Fault inspected and repaired. Replacement completed and site verified by ${profile?.displayName || 'Department Officer'}.`);
    setResolutionLocation(issue.resolutionLocation || issue.location?.address || 'Site Location');
    setResolutionPhoto(issue.resolutionPhotoUrl || '');
  };

  const handleResolutionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setResolutionPhoto(dataUrl);
          try {
            const compressed = await compressImage(file, 400, 400, 0.5);
            if (compressed) {
              setResolutionPhoto(compressed);
            }
          } catch (err) {
            console.warn('Image compression fallback:', err);
          }
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleConfirmResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingIssue) return;

    setSubmittingResolution(true);
    try {
      pruneImagesInStore(resolvingIssue.id);

      await updateDoc(doc(db, 'issues', resolvingIssue.id), {
        status: 'resolved',
        resolutionPhotoUrl: resolutionPhoto || '',
        resolutionNotes: resolutionNotes.trim() || 'Work completed and site verified by department officials.',
        resolutionLocation: resolutionLocation.trim() || resolvingIssue.location?.address || 'Site Location',
        resolvedByName: profile?.displayName || 'Official Officer',
        resolvedByDept: profile?.departmentId || 'municipal',
        resolvedAt: serverTimestamp(),
        resolvedAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      // Award +5 Bonus Civic Coins to the citizen who reported the issue!
      if (resolvingIssue.reporterUid) {
        awardUserCoins(resolvingIssue.reporterUid, 5, true);
      }

      setResolvingIssue(null);
      setResolutionPhoto('');
    } catch (error) {
      console.error("Failed to submit resolution", error);
    } finally {
      setSubmittingResolution(false);
    }
  };

  if (profile?.role !== 'official' && profile?.role !== 'admin') {
    return (
      <div className="text-center py-20 bg-slate-900 rounded-3xl border border-zinc-800 text-white">
        <ShieldCheck className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-zinc-400 text-sm mt-1">Only registered government department officials can view this complaint command center.</p>
      </div>
    );
  }

  const filteredIssues = issues.filter(issue => {
    if (filter === 'pending') return issue.status !== 'resolved';
    if (filter === 'resolved') return issue.status === 'resolved';
    return true;
  });

  return (
    <div className="space-y-8 pb-20 font-sans text-zinc-100">
      {/* Official Header */}
      <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-800 border border-white/10 rounded-2xl flex items-center justify-center shadow-inner">
            {getDeptIcon(profile?.departmentId)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Official Complaint Command Hub
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {profile?.role === 'admin' ? 'Central Admin Operations' : `${profile?.departmentId?.toUpperCase()} Department Portal`}
            </h1>
            <p className="text-zinc-400 text-xs mt-1">
              AI-routed citizen complaints requiring inspection, action updates, and official resolution proof.
            </p>
            <div className="pt-2.5">
              <button
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-black shadow transition-all"
                title="Logout of Department Portal"
              >
                <LogOut className="w-4 h-4 text-rose-400" /> Logout from Official Portal
              </button>
            </div>
          </div>
        </div>

        {/* Scope & Status Controls */}
        <div className="flex flex-wrap gap-3 items-center self-start">

          <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
            <button
              onClick={() => setScope('assigned')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scope === 'assigned' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              My Dept ({issues.filter(i => profile?.role === 'admin' || i.departmentId === (profile?.departmentId || 'municipal')).length})
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scope === 'all' ? 'bg-amber-500 text-slate-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              All City Complaints
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
            {[
              { id: 'pending', label: `Pending (${issues.filter(i => i.status !== 'resolved').length})` },
              { id: 'resolved', label: `Completed (${issues.filter(i => i.status === 'resolved').length})` },
              { id: 'all', label: `Total (${issues.length})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f.id ? 'bg-white text-slate-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Complaint Command Cards */}
      <div className="space-y-8">
        {filteredIssues.map((issue) => {
          const issueIdShort = `CIV-${(issue.id || '').slice(-5).toUpperCase()}`;
          const resIdShort = `RES-${(issue.id || '').slice(-5).toUpperCase()}`;
          const isResolved = issue.status === 'resolved';
          const isInProgress = issue.status === 'in-progress';

          return (
            <div 
              key={issue.id} 
              className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-6 relative overflow-hidden"
            >
              {/* Top Bar: Action Buttons & AI Triage Tag */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                    isResolved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                    isInProgress ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                    'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {isResolved ? '✓ Completed & Fixed' : isInProgress ? '⏳ Work In Progress' : '🚨 Complaint Registered'}
                  </span>

                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase tracking-wider">
                    {issue.category || 'General'}
                  </span>

                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    {issue.createdAt?.seconds ? formatDistanceToNow(new Date(issue.createdAt.seconds * 1000)) + ' ago' : 'Recently'}
                  </span>
                </div>

                {/* Status Action Buttons for Officials */}
                <div className="flex items-center gap-2">
                  {!isResolved && (
                    <>
                      <button
                        disabled={updating === issue.id}
                        onClick={() => handleStatusChange(issue.id, isInProgress ? 'open' : 'in-progress')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                          isInProgress 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' 
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {updating === issue.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {isInProgress ? 'Set: Complaint Registered' : 'Set: Work In Progress'}
                      </button>

                      <button
                        onClick={() => handleOpenResolveModal(issue)}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Complete & Post Proof
                      </button>
                    </>
                  )}

                  {isResolved && (
                    <button
                      onClick={() => handleOpenResolveModal(issue)}
                      className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> Edit Resolution Proof
                    </button>
                  )}
                </div>
              </div>

              {/* DUAL CARD LAYOUT: Matching Exact User UI Design Mockup */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT CARD: ISSUE DETAILS (BEFORE) */}
                <div className="bg-slate-950/80 rounded-3xl p-5 border border-white/10 shadow-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-rose-400" /> ISSUE DETAILS
                      </span>
                      <span className="bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-md shadow-md">
                        BEFORE
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white leading-snug">
                      Reported Issue: {issue.title}
                    </h4>

                    {/* Reported Photo */}
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
                      {issue.photoUrl ? (
                        <img src={issue.photoUrl} alt="Reported Issue" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-xs text-zinc-500 font-medium">No Image Uploaded by Citizen</div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-[10px] text-zinc-300 font-mono px-2.5 py-1 rounded-md">
                        {issue.createdAt?.seconds ? format(new Date(issue.createdAt.seconds * 1000), 'MMM dd, yyyy hh:mm a') : 'Reported'}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                      {issue.description}
                    </p>
                  </div>

                  {/* Metadata Table */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/10 pt-3">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Issue ID:</span>
                      <span className="font-mono font-bold text-white">{issueIdShort}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Category:</span>
                      <span className="font-bold text-emerald-400 capitalize">{issue.category}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5 col-span-2">
                      <span className="text-zinc-500">Location:</span>
                      <span className="font-medium text-zinc-300 truncate max-w-[200px]">{issue.location?.address || 'Site Location'}</span>
                    </div>
                    <div className="flex justify-between py-1 col-span-2">
                      <span className="text-zinc-500">Citizen Reporter:</span>
                      <span className="font-bold text-white">{issue.reporterName || 'Citizen User'}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT CARD: RESOLUTION PROOF (AFTER) */}
                <div className="bg-slate-950/80 rounded-3xl p-5 border border-emerald-500/20 shadow-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> RESOLUTION PROOF
                      </span>
                      <span className="bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-md shadow-md">
                        AFTER
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white leading-snug">
                      Resolution Proof: {isResolved ? 'Repaired & Verified' : 'Awaiting Official Action'}
                    </h4>

                    {/* Resolution Proof Photo */}
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-zinc-900 border border-emerald-500/30 flex items-center justify-center">
                      {issue.resolutionPhotoUrl ? (
                        <>
                          <img src={issue.resolutionPhotoUrl} alt="Resolution Proof" className="w-full h-full object-cover" />
                          {/* Official Seal Overlay */}
                          <div className="absolute bottom-3 right-3 bg-emerald-950/90 border border-emerald-400/50 backdrop-blur-md rounded-full px-3 py-1 flex items-center gap-1.5 shadow-xl">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span className="text-[9px] font-black uppercase text-emerald-300 tracking-wider">OFFICIAL REPAIRED & VERIFIED</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <Camera className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                          <span className="text-xs text-zinc-500 font-medium block">No Resolution Proof Uploaded Yet</span>
                          {!isResolved && (
                            <button
                              onClick={() => handleOpenResolveModal(issue)}
                              className="mt-2 text-xs font-bold text-emerald-400 hover:underline"
                            >
                              + Upload Official Fix Image
                            </button>
                          )}
                        </div>
                      )}
                      {issue.resolvedAt?.seconds && (
                        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-[10px] text-zinc-300 font-mono px-2.5 py-1 rounded-md">
                          {format(new Date(issue.resolvedAt.seconds * 1000), 'MMM dd, yyyy hh:mm a')}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-emerald-200/90 leading-relaxed bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/20 italic">
                      "{issue.resolutionNotes || 'Official resolution pending inspection by department team.'}"
                    </p>
                  </div>

                  {/* Metadata Table */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/10 pt-3">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Resolution ID:</span>
                      <span className="font-mono font-bold text-emerald-400">{resIdShort}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-zinc-500">Department:</span>
                      <span className="font-bold text-white uppercase">{issue.departmentId}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5 col-span-2">
                      <span className="text-zinc-500">Status:</span>
                      <span className="font-bold text-emerald-300">{isResolved ? 'Repaired & Verified' : isInProgress ? 'Under Action' : 'Registered'}</span>
                    </div>
                    <div className="flex justify-between py-1 col-span-2">
                      <span className="text-zinc-500">Assigned Officer:</span>
                      <span className="font-bold text-white">{issue.resolvedByName || profile?.displayName || 'Department Team'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: LIVE STATUS BANNER & OFFICIAL NOTES */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* LIVE STATUS BANNER */}
                <div className="bg-slate-950/80 rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    <span>LIVE STATUS</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                      <Clock className="w-3.5 h-3.5" /> Updated Recently
                    </span>
                  </div>
                  <div className={`py-4 rounded-xl font-black text-center text-lg tracking-wider border shadow-inner ${
                    isResolved ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10' :
                    isInProgress ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/10' :
                    'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-500/10'
                  }`}>
                    STATUS: {isResolved ? 'RESOLVED & COMPLETED' : isInProgress ? 'WORK IN PROGRESS' : 'COMPLAINT REGISTERED'}
                  </div>
                  <div className="text-[10px] text-zinc-500 text-center font-mono">
                    Last sync: {new Date().toLocaleTimeString()}
                  </div>
                </div>

                {/* OFFICIAL NOTES */}
                <div className="bg-slate-950/80 rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    <span>OFFICIAL NOTES</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {issue.resolutionNotes || 'Department officer inspection underway. Action plan initiated for rapid repair.'}
                  </p>
                  <div className="text-[10px] text-zinc-500 font-mono flex justify-between border-t border-white/5 pt-2">
                    <span>Officer: {issue.resolvedByName || 'Assigned Officer'}</span>
                    <span>Dept: {issue.departmentId?.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredIssues.length === 0 && (
          <div className="text-center py-20 bg-slate-900/80 rounded-3xl border border-dashed border-zinc-800 text-zinc-400 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto opacity-40" />
            <h3 className="text-lg font-bold text-white">No Complaints Found</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">There are currently no active complaints matching your filter criteria.</p>
          </div>
        )}
      </div>

      {/* RESOLUTION PROOF UPLOAD MODAL */}
      <AnimatePresence>
        {resolvingIssue && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold">Complete Complaint & Post Proof</h3>
                </div>
                <button 
                  onClick={() => setResolvingIssue(null)}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleConfirmResolution} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Complaint</label>
                  <div className="p-3 bg-slate-950 rounded-xl border border-white/5 text-sm font-bold text-emerald-300">
                    {resolvingIssue.title}
                  </div>
                </div>

                {/* Upload Resolution Photo */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-400" /> Upload Fix / Repair Proof Image
                  </label>
                  <div 
                    onClick={() => resolutionFileRef.current?.click()}
                    className="aspect-video w-full bg-slate-950 rounded-2xl border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all relative group"
                  >
                    <input 
                      type="file" 
                      ref={resolutionFileRef}
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleResolutionFileChange} 
                    />
                    {resolutionPhoto ? (
                      <>
                        <img src={resolutionPhoto} alt="Resolution Proof" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Upload className="w-6 h-6 text-white" />
                          <span className="text-xs font-bold">Change Image</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6 space-y-2">
                        <Upload className="w-8 h-8 text-emerald-400 mx-auto" />
                        <span className="text-xs font-bold block text-white">Click to Upload Resolution Proof Photo</span>
                        <span className="text-[10px] text-zinc-500 block">Upload photo showing the repaired location / completed work</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolution Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Official Inspection & Repair Notes</label>
                  <textarea
                    required
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe the fault identified, repair work done, materials replaced, and inspection status..."
                    className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-zinc-500 transition-all resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Site Location Tag</label>
                  <input
                    type="text"
                    value={resolutionLocation}
                    onChange={(e) => setResolutionLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white transition-all"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-white/10 sticky bottom-0 bg-slate-900 pb-2">
                  <button
                    type="button"
                    onClick={() => setResolvingIssue(null)}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold text-xs transition-colors text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingResolution}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submittingResolution ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm & Publish Resolution
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
