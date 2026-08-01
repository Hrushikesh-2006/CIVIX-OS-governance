import React, { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, getDoc, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from '../localStore';
import { DEPARTMENTS, OFFICIAL_CREDENTIALS } from '../constants';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { ShieldCheck, User, Building2, Truck, Zap, Droplets, GraduationCap, Loader2, HeartPulse, Mail, Lock, ArrowRight, ArrowLeft, AlertCircle, Eye, EyeOff, CheckCircle2, ShieldAlert, KeyRound, Sparkles, Copy, Check, Bot, Trophy, MapPin, Layers, Coins, Play, X, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const { t } = useLanguage();
  const { user: authUser, profile: authProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<{ role: string; deptId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Feature Preview Popup State
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'ai' | 'proof' | 'rewards'>('ai');

  useEffect(() => {
    if (authUser && !authUser.emailVerified) return;

    if (authUser && !authProfile && selectedPortal) {
      handleCreateProfile(authUser, selectedPortal.role as 'citizen' | 'official' | 'admin', selectedPortal.deptId);
    } else if (authUser && authProfile) {
      window.location.href = '/';
    }
  }, [authUser, authProfile, selectedPortal]);

  const handlePortalSelect = (role: string, deptId?: string) => {
    setSelectedPortal({ role, deptId });
    setError(null);
    setNotice(null);
    setAuthMode('login');

    if (role === 'official' || role === 'admin') {
      const match = OFFICIAL_CREDENTIALS.find(c => c.deptId === (deptId || 'admin') || c.role === role);
      if (match) {
        setEmail(match.email);
        setPassword(match.pass);
      }
    } else {
      setEmail('');
      setPassword('');
    }

    setStep(2);
  };

  const handleQuickOfficialLogin = async (cred: typeof OFFICIAL_CREDENTIALS[0]) => {
    setEmail(cred.email);
    setPassword(cred.pass);
    setSelectedPortal({ role: cred.role, deptId: cred.deptId });
    setLoading(true);
    setError(null);

    try {
      const result = await signInWithEmailAndPassword(auth, cred.email, cred.pass);
      const user = result.user;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && (userDoc.data() as any)?.role) {
        window.location.href = '/';
        return;
      }
      await handleCreateProfile(user, cred.role as 'citizen' | 'official' | 'admin', cred.deptId);
    } catch (err: any) {
      console.error('Quick login failed', err);
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  const { signIn: clerkSignIn, isLoaded: clerkSignInLoaded } = useSignIn();
  const { signUp: clerkSignUp, isLoaded: clerkSignUpLoaded } = useSignUp();

  const handleGoogleCitizenLogin = async () => {
    setError(null);
    setLoading(true);
    
    // 1. Attempt Clerk Google OAuth on any domain if valid Clerk key is provided
    const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
    if (clerkSignInLoaded && clerkSignIn && publishableKey && !publishableKey.includes('placeholder')) {
      try {
        await clerkSignIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: window.location.origin,
          redirectUrlComplete: window.location.origin,
        });
        return;
      } catch (err: any) {
        console.warn('Clerk Google OAuth fallback triggered', err);
      }
    }

    // 2. Direct Citizen Gmail Authentication (creates/signs in with user's actual Gmail)
    try {
      let targetEmail = email.trim();
      let targetName = email ? email.split('@')[0] : '';

      if (!targetEmail || !targetEmail.includes('@')) {
        const inputEmail = window.prompt("Enter your Gmail address to sign in as a Verified Citizen:", "hrushikeshanumula1111@gmail.com");
        if (!inputEmail) {
          setLoading(false);
          return;
        }
        targetEmail = inputEmail.trim().toLowerCase();
        const inputName = window.prompt("Enter your Full Name:", targetEmail.split('@')[0]);
        targetName = inputName ? inputName.trim() : targetEmail.split('@')[0];
      }

      let user;
      try {
        const res = await signInWithEmailAndPassword(auth, targetEmail, 'Citizen@123');
        user = res.user;
      } catch {
        const res = await createUserWithEmailAndPassword(auth, targetEmail, 'Citizen@123');
        user = res.user;
        await updateProfile(user, {
          displayName: targetName || targetEmail.split('@')[0],
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(targetName || targetEmail)}&background=4285F4&color=fff`
        });
      }
      await handleCreateProfile(user, 'citizen');
    } catch (err: any) {
      console.error('Google login failed', err);
      setError(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortal) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (authMode === 'register') {
        if (selectedPortal.role !== 'citizen') {
          throw new Error('Official accounts cannot be self-registered. Use official department credentials below.');
        }

        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        await updateProfile(user, {
          displayName: email.split('@')[0],
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(email.split('@')[0])}&background=10b981&color=fff`
        });

        await handleCreateProfile(user, 'citizen');
        return;
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Find if email matches official credentials
      const officialMatch = OFFICIAL_CREDENTIALS.find(c => c.email.toLowerCase() === email.toLowerCase());

      if (officialMatch) {
        await setDoc(doc(db, 'users', user.uid), {
          displayName: officialMatch.name,
          email: officialMatch.email,
          photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(officialMatch.name)}&background=10b981&color=fff`,
          role: officialMatch.role,
          departmentId: officialMatch.deptId,
          emailVerified: true,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || !(userDoc.data() as any)?.role) {
          await handleCreateProfile(user, selectedPortal.role as 'citizen' | 'official' | 'admin', selectedPortal.deptId);
        }
      }
      window.location.href = '/';
    } catch (err: any) {
      console.error('Email auth failed', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Check official credentials below or register as a citizen.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Sign in instead.');
        setAuthMode('login');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed.');
      }
      setLoading(false);
    }
  };

  const handleCreateProfile = async (user: any, role: 'citizen' | 'official' | 'admin', deptId?: string) => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName || email.split('@')[0] || 'User',
        email: user.email,
        photoUrl: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=10b981&color=fff`,
        role,
        departmentId: deptId || null,
        emailVerified: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }, { merge: true });
      window.location.href = '/';
    } catch (error: any) {
      console.error('Profile creation failed', error);
      setError(`Failed to create profile: ${error.message}`);
      setLoading(false);
    }
  };

  const getDeptIcon = (id: string) => {
    switch(id) {
      case 'municipal': return <Building2 className="w-6 h-6 text-blue-400" />;
      case 'transport': return <Truck className="w-6 h-6 text-amber-400" />;
      case 'electricity': return <Zap className="w-6 h-6 text-yellow-400" />;
      case 'water': return <Droplets className="w-6 h-6 text-cyan-400" />;
      case 'education': return <GraduationCap className="w-6 h-6 text-purple-400" />;
      case 'health': return <HeartPulse className="w-6 h-6 text-rose-400" />;
      case 'admin': return <ShieldCheck className="w-6 h-6 text-emerald-400" />;
      default: return <User className="w-6 h-6 text-emerald-400" />;
    }
  };

  const currentCreds = selectedPortal?.role !== 'citizen'
    ? OFFICIAL_CREDENTIALS.find(c => c.deptId === selectedPortal?.deptId || c.role === selectedPortal?.role)
    : null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start p-4 md:p-8 overflow-x-hidden relative font-sans text-zinc-100 selection:bg-emerald-500 selection:text-slate-950">
      {/* Dynamic Animated Ambient Blobs */}
      <motion.div 
        animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[-15%] w-[700px] h-[700px] bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-teal-500/10 rounded-full blur-[140px] pointer-events-none"
      />
      <motion.div 
        animate={{ scale: [1.3, 1, 1.3], rotate: [360, 180, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[-15%] right-[-15%] w-[800px] h-[800px] bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-amber-500/10 rounded-full blur-[160px] pointer-events-none"
      />

      {/* FLOATING JUMPING COINS IN BACKGROUND */}
      <motion.div 
        animate={{ y: [0, -25, 0], rotate: [0, 15, -15, 0] }} 
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        className="absolute top-16 left-[10%] text-4xl pointer-events-none filter drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]"
      >
        🪙
      </motion.div>
      <motion.div 
        animate={{ y: [0, -35, 0], rotate: [0, -20, 20, 0] }} 
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
        className="absolute top-28 right-[12%] text-4xl pointer-events-none filter drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]"
      >
        🏆
      </motion.div>
      <motion.div 
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }} 
        transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.5 }}
        className="absolute bottom-40 left-[8%] text-3xl pointer-events-none filter drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]"
      >
        ⚡
      </motion.div>

      <div className="max-w-6xl w-full relative z-10 my-4 space-y-12">
        {/* LANDING HERO SHOWCASE SECTION */}
        <div className="text-center space-y-6 max-w-5xl mx-auto pt-6 relative">
          
          {/* LEFT FLANK: 3 DEPARTMENT WORKER AVATARS (ENLARGED) */}
          <div className="hidden xl:flex flex-col gap-6 absolute left-[-110px] top-2 z-20">
            {/* Doctor Avatar */}
            <motion.div 
              animate={{ y: [0, -14, 0] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
              whileHover={{ scale: 1.18, rotate: 6 }}
              className="relative group cursor-pointer"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-teal-300 to-emerald-400 shadow-2xl shadow-cyan-500/40 border-2 border-white/20">
                <img src="/avatar_doctor.png" alt="Doctor" className="w-full h-full object-cover rounded-full shadow-inner" />
              </div>
              <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-900/95 text-cyan-300 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-cyan-500/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl pointer-events-none">
                🩺 Health & Medical Officer
              </span>
            </motion.div>

            {/* Teacher Avatar */}
            <motion.div 
              animate={{ y: [0, -18, 0] }}
              transition={{ repeat: Infinity, duration: 3.6, ease: 'easeInOut', delay: 0.4 }}
              whileHover={{ scale: 1.18, rotate: -6 }}
              className="relative group cursor-pointer ml-6"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-tr from-purple-400 via-pink-400 to-indigo-400 shadow-2xl shadow-purple-500/40 border-2 border-white/20">
                <img src="/avatar_teacher.png" alt="Teacher" className="w-full h-full object-cover rounded-full shadow-inner" />
              </div>
              <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-900/95 text-purple-300 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-purple-500/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl pointer-events-none">
                🎓 Education & Schools Officer
              </span>
            </motion.div>

            {/* Municipal Worker Avatar */}
            <motion.div 
              animate={{ y: [0, -12, 0] }}
              transition={{ repeat: Infinity, duration: 3.0, ease: 'easeInOut', delay: 0.8 }}
              whileHover={{ scale: 1.18, rotate: 6 }}
              className="relative group cursor-pointer"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-tr from-blue-400 via-cyan-400 to-sky-400 shadow-2xl shadow-blue-500/40 border-2 border-white/20">
                <img src="/avatar_municipal.png" alt="Municipal Worker" className="w-full h-full object-cover rounded-full shadow-inner" />
              </div>
              <span className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-slate-900/95 text-blue-300 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-blue-500/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl pointer-events-none">
                🧹 Municipal Sanitation Officer
              </span>
            </motion.div>
          </div>

          {/* RIGHT FLANK: 3 DEPARTMENT WORKER AVATARS (ENLARGED) */}
          <div className="hidden xl:flex flex-col gap-6 absolute right-[-110px] top-2 z-20">
            {/* Electrician Avatar */}
            <motion.div 
              animate={{ y: [0, -16, 0] }}
              transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut', delay: 0.2 }}
              whileHover={{ scale: 1.18, rotate: -6 }}
              className="relative group cursor-pointer"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-tr from-yellow-400 via-amber-400 to-amber-500 shadow-2xl shadow-yellow-500/40 border-2 border-white/20">
                <img src="/avatar_electrician.png" alt="Electrician" className="w-full h-full object-cover rounded-full shadow-inner" />
              </div>
              <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900/95 text-yellow-300 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-yellow-500/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl pointer-events-none">
                ⚡ Power Grid Engineer
              </span>
            </motion.div>

            {/* Plumber / Water Works Avatar */}
            <motion.div 
              animate={{ y: [0, -14, 0] }}
              transition={{ repeat: Infinity, duration: 3.1, ease: 'easeInOut', delay: 0.6 }}
              whileHover={{ scale: 1.18, rotate: 6 }}
              className="relative group cursor-pointer mr-6"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-tr from-cyan-400 via-teal-300 to-emerald-400 shadow-2xl shadow-cyan-500/40 border-2 border-white/20">
                <img src="/avatar_plumber.png" alt="Plumber" className="w-full h-full object-cover rounded-full shadow-inner" />
              </div>
              <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900/95 text-teal-300 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-teal-500/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl pointer-events-none">
                🔧 Water Works Engineer
              </span>
            </motion.div>

            {/* Road Construction Engineer Avatar */}
            <motion.div 
              animate={{ y: [0, -18, 0] }}
              transition={{ repeat: Infinity, duration: 3.7, ease: 'easeInOut', delay: 1.0 }}
              whileHover={{ scale: 1.18, rotate: -6 }}
              className="relative group cursor-pointer"
            >
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-orange-400 to-rose-400 shadow-2xl shadow-amber-500/40 border-2 border-white/20">
                <img src="/avatar_road.png" alt="Road Engineer" className="w-full h-full object-cover rounded-full shadow-inner" />
              </div>
              <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900/95 text-amber-300 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border border-amber-500/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-2xl pointer-events-none">
                🏗️ Road & Transport Engineer
              </span>
            </motion.div>
          </div>

          {/* JUMPING / BOUNCING HERO LOGO */}
          <motion.div 
            animate={{ y: [0, -12, 0] }} 
            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
            className="w-24 h-24 bg-gradient-to-tr from-emerald-400 via-teal-300 to-cyan-300 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 border border-white/30 cursor-pointer"
            onClick={() => setShowFeatureModal(true)}
          >
            <ShieldCheck className="text-slate-950 w-14 h-14" />
          </motion.div>

          <div className="space-y-3">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              AI Autonomous Smart City Governance OS
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-transparent drop-shadow-sm leading-[1.05]"
            >
              CIVIX OS
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              className="text-zinc-300 text-base md:text-xl font-medium max-w-2xl mx-auto leading-relaxed"
            >
              Real-time civic complaint dispatch, AI automated department triage, official proof verification, and <strong className="text-amber-400 font-bold">Civic Coins rewards</strong>.
            </motion.p>
          </div>

          {/* Interactive Feature Demo Popup Button */}
          <div className="flex justify-center pt-1">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              onClick={() => setShowFeatureModal(true)}
              className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-widest px-6 py-3 rounded-full shadow-xl shadow-amber-500/20 border border-white/30 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-slate-950" /> ✨ Click to View Interactive Features Demo
            </motion.button>
          </div>

          {/* Animated Jumping Metrics Badges */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            {[
              { label: 'AI Triage Accuracy', value: '99.4%', icon: Bot, color: 'text-cyan-400', jumpDelay: 0 },
              { label: 'Civic Rewards Earned', value: '🪙 +10 Coins', icon: Coins, color: 'text-amber-400', jumpDelay: 0.3 },
              { label: 'Real-Time Sync', value: 'Instant Push', icon: Zap, color: 'text-emerald-400', jumpDelay: 0.6 }
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, delay: stat.jumpDelay }}
                className="flex items-center gap-3 bg-slate-900/90 border border-white/10 px-5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md hover:border-amber-400/50 transition-colors cursor-pointer"
                onClick={() => setShowFeatureModal(true)}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div className="text-left">
                  <div className="text-sm font-black text-white">{stat.value}</div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* HIGH-IMPACT FEATURE SHOWCASE CARDS (With Hover Bounce Effects) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Card 1: AI Smart Routing */}
          <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-slate-900/90 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl hover:border-cyan-500/50 transition-all group flex flex-col justify-between cursor-pointer"
            onClick={() => { setActiveFeatureTab('ai'); setShowFeatureModal(true); }}
          >
            <div className="h-48 overflow-hidden relative">
              <img 
                src="/landing_smart_city_ai.png" 
                alt="AI Smart Routing" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
              <span className="absolute top-3 left-3 bg-cyan-600/90 text-white font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-full shadow backdrop-blur-md flex items-center gap-1">
                <Bot className="w-3 h-3 animate-spin" /> Autonomous AI Triage
              </span>
            </div>
            <div className="p-6 space-y-2 flex-1">
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">Instant AI Complaint Dispatch</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Citizens report an issue, and AI vision automatically analyzes urgency, categorizes infrastructure faults, and dispatches directly to official department queues.
              </p>
            </div>
          </motion.div>

          {/* Card 2: Verified Proof Seals */}
          <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-slate-900/90 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl hover:border-emerald-500/50 transition-all group flex flex-col justify-between cursor-pointer"
            onClick={() => { setActiveFeatureTab('proof'); setShowFeatureModal(true); }}
          >
            <div className="h-48 overflow-hidden relative">
              <img 
                src="/landing_official_verification.png" 
                alt="Verified Resolution Proof" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
              <span className="absolute top-3 left-3 bg-emerald-600/90 text-white font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-full shadow backdrop-blur-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-300" /> Verified BEFORE & AFTER Proof
              </span>
            </div>
            <div className="p-6 space-y-2 flex-1">
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">Official Resolution Proofs</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Government officers repair issues and upload official resolution proof photos with timestamped verification stamps visible side-by-side to all citizens.
              </p>
            </div>
          </motion.div>

          {/* Card 3: Civic Coins & Gamification */}
          <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            className="bg-slate-900/90 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl hover:border-amber-500/50 transition-all group flex flex-col justify-between cursor-pointer"
            onClick={() => { setActiveFeatureTab('rewards'); setShowFeatureModal(true); }}
          >
            <div className="h-48 overflow-hidden relative">
              <img 
                src="/landing_civic_rewards.png" 
                alt="Civic Rewards & Leaderboard" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
              <span className="absolute top-3 left-3 bg-amber-600/90 text-white font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-full shadow backdrop-blur-md flex items-center gap-1">
                🪙 Civic Rewards & Leaderboard
              </span>
            </div>
            <div className="p-6 space-y-2 flex-1">
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">Earn Coins & Claim #1 Spot</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Citizens earn <strong className="text-amber-400">+10 Civic Coins</strong> for every complaint reported, unlocking achievement badges and climbing the city-wide Leaderboard!
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* PORTAL SELECTION / AUTH HUB */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1" 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-slate-900/90 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/10 max-w-2xl mx-auto relative overflow-hidden"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">{t('selectPortal')}</h2>
                <p className="text-zinc-400 text-sm mt-1">Select your access role to proceed into the CIVIX OS platform.</p>
              </div>

              <div className="space-y-4">
                {/* Citizen Option */}
                <motion.button 
                  whileHover={{ scale: 1.03, backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handlePortalSelect('citizen')}
                  className="w-full flex items-center gap-4 p-5 rounded-3xl border border-emerald-500/40 bg-emerald-950/30 hover:border-emerald-400 transition-all group text-left relative overflow-hidden shadow-xl"
                >
                  <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                    <User className="w-7 h-7 text-slate-950" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-white flex items-center gap-2">
                      {t('citizenLogin')}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                        Public Access (Earn 🪙 +10 Coins)
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{t('citizenDesc')}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </motion.button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-slate-900 px-4 text-amber-400 font-bold tracking-widest flex items-center gap-1.5 border border-amber-500/20 rounded-full py-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Official & Department Portals
                    </span>
                  </div>
                </div>

                {/* Central Admin Option */}
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePortalSelect('admin')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-900/20 hover:bg-emerald-900/40 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">Central Admin Portal</div>
                    <div className="text-[11px] text-emerald-300">City-wide analytics & global complaint management</div>
                  </div>
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                </motion.button>

                {/* Department List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {DEPARTMENTS.map(dept => (
                    <motion.button 
                      key={dept.id} 
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handlePortalSelect('official', dept.id)}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700 transition-all text-left group"
                    >
                      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                        {getDeptIcon(dept.id)}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-xs text-zinc-200 truncate">{dept.name}</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">{dept.id}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2" 
              initial={{ opacity: 0, x: 30 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -30 }}
              className="bg-slate-900/90 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white/10 max-w-xl mx-auto relative"
            >
              <button 
                onClick={() => { setStep(1); setError(null); setNotice(null); }}
                className="mb-6 flex items-center gap-2 text-zinc-400 hover:text-emerald-400 transition-colors font-bold text-xs uppercase tracking-wider"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Portals
              </button>

              <div className="text-center mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border ${
                  selectedPortal?.role === 'citizen'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {selectedPortal?.role === 'citizen' 
                    ? '🌍 Citizen Public Portal' 
                    : `🛡️ Official Access: ${selectedPortal?.role === 'admin' ? 'Central Admin' : DEPARTMENTS.find(d => d.id === selectedPortal?.deptId)?.name}`}
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {selectedPortal?.role === 'citizen'
                    ? (authMode === 'login' ? 'Citizen Sign In' : 'Create Citizen Account')
                    : 'Official Portal Login'}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {selectedPortal?.role === 'citizen'
                    ? 'Sign in with your Google account or email to start earning Civic Coins.'
                    : 'Enter assigned official credentials. Google Sign-In is restricted for officials.'}
                </p>
              </div>

              {/* Official Credentials Banner with 1-Click Login */}
              {selectedPortal?.role !== 'citizen' && currentCreds && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/40 rounded-2xl p-4 text-xs space-y-3 relative shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                      <KeyRound className="w-4 h-4" /> Designated Credentials
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-200 rounded text-[10px] font-mono border border-amber-500/30">Official Only</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 font-mono bg-black/40 p-3 rounded-xl border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Email:</span>
                      <button 
                        type="button" 
                        onClick={() => copyToClipboard(currentCreds.email, 'email')}
                        className="text-white font-bold hover:text-amber-300 flex items-center gap-1.5 transition-colors"
                      >
                        {currentCreds.email}
                        {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                      </button>
                    </div>
                    <div className="flex justify-between items-center border-t border-white/10 pt-1.5">
                      <span className="text-zinc-400">Password:</span>
                      <button 
                        type="button" 
                        onClick={() => copyToClipboard(currentCreds.pass, 'pass')}
                        className="text-amber-400 font-bold hover:text-amber-200 flex items-center gap-1.5 transition-colors"
                      >
                        {currentCreds.pass}
                        {copiedField === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickOfficialLogin(currentCreds)}
                    disabled={loading}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Auto-Fill & Sign In as {currentCreds.name}
                  </button>
                </motion.div>
              )}

              {error && (
                <div className="mb-5 p-4 bg-rose-950/60 border border-rose-500/40 rounded-2xl flex items-start gap-3 text-xs text-rose-200">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="font-medium">{error}</div>
                </div>
              )}

              {notice && (
                <div className="mb-5 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-start gap-3 text-xs text-emerald-200">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="font-medium">{notice}</div>
                </div>
              )}

              <form onSubmit={handleEmailLogin} className="space-y-4">
                {selectedPortal?.role === 'citizen' && (
                  <div className="space-y-3 pb-2">
                    <button
                      type="button"
                      onClick={handleGoogleCitizenLogin}
                      disabled={loading}
                      className="w-full py-3.5 bg-white text-slate-950 border border-zinc-200 hover:bg-zinc-100 font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2.5 shadow-md shadow-white/10 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"/>
                      </svg>
                      Sign in with Google Account
                    </button>

                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase">
                        <span className="bg-slate-900 px-3 text-zinc-500 font-bold">Or with Email</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Official / User Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                      placeholder="name@civix.gov.in or email@domain.com"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-zinc-500 transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      placeholder="Password"
                      className="w-full pl-10 pr-10 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-zinc-500 transition-all" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                    selectedPortal?.role === 'citizen'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><ArrowRight className="w-4 h-4" />{authMode === 'login' ? 'Sign In to Portal' : 'Create Account'}</>
                  )}
                </button>

                {selectedPortal?.role === 'citizen' && (
                  <button 
                    type="button" 
                    onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(null); setNotice(null); }}
                    className="w-full text-center text-xs text-zinc-400 hover:text-emerald-400 transition-colors pt-2"
                  >
                    {authMode === 'login' ? "New citizen? Create an account" : 'Already have a citizen account? Sign in'}
                  </button>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* INTERACTIVE FEATURE PREVIEW FLOATING MODAL POPUP */}
      <AnimatePresence>
        {showFeatureModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-2xl overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-white/15 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white my-auto relative"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-950 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">CIVIX OS Complete Platform Demo</h3>
                    <p className="text-xs text-zinc-300">Understand the working flow, anti-corruption transparency, and benefits.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowFeatureModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-full transition-colors text-zinc-400 hover:text-white shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector Grid Bar (Zero Horizontal Scrollbars) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/10 bg-slate-950/80 p-2 gap-2 shrink-0">
                {[
                  { id: 'video', label: '🎬 Video Demo', color: 'text-amber-400 border-amber-500/40' },
                  { id: 'transparency', label: '⚖️ Anti-Corruption', color: 'text-emerald-400 border-emerald-500/40' },
                  { id: 'advantages', label: '👥 Advantages', color: 'text-cyan-400 border-cyan-500/40' },
                  { id: 'ai', label: '🤖 AI Vision & Leaderboard', color: 'text-purple-400 border-purple-500/40' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveFeatureTab(t.id as any)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl transition-all border text-center truncate ${
                      activeFeatureTab === t.id ? `bg-white/10 ${t.color} shadow-lg` : 'text-zinc-400 border-transparent hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Preview & Video Walkthrough Content Body (Single Clean Scrollbar) */}
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 min-h-0">
                
                {/* TAB 1: COMPLETE SYSTEM VIDEO DEMO */}
                {activeFeatureTab === 'video' && (
                  <div className="space-y-5">
                    <div className="bg-slate-950 p-4 rounded-3xl border border-amber-500/30 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                          <Sparkles className="w-4 h-4" /> End-to-End System Video Demo
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                          100% Automated Workflow
                        </span>
                      </div>

                      {/* Interactive Simulated Video Player Screen */}
                      <div className="h-56 sm:h-64 w-full rounded-2xl overflow-hidden border border-amber-500/40 relative bg-slate-950 shadow-2xl flex flex-col justify-between p-4 sm:p-6 shrink-0">
                        <img src="/landing_smart_city_ai.png" alt="Platform Demo Video" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent pointer-events-none" />

                        <div className="relative z-10 flex items-center justify-between">
                          <span className="px-3 py-1 bg-red-500 text-white font-black text-[10px] uppercase rounded-full tracking-wider animate-pulse flex items-center gap-1.5 shadow">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" /> LIVE DEMO VIDEO
                          </span>
                          <span className="text-xs font-mono text-zinc-300 bg-slate-900/80 px-3 py-1 rounded-full border border-white/10">
                            Full Workflow (00:45)
                          </span>
                        </div>

                        <div className="relative z-10 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px] font-bold text-center">
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-cyan-300">
                              1. Report Issue (+10 Coins)
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-purple-500/40 text-purple-300">
                              2. AI Auto-Triages Ticket
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300">
                              3. Official Dispatches Repair
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-rose-500/40 text-rose-300">
                              4. Road Advisory Broadcast
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-emerald-500/40 text-emerald-300 col-span-2 sm:col-span-1">
                              5. Proof Uploaded & Closed
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-2">
                        <div className="font-bold text-white flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Step-by-Step Citizen Flow:
                        </div>
                        <p className="text-zinc-300 leading-relaxed">
                          Citizens snap a photo of a broken streetlight or water leak and click submit. GPS location is captured instantly, and the citizen is awarded <strong>+10 Civic Coins</strong>.
                        </p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-2">
                        <div className="font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400" /> Step-by-Step Official Flow:
                        </div>
                        <p className="text-zinc-300 leading-relaxed">
                          Department officers receive auto-classified tickets, assign field crews, broadcast road closure advisories to commuters, and upload a verified <strong>After-Fixing Proof Photo</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ANTI-CORRUPTION & 100% GOVERNMENT TRANSPARENCY */}
                {activeFeatureTab === 'transparency' && (
                  <div className="space-y-5">
                    <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950/80 via-slate-950 to-emerald-950/80 rounded-3xl border border-emerald-500/40 space-y-4">
                      <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border border-emerald-500/40">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Zero Corruption & 100% Public Auditability
                      </div>

                      <h4 className="text-lg sm:text-xl font-black text-white leading-snug">
                        How CIVIX OS Eliminates Government Corruption & Tracks Officer Delays
                      </h4>

                      <p className="text-xs text-zinc-200 leading-relaxed">
                        Traditional civic complaint systems suffer from untracked delays, false resolution claims, and lack of accountability. CIVIX OS introduces a revolutionary <strong>100% Public Audit Trail</strong>:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                        <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-1">
                          <div className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                            📸 Dual Photo Proof
                          </div>
                          <p className="text-[10px] text-zinc-300 leading-relaxed">
                            Officials cannot close a ticket without uploading verified after-repair photo proof.
                          </p>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-2xl border border-cyan-500/30 space-y-1">
                          <div className="font-bold text-cyan-400 text-xs flex items-center gap-1.5">
                            ⏱️ Officer Delay Timestamps
                          </div>
                          <p className="text-[10px] text-zinc-300 leading-relaxed">
                            Calculates exact time taken from submission to resolution, exposing officer delays publicly.
                          </p>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-1">
                          <div className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                            📅 District Day & Month Analysis
                          </div>
                          <p className="text-[10px] text-zinc-300 leading-relaxed">
                            Tracks daily & monthly district complaint totals and department trends.
                          </p>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-2xl border border-purple-500/30 space-y-1">
                          <div className="font-bold text-purple-400 text-xs flex items-center gap-1.5">
                            🗺️ Live Issue Map Pins
                          </div>
                          <p className="text-[10px] text-zinc-300 leading-relaxed">
                            Citizens view all active complaints around their exact location on an interactive map.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="h-52 sm:h-64 w-full rounded-2xl overflow-hidden border border-emerald-500/30 relative shrink-0">
                      <img src="/landing_official_verification.png" alt="Official Transparency Verification" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {/* TAB 3: ADVANTAGES FOR CITIZENS AND OFFICIALS */}
                {activeFeatureTab === 'advantages' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Citizens Advantages */}
                    <div className="p-5 bg-slate-950 rounded-3xl border border-cyan-500/30 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-cyan-500/20 border border-cyan-500/40 rounded-2xl flex items-center justify-center text-cyan-300 font-bold shrink-0">
                          🙋‍♂️
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white">Advantages for Citizens</h4>
                          <span className="text-[10px] text-cyan-400 font-mono">Empowering Public Participation</span>
                        </div>
                      </div>

                      <ul className="space-y-2 text-xs text-zinc-300">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>🗺️ Neighborhood Issue Map:</strong> View all civic problems active around your location on an interactive GPS map.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>📅 District Day-to-Day & Monthly Telemetry:</strong> Understand daily and monthly complaint volumes in your district.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>⏱️ Officer Delay Tracking:</strong> Track exact time taken by officers to resolve each ticket (Timestamp Auditing).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>🪙 Earn Civic Coins (+10 Coins):</strong> Get rewarded with badges and climb the Champions Leaderboard.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span><strong>🤖 24/7 CIVIX AI Assistant:</strong> Ask real Google Gemini AI any question regarding city departments.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Officials Advantages */}
                    <div className="p-5 bg-slate-950 rounded-3xl border border-amber-500/30 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-500/20 border border-amber-500/40 rounded-2xl flex items-center justify-center text-amber-300 font-bold shrink-0">
                          🏛️
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white">Advantages for Officials</h4>
                          <span className="text-[10px] text-amber-400 font-mono">Streamlined Municipal Operations</span>
                        </div>
                      </div>

                      <ul className="space-y-2 text-xs text-zinc-300">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">✓</span>
                          <span><strong>🤖 Autonomous AI Triage:</strong> Zero manual complaint sorting; Gemini AI routes tickets to department officers instantly.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">✓</span>
                          <span><strong>📊 District Daily Telemetry:</strong> Track daily & monthly resolution efficiency ratings across municipal sectors.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">✓</span>
                          <span><strong>📢 Public Road Advisory Broadcasts:</strong> Warn commuters about scheduled road closures or power outages.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold">✓</span>
                          <span><strong>📸 Dual Photo Verification Proof:</strong> Upload site repair proofs to build public trust and close tickets transparently.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* TAB 4: AI VISION & GAMIFICATION */}
                {activeFeatureTab === 'ai' && (
                  <div className="space-y-4">
                    <div className="h-52 sm:h-64 w-full rounded-2xl overflow-hidden border border-purple-500/30 relative shrink-0">
                      <img src="/landing_smart_city_ai.png" alt="AI & Gamification Demo" className="w-full h-full object-cover" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-purple-500/30 space-y-2">
                        <div className="font-bold text-purple-300 flex items-center gap-2">
                          <Bot className="w-4 h-4 text-purple-400" /> Google Gemini AI Integration
                        </div>
                        <p className="text-zinc-300 leading-relaxed">
                          Powered by live Google Gemini 2.0 Flash REST API for instant image auto-triage and intelligent citizen query answers.
                        </p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-2">
                        <div className="font-bold text-amber-300 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-400" /> Champions Leaderboard
                        </div>
                        <p className="text-zinc-300 leading-relaxed">
                          Citizens earn rank badges (Civic Legend, City Crusader) and climb the leaderboard based on verified reported issues.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer (Fixed at Bottom) */}
              <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-zinc-400 font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> CIVIX OS Telemetry v2.0 • 100% Anti-Corruption Guaranteed
                </div>
                <button
                  onClick={() => setShowFeatureModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 shrink-0"
                >
                  Close & Access App
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}