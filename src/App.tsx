import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LanguageProvider, useLanguage } from './LanguageContext';
import { auth, signOut } from './localStore';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { ShieldCheck, LogOut, Menu, X, Plus, BarChart3, User as UserIcon, Loader2, Languages, Map as MapIcon, Trophy, Bot, Sparkles, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DEPARTMENTS } from './constants';

// Lazy-loaded Pages
const Feed = lazy(() => import('./pages/Feed'));
const ReportIssue = lazy(() => import('./pages/ReportIssue'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const DepartmentDashboard = lazy(() => import('./pages/DepartmentDashboard'));
const CityMap = lazy(() => import('./pages/CityMap'));
const Login = lazy(() => import('./pages/Login'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const AiAssistant = lazy(() => import('./pages/AiAssistant'));
const Announcements = lazy(() => import('./pages/Announcements'));
import type { Language } from './translations';

const Navbar = () => {
  const { user, profile, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showLang, setShowLang] = useState(false);

  const handleLogout = () => logout();

  if (!user || !profile) return null;

  const roleColor = profile.role === 'admin' 
    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
    : profile.role === 'official' 
    ? 'bg-amber-100 text-amber-800 border-amber-300' 
    : 'bg-blue-100 text-blue-800 border-blue-300';

  return (
    <nav className="bg-slate-950/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-lg text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <ShieldCheck className="text-slate-950 w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">{t('appName')}</span>
            </Link>
            <span className={`hidden xl:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleColor}`}>
              {profile.role === 'admin' ? 'Central Admin' : profile.role === 'official' ? `${(DEPARTMENTS.find(d => d.id === profile.departmentId)?.name || profile.departmentId || 'Dept').toUpperCase()} Official` : 'Citizen'}
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center space-x-3 xl:space-x-4">
            <Link to="/" className="text-xs font-semibold text-zinc-300 hover:text-emerald-400 transition-colors px-1">{t('feed')}</Link>
            
            {/* PUBLIC ADVISORIES & ANNOUNCEMENTS LINK */}
            <Link to="/announcements" className="flex items-center gap-1 text-xs font-bold text-rose-300 bg-rose-950/60 px-3 py-1.5 rounded-full hover:bg-rose-900/80 transition-all border border-rose-500/40 shadow-lg shadow-rose-500/10 shrink-0">
              <Megaphone className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Advisories
            </Link>

            {/* CIVIX AI ASSISTANT LINK */}
            <Link to="/ai-assistant" className="flex items-center gap-1 text-xs font-black text-cyan-300 bg-cyan-950/60 px-3 py-1.5 rounded-full hover:bg-cyan-900/80 transition-all border border-cyan-500/40 shadow-lg shadow-cyan-500/10 shrink-0">
              <Bot className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Ask CIVIX AI
            </Link>

            {profile?.role !== 'official' && profile?.role !== 'admin' && (
              <Link to="/report" className="flex items-center gap-1 text-xs font-bold bg-emerald-500 text-slate-950 px-3.5 py-1.5 rounded-full hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 shrink-0">
                <Plus className="w-3.5 h-3.5" /> {t('reportIssue')}
              </Link>
            )}
            <Link to="/map" className="flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-cyan-400 transition-colors px-1">
              <MapIcon className="w-3.5 h-3.5 text-cyan-400" /> {t('map')}
            </Link>
            <Link to="/analytics" className="flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-purple-400 transition-colors px-1">
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> {t('analytics')}
            </Link>
            <Link to="/leaderboard" className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-950/60 px-3 py-1.5 rounded-full hover:bg-amber-900/80 transition-all border border-amber-500/40 shadow-sm shrink-0">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> Champions
            </Link>
            {(profile?.role === 'official' || profile?.role === 'admin') && (
              <Link to="/department" className="flex items-center gap-1 text-xs font-semibold bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full hover:bg-amber-500/30 transition-colors border border-amber-500/40 shrink-0">
                Department Hub
              </Link>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setShowLang(!showLang)}
                className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-emerald-400 transition-colors bg-zinc-900 px-2.5 py-1 rounded-lg border border-white/10"
              >
                <Languages className="w-4 h-4 text-emerald-400" />
                <span className="uppercase">{language}</span>
              </button>
              <AnimatePresence>
                {showLang && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-32 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 text-white"
                  >
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'te', label: 'తెలుగు' },
                      { code: 'hi', label: 'हिंदी' }
                    ].map((lang: { code: Language; label: string }) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLang(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs hover:bg-zinc-800 transition-colors ${language === lang.code ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile & Stacked Centered Logout Button (Moved Left) */}
            <div className="flex flex-col items-center justify-center gap-1 shrink-0">
              <Link to="/dashboard" className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-full hover:bg-slate-800 transition-colors border border-white/10 shadow-sm max-w-[160px]">
                <UserIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-xs font-extrabold text-white truncate max-w-[95px]">{profile?.displayName}</span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 font-black text-[9px] rounded-full border border-amber-500/30 shrink-0">
                  🪙 {profile?.civicCoins || 0}
                </span>
              </Link>
              
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-950/90 hover:bg-rose-600 hover:text-white px-3 py-0.5 rounded-full border border-rose-500/50 shadow-md transition-all" 
                title="Sign Out"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-zinc-300 p-2">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-white/10 bg-slate-900 text-white px-4 pt-2 pb-4 space-y-3"
          >
            <Link to="/" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium hover:bg-zinc-800 rounded-lg">{t('feed')}</Link>
            <Link to="/announcements" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-rose-300 bg-rose-950/60 rounded-lg border border-rose-500/30">
              <Megaphone className="w-4 h-4 text-rose-400" /> Public Advisories
            </Link>
            <Link to="/ai-assistant" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-cyan-300 bg-cyan-950/60 rounded-lg border border-cyan-500/30">
              <Bot className="w-4 h-4 text-cyan-400" /> Ask CIVIX AI
            </Link>
            {profile?.role !== 'official' && profile?.role !== 'admin' && (
              <Link to="/report" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium text-emerald-400 font-bold hover:bg-zinc-800 rounded-lg">{t('reportIssue')}</Link>
            )}
            <Link to="/map" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium hover:bg-zinc-800 rounded-lg">{t('map')}</Link>
            <Link to="/analytics" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium hover:bg-zinc-800 rounded-lg">{t('analytics')}</Link>
            <Link to="/leaderboard" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-bold text-amber-300 hover:bg-zinc-800 rounded-lg">🏆 Champions Leaderboard</Link>
            {(profile?.role === 'official' || profile?.role === 'admin') && (
              <Link to="/department" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium text-amber-400 hover:bg-zinc-800 rounded-lg">Department Hub</Link>
            )}
            <Link to="/dashboard" onClick={() => setIsOpen(false)} className="block px-3 py-2 text-sm font-medium hover:bg-zinc-800 rounded-lg">{t('dashboard')}</Link>
            <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-300 bg-rose-500/20 rounded-xl border border-rose-500/40 flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-400" /> {t('logout')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-slate-950 font-sans text-zinc-100 flex flex-col">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <Suspense fallback={
                <div className="flex justify-center items-center py-36">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
                </div>
              }>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />
                  <Route path="/" element={<ProtectedRoute><HomeRedirect /></ProtectedRoute>} />
                  <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
                  <Route path="/report" element={<ProtectedRoute><ReportIssue /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                  <Route path="/department" element={<ProtectedRoute><DepartmentDashboard /></ProtectedRoute>} />
                  <Route path="/map" element={<ProtectedRoute><CityMap /></ProtectedRoute>} />
                  <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
                  <Route path="/ai-assistant" element={<ProtectedRoute><AiAssistant /></ProtectedRoute>} />
                  <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-36">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user && !profile) {
    return (
      <div className="flex flex-col justify-center items-center py-36 space-y-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <div className="text-zinc-400 font-medium text-sm">Setting up your CIVIX OS profile...</div>
      </div>
    );
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { profile } = useAuth();
  if (profile?.role === 'official' || profile?.role === 'admin') {
    return <DepartmentDashboard />;
  }
  return <Feed />;
}
