import React, { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, doc, getDoc, updateDoc, increment, deleteDoc, serverTimestamp, writeBatch } from '../localStore';
import { MapPin, Clock, CheckCircle2, AlertCircle, MessageSquare, ThumbsUp, Sparkles, BarChart3, Bot, Send, X, Camera, User, Loader2, Edit2, Trash2, Megaphone, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { Link } from 'react-router-dom';
import { calculateOfficerResponseDuration } from '../utils';

export default function Feed() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [issues, setIssues] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [userLikes, setUserLikes] = useState<Record<string, boolean>>({});
  const [activeComments, setActiveComments] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingIssue, setEditingIssue] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ title: '', description: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsubAnn = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubAnn;
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'issues'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIssues(data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    }, (error) => {
      console.error("Feed snapshot error:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  // Track user likes efficiently
  useEffect(() => {
    if (!user || issues.length === 0) return;
    let isMounted = true;
    const issueIds = issues.map(i => i.id);

    Promise.all(issueIds.map(async (id) => {
      const snap = await getDoc(doc(db, `issues/${id}/likes`, user.uid));
      return [id, snap.exists()] as const;
    })).then(results => {
      if (!isMounted) return;
      const likesMap: Record<string, boolean> = {};
      results.forEach(([id, exists]) => { likesMap[id] = exists; });
      setUserLikes(likesMap);
    });

    return () => { isMounted = false; };
  }, [user, issues]);

  // Fetch comments when active
  useEffect(() => {
    if (!activeComments) {
      setComments([]);
      return;
    }

    const q = query(collection(db, `issues/${activeComments}/comments`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(data.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });

    return unsubscribe;
  }, [activeComments]);

  const handleLike = async (issueId: string) => {
    if (!user) return;
    
    const isLiked = userLikes[issueId];
    setUserLikes(prev => ({ ...prev, [issueId]: !isLiked }));
    const batch = writeBatch(db);
    const likeRef = doc(db, `issues/${issueId}/likes`, user.uid);
    const issueRef = doc(db, 'issues', issueId);

    try {
      if (isLiked) {
        batch.delete(likeRef);
        batch.update(issueRef, { likesCount: increment(-1) });
      } else {
        batch.set(likeRef, { createdAt: serverTimestamp() });
        batch.update(issueRef, { likesCount: increment(1) });
      }
      await batch.commit();
    } catch (error) {
      console.error("Like failed", error);
      setUserLikes(prev => ({ ...prev, [issueId]: isLiked }));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newComment.trim() || !activeComments) return;

    setSubmittingComment(true);
    const batch = writeBatch(db);
    const commentRef = doc(collection(db, `issues/${activeComments}/comments`));
    const issueRef = doc(db, 'issues', activeComments);

    try {
      batch.set(commentRef, {
        text: newComment.trim(),
        authorUid: user.uid,
        authorName: profile.displayName,
        authorPhotoUrl: profile.photoUrl || null,
        createdAt: serverTimestamp()
      });
      batch.update(issueRef, { commentsCount: increment(1) });
      await batch.commit();
      setNewComment('');
    } catch (error) {
      console.error("Comment failed", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateIssue = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const filteredIssues = issues.filter(issue => {
    if (filter === 'all') return true;
    return issue.status === filter;
  });

  if (loading) return <div className="flex justify-center py-12">{t('loading')}</div>;

  if (!user) {
    return (
      <div className="space-y-16 py-12">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider"
          >
            <Sparkles className="w-4 h-4" />
            {t('heroBadge')}
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-zinc-900 leading-[0.9]">
            {t('heroTitle')} <span className="text-emerald-600">{t('heroSubtitle')}</span>
          </h1>
          <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
            {t('heroDescription')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => { window.location.href = '/'; }}
              className="w-full sm:w-auto bg-zinc-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200"
            >
              {t('heroGetStarted')}
            </button>
            <button className="w-full sm:w-auto bg-white border border-zinc-200 text-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-zinc-50 transition-all">
              {t('heroExploreData')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: 'Social Reporting', desc: 'Post issues with photos and tags just like a social media feed.', icon: MessageSquare },
            { title: 'Agentic Routing', desc: 'AI agents automatically classify and route complaints to the right department.', icon: Bot },
            { title: 'Predictive Insights', desc: 'City analytics engine predicts hotspots and suggests data-driven solutions.', icon: BarChart3 }
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* LIVE OFFICIAL ANNOUNCEMENTS & ADVISORIES BANNER TICKER */}
      {announcements.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 via-rose-950/80 to-slate-900 border border-rose-500/40 p-4 md:p-5 rounded-[2rem] shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 bg-rose-500/20 border border-rose-500/40 rounded-2xl flex items-center justify-center text-rose-400 shrink-0 font-bold animate-pulse">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-500/40">
                  📢 Official Advisory ({announcements.length})
                </span>
                <span className="text-[11px] text-amber-300 font-mono font-bold truncate">
                  {announcements[0]?.title}
                </span>
              </div>
              <p className="text-xs text-zinc-300 truncate mt-0.5">
                <strong className="text-white font-bold">{announcements[0]?.area}:</strong> {announcements[0]?.description}
              </p>
            </div>
          </div>

          <Link
            to="/announcements"
            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-black rounded-xl border border-rose-500/40 flex items-center gap-1 shrink-0 transition-all shadow"
          >
            View Advisories <ChevronRight className="w-4 h-4 text-rose-400" />
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('feedTitle')}</h1>
          <p className="text-zinc-500 mt-1">{t('feedSubtitle')}</p>
        </div>
        <div className="flex gap-2 p-1 bg-zinc-100 rounded-lg self-start">
          {[
            { id: 'all', label: t('feedFilterAll') },
            { id: 'open', label: t('feedFilterOpen') },
            { id: 'in-progress', label: t('feedFilterInProgress') },
            { id: 'resolved', label: t('feedFilterResolved') }
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIssues.map((issue) => (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={issue.id}
            className="bg-white border border-zinc-200 rounded-3xl overflow-hidden hover:shadow-xl transition-shadow group flex flex-col"
          >
            {/* Image Header: Side-by-Side BEFORE & AFTER if resolved with photos */}
            {issue.status === 'resolved' && (issue.photoUrl || issue.resolutionPhotoUrl) ? (
              <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-zinc-950 aspect-video w-full overflow-hidden">
                {/* BEFORE IMAGE */}
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-zinc-900 flex items-center justify-center">
                  {issue.photoUrl ? (
                    <img 
                      src={issue.photoUrl} 
                      alt="Before Repair" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-[10px] text-zinc-500 font-medium">No Image Uploaded</div>
                  )}
                  <span className="absolute top-2 left-2 bg-red-600/90 text-white font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow backdrop-blur-sm">
                    BEFORE: Issue
                  </span>
                </div>
                {/* AFTER IMAGE */}
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-zinc-900 border border-emerald-500/30 flex items-center justify-center">
                  {issue.resolutionPhotoUrl ? (
                    <img 
                      src={issue.resolutionPhotoUrl} 
                      alt="After Repair" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-[10px] text-zinc-500 font-medium">No Resolution Proof Photo</div>
                  )}
                  <span className="absolute top-2 left-2 bg-emerald-600/90 text-white font-extrabold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow backdrop-blur-sm flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> AFTER: Fixed
                  </span>
                </div>
              </div>
            ) : issue.photoUrl ? (
              <div className="aspect-video w-full overflow-hidden bg-zinc-100 relative">
                <img 
                  src={issue.photoUrl} 
                  alt={issue.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-2 left-2 bg-zinc-900/80 text-white font-bold text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  Reported Photo
                </span>
              </div>
            ) : null}

            <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                    issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                    issue.status === 'in-progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-zinc-100 text-zinc-700'
                  }`}>
                    {issue.status}
                  </span>
                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {issue.createdAt ? formatDistanceToNow(issue.createdAt.toDate()) + ' ago' : 'Just now'}
                  </span>
                </div>

                <div className="relative">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="text-lg font-bold text-zinc-900 leading-tight flex-1">{issue.title}</h3>
                    {user && issue.reporterUid === user.uid && (
                      <div className="flex gap-1">
                        {issue.status === 'open' && (
                          <button 
                            onClick={() => {
                              setEditingIssue(issue);
                              setEditFormData({ title: issue.title, description: issue.description });
                            }}
                            className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-emerald-600 transition-colors"
                            title="Edit Issue"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => setDeletingIssueId(issue.id)}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-red-600 transition-colors"
                          title="Delete Issue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 mt-2 line-clamp-3 leading-relaxed">{issue.description}</p>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{issue.location?.address || 'Sheriguda, Ranga Reddy, Telangana'}</span>
                </div>

                {/* Resolution Remarks & Officer Response Duration Badge */}
                {issue.status === 'resolved' && (() => {
                  const perf = calculateOfficerResponseDuration(issue);
                  return (
                    <div className="p-3.5 bg-emerald-50/90 border border-emerald-200/80 rounded-xl space-y-2 shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Official Department Reply
                        </div>
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border ${perf.badgeBg}`}>
                          ⏱️ Officer Action: {perf.durationText} • {perf.ratingText}
                        </span>
                      </div>
                      {issue.resolutionNotes && (
                        <p className="text-xs text-emerald-950 font-medium leading-relaxed">{issue.resolutionNotes}</p>
                      )}
                      <div className="text-[10px] text-emerald-700 font-semibold pt-0.5 border-t border-emerald-100 flex justify-between items-center">
                        <span>Fixed by: {issue.resolvedByName || 'Department Officer'}</span>
                        <span>{issue.resolutionLocation || 'Site Verified'}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleLike(issue.id)}
                    className={`flex items-center gap-1.5 transition-colors ${
                      userLikes[issue.id] ? 'text-emerald-600' : 'text-zinc-500 hover:text-emerald-600'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${userLikes[issue.id] ? 'fill-emerald-600' : ''}`} />
                    <span className="text-xs font-medium">{issue.likesCount || 0}</span>
                  </button>
                  <button 
                    onClick={() => setActiveComments(issue.id)}
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-emerald-600 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-xs font-medium">{issue.commentsCount || 0}</span>
                  </button>
                </div>
                <div className="w-6 h-6 rounded-full bg-zinc-200 border border-white overflow-hidden">
                  {issue.reporterPhotoUrl ? (
                    <img src={issue.reporterPhotoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                      <User className="w-3 h-3 text-zinc-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comments Modal */}
      <AnimatePresence>
        {activeComments && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveComments(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{t('comments')}</h3>
                <button 
                  onClick={() => setActiveComments(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {comments.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>{t('noComments')}</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200">
                        {comment.authorPhotoUrl ? (
                          <img src={comment.authorPhotoUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-5 h-5 text-zinc-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm">{comment.authorName}</span>
                          <span className="text-[10px] text-zinc-400">
                            {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate()) + ' ago' : 'Just now'}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-600 leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-zinc-100 bg-zinc-50">
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t('addComment')}
                    className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-sm"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newComment.trim()}
                    className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    {submittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </form>
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
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Delete Issue?</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Are you sure you want to delete this issue? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={isDeleting}
                  onClick={() => setDeletingIssueId(null)}
                  className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting}
                  onClick={handleDeleteIssue}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingIssue(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">Edit Issue</h3>
                <button 
                  onClick={() => setEditingIssue(null)}
                  className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateIssue} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Title</label>
                  <input
                    type="text"
                    required
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Description</label>
                  <textarea
                    required
                    rows={4}
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingIssue(null)}
                    className="flex-1 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit || !editFormData.title.trim() || !editFormData.description.trim()}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {filteredIssues.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-zinc-200">
          <AlertCircle className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-900">{t('noIssues')}</h3>
          <p className="text-zinc-500">{t('noIssuesDesc')}</p>
        </div>
      )}
    </div>
  );
}
