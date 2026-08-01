import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, addDoc, serverTimestamp, pruneImagesInStore, awardUserCoins } from '../localStore';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../LanguageContext';
import { analyzeIssue } from '../gemini';
import { Camera, MapPin, Send, Loader2, Sparkles, CheckCircle2, Video, Truck, Zap, Droplets, GraduationCap, Building2, HeartPulse, X, Upload, AlertCircle, Trash2, Waves, Sun, MoreHorizontal, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DEPARTMENTS, ISSUE_CATEGORIES } from '../constants';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { compressImage } from '../utils';

const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const defaultCenter = {
  lat: 17.3850,
  lng: 78.4867 // Hyderabad
};

// Auto-routing: maps issue category → responsible department
const CATEGORY_TO_DEPT: Record<string, string> = {
  pothole: 'transport',
  garbage: 'municipal',
  water: 'water',
  electricity: 'electricity',
  drainage: 'municipal',
  'street-light': 'electricity',
  other: 'municipal',
};

export default function ReportIssue() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [civicPOIs, setCivicPOIs] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Removed Google Maps loader

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    departmentId: '',
    category: '',
    photoUrl: '',
    videoUrl: '',
    location: {
      address: 'Detecting location...',
      lat: defaultCenter.lat,
      lng: defaultCenter.lng
    }
  });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              lat: latitude,
              lng: longitude,
              address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
            }
          }));
          reverseGeocode(latitude, longitude);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setFormData(prev => ({
            ...prev,
            location: { ...prev.location, address: 'Hyderabad, India' }
          }));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  const fetchPOIs = async (lat: number, lng: number) => {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](around:3000,${lat},${lng});
        way["amenity"="hospital"](around:3000,${lat},${lng});
        node["amenity"="clinic"](around:3000,${lat},${lng});
        node["healthcare"](around:3000,${lat},${lng});
        node["office"="government"](around:3000,${lat},${lng});
        way["office"="government"](around:3000,${lat},${lng});
        node["amenity"="townhall"](around:3000,${lat},${lng});
        way["amenity"="townhall"](around:3000,${lat},${lng});
        node["office"="municipality"](around:3000,${lat},${lng});
        way["office"="municipality"](around:3000,${lat},${lng});
        node["power"~"substation|plant"](around:3000,${lat},${lng});
        way["power"~"substation|plant"](around:3000,${lat},${lng});
        node["office"="energy"](around:3000,${lat},${lng});
        node["amenity"="bus_station"](around:3000,${lat},${lng});
        way["amenity"="bus_station"](around:3000,${lat},${lng});
        node["highway"="bus_stop"](around:3000,${lat},${lng});
        node["amenity"="marketplace"](around:3000,${lat},${lng});
        way["shop"="mall"](around:3000,${lat},${lng});
        way["shop"="supermarket"](around:3000,${lat},${lng});
        node["shop"="supermarket"](around:3000,${lat},${lng});
        node["shop"="mall"](around:3000,${lat},${lng});
        node["amenity"="school"](around:3000,${lat},${lng});
        way["amenity"="school"](around:3000,${lat},${lng});
        node["amenity"="college"](around:3000,${lat},${lng});
        node["amenity"="police"](around:3000,${lat},${lng});
        node["amenity"="fire_station"](around:3000,${lat},${lng});
        node["amenity"="bank"](around:3000,${lat},${lng});
        node["amenity"="pharmacy"](around:3000,${lat},${lng});
        node["amenity"="fuel"](around:3000,${lat},${lng});
        node["amenity"="post_office"](around:3000,${lat},${lng});
        node["leisure"="park"](around:3000,${lat},${lng});
        way["leisure"="park"](around:3000,${lat},${lng});
      );
      out center;
    `;
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      const data = await res.json();
      const pois = data.elements
        .map((e: any) => ({
          id: e.id,
          lat: e.lat || e.center?.lat,
          lng: e.lon || e.center?.lon,
          name: e.tags?.name,
          amenity: e.tags?.amenity,
          shop: e.tags?.shop,
          office: e.tags?.office,
          power: e.tags?.power,
          highway: e.tags?.highway,
          leisure: e.tags?.leisure,
          healthcare: e.tags?.healthcare,
          operator_type: e.tags?.['operator:type'],
          ownership: e.tags?.ownership,
        }))
        .filter((poi: any) => poi.lat && poi.lng && poi.name);
      setCivicPOIs(pois);
    } catch (err) {
      console.error('Failed to fetch POIs:', err);}
  };

  useEffect(() => {
    if (showMap) {
      fetchPOIs(formData.location.lat, formData.location.lng);
    }
  }, [showMap]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await response.json();
      if (data && data.display_name) {
        setFormData(prev => ({
          ...prev,
          location: { ...prev.location, lat, lng, address: data.display_name }
        }));
      } else {
        throw new Error("No results");
      }
    } catch (e) {
      setFormData(prev => ({
        ...prev,
        location: { ...prev.location, lat, lng, address: `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}` }
      }));
    }
  }, []);

  const onMapClick = useCallback((e: any) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        reverseGeocode(latitude, longitude);
        fetchPOIs(latitude, longitude);
      }, undefined, { enableHighAccuracy: true });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'photo') {
      // Show original immediately as placeholder while compressing
      const rawUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, photoUrl: rawUrl }));
      try {
        const compressed = await compressImage(file, 400, 400, 0.5);
        if (compressed) {
          URL.revokeObjectURL(rawUrl);
          setFormData(prev => ({ ...prev, photoUrl: compressed }));
        }
      } catch (err) {
        console.warn('Image compression error:', err);
      }
    } else {
      // Videos cannot be stored in localStorage (too large)
      // Use a blob URL for in-session preview — saved as a flag in the DB
      const blobUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, videoUrl: blobUrl }));
      // Note: videoUrl will not persist to localStorage — that requires Firebase Storage
    }
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!formData.title || !formData.description) return;
    setAnalyzing(true);
    try {
      const result = await analyzeIssue(formData.title, formData.description);
      setAiAnalysis(result);
      const aiCategory = result.category || formData.category;
      const aiDept = result.departmentId || CATEGORY_TO_DEPT[aiCategory] || formData.departmentId;
      setFormData(prev => ({
        ...prev,
        category: aiCategory,
        departmentId: aiDept,
      }));
    } catch (error) {
      console.error("AI Analysis failed", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Auto-assign department from category if not already set
    const resolvedDept = formData.departmentId || CATEGORY_TO_DEPT[formData.category] || '';
    if (!resolvedDept) {
      setError("Please select a department or category");
      return;
    }

    const payload = {
      ...formData,
      departmentId: resolvedDept,
      status: 'open',
      reporterUid: user.uid,
      reporterName: user.displayName || 'Citizen',
      reporterEmail: user.email || '',
      reporterPhotoUrl: user.photoURL || '',
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      aiMetadata: aiAnalysis
    };

    console.log('[Civix] Submitting issue:', {
      title: payload.title,
      category: payload.category,
      departmentId: payload.departmentId,
      location: payload.location,
    });

    setLoading(true);
    try {
      // Free up localStorage space from other issues' photos before saving a new one
      pruneImagesInStore();

      // Don't persist blob: videoUrl to DB — it's session-only
      const dbPhotoUrl = formData.photoUrl?.startsWith('blob:') ? '' : (formData.photoUrl || '');
      const dbVideoUrl = ''; // Videos need Firebase Storage to persist

      await addDoc(collection(db, 'issues'), {
        ...payload,
        photoUrl: dbPhotoUrl,
        videoUrl: dbVideoUrl,
      });

      // Award +10 Civic Coins for reporting a complaint
      if (user?.uid) {
        awardUserCoins(user.uid, 10);
      }

      navigate('/');
    } catch (error: any) {
      console.error("Failed to report issue", error);
      const code = error?.code || '';
      let msg = 'Failed to submit. ';
      if (code === 'permission-denied') {
        msg += 'Permission denied — Firestore rules are blocking the write. Open Firebase Console → Firestore → Rules and allow authenticated writes.';
      } else if (code === 'unavailable' || code === 'network-request-failed') {
        msg += 'Check your internet connection and try again.';
      } else if (code === 'not-found') {
        msg += 'Local storage is unavailable. Check browser privacy/storage settings.';
      } else {
        msg += `Error: ${code || error?.message || 'Unknown error'}`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }

  };

  const getDeptIcon = (id) => {
    switch(id) {
      case 'municipal': return <Building2 className="w-4 h-4" />;
      case 'transport': return <Truck className="w-4 h-4" />;
      case 'electricity': return <Zap className="w-4 h-4" />;
      case 'water': return <Droplets className="w-4 h-4" />;
      case 'education': return <GraduationCap className="w-4 h-4" />;
      case 'health': return <HeartPulse className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 font-sans text-white">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{t('reportIssue')}</h1>
        <p className="text-zinc-300 font-medium text-sm mt-1">Provide details about the civic problem. CIVIX AI will help route it instantly.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-slate-900/90 border border-white/10 p-6 md:p-10 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
        {error && (
          <div className="p-4 bg-rose-950/80 border border-rose-500/40 rounded-2xl text-rose-200 text-sm font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{t('issueTitle')}</label>
              <input
                required
                type="text"
                placeholder={t('issueTitlePlaceholder')}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-zinc-800 text-white placeholder-zinc-500 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{t('description')}</label>
              <textarea
                required
                rows={4}
                placeholder={t('issueDescriptionPlaceholder')}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-zinc-800 text-white placeholder-zinc-500 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={analyzing || !formData.title || !formData.description}
                onClick={handleAnalyze}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300 bg-emerald-950/80 px-5 py-2.5 rounded-xl border border-emerald-500/40 hover:bg-emerald-900 transition-colors disabled:opacity-50 shadow"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-400" />}
                {t('aiTriage')}
              </button>
              {aiAnalysis && (
                <div className="mt-2 p-3.5 bg-slate-950 rounded-2xl border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3" />
                    AI Auto-Triage Insights
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-400 text-[10px] block">Category</span>
                      <span className="text-white font-bold capitalize">{aiAnalysis.category}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[10px] block">Priority</span>
                      <span className={`font-black ${
                        aiAnalysis.priority === 'Critical' ? 'text-rose-400' :
                        aiAnalysis.priority === 'High' ? 'text-amber-400' :
                        'text-emerald-400'
                      }`}>{aiAnalysis.priority}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.id, departmentId: formData.departmentId || CATEGORY_TO_DEPT[cat.id] || formData.departmentId })}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all text-left ${
                      formData.category === cat.id 
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10' 
                      : 'border-zinc-800 bg-slate-950 hover:bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    <span className="text-xs font-bold">{cat.name}</span>
                    {formData.category === cat.id && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{t('selectDepartment')}</label>
              <div className="grid grid-cols-1 gap-2">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, departmentId: dept.id })}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                      formData.departmentId === dept.id 
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold shadow-lg shadow-emerald-500/10' 
                      : 'border-zinc-800 bg-slate-950 hover:bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {getDeptIcon(dept.id)}
                      <span className="text-xs font-bold">{dept.name}</span>
                    </div>
                    {formData.departmentId === dept.id && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{t('mediaAndLocation')}</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Photo Upload */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video bg-slate-950 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 relative overflow-hidden group cursor-pointer hover:border-emerald-500/50 transition-colors"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleFileChange(e, 'photo')} 
              />
              {formData.photoUrl ? (
                <>
                  <img src={formData.photoUrl} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white w-8 h-8" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <Camera className="w-7 h-7 text-emerald-400 mb-1.5" />
                  <span className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">{t('addPhoto')}</span>
                </div>
              )}
            </div>

            {/* Video Upload */}
            <div 
              onClick={() => videoInputRef.current?.click()}
              className="aspect-video bg-slate-950 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 relative overflow-hidden cursor-pointer hover:border-cyan-500/50 transition-colors group"
            >
              <input 
                type="file" 
                ref={videoInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={(e) => handleFileChange(e, 'video')} 
              />
              {formData.videoUrl ? (
                <>
                  <video src={formData.videoUrl} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Video className="text-white w-8 h-8" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <Video className="w-7 h-7 text-cyan-400 mb-1.5" />
                  <span className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">Add Video</span>
                </div>
              )}
            </div>

            {/* Set on Map Trigger */}
            <div 
              onClick={() => setShowMap(!showMap)}
              className="aspect-video bg-slate-950 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 cursor-pointer hover:border-amber-500/50 transition-colors"
            >
              <MapPin className="w-7 h-7 text-amber-400 mb-1.5" />
              <span className="text-[11px] font-black text-zinc-300 uppercase tracking-wider">Set on Map</span>
              <span className="text-[10px] text-zinc-400 mt-0.5">Click to adjust pin</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{t('location')}</label>
            <div className="relative">
              <input
                required
                type="text"
                placeholder={t('addressPlaceholder')}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-950 border border-zinc-800 text-white placeholder-zinc-500 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                value={formData.location.address}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  location: { ...formData.location, address: e.target.value } 
                })}
              />
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">Tip: Use the map picker above for higher accuracy.</p>
          </div>
        </div>

        {/* Map Modal */}
        <AnimatePresence>
          {showMap && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold">Adjust Location Pin</h3>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={handleLocateMe}
                      className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-emerald-600"
                      title="Locate Me"
                    >
                      <MapPin className="w-6 h-6" />
                    </button>
                    <button onClick={() => setShowMap(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
                
                <div className="relative h-[300px] w-full z-0">
                  <MapContainer 
                    center={[formData.location.lat, formData.location.lng]} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {civicPOIs.map(poi => {
                      let iconBg = '#6B7280';
                      let iconEmoji = '📍';
                      const am = poi.amenity, sh = poi.shop, of = poi.office, pw = poi.power, hi = poi.highway, le = poi.leisure, hc = poi.healthcare;

                      const isGovtHospital = (am === 'hospital' || hc) && (
                        poi.operator_type === 'government' ||
                        poi.ownership === 'government' ||
                        /\b(government|govt|g\.h\.|general hospital|district hospital|phc|chc|primary health|community health|civil hospital|public hospital|area hospital|municipal hospital|taluk hospital)\b/i.test(poi.name || '')
                      );

                      if (isGovtHospital) { iconBg = '#DC2626'; iconEmoji = '🏥'; }
                      else if (am === 'hospital' || hc) { return null; // skip private hospitals
                      } else if (am === 'clinic') { iconBg = '#EF4444'; iconEmoji = '🩺'; }
                      else if (am === 'pharmacy') { iconBg = '#EC4899'; iconEmoji = '💊'; }
                      else if (am === 'police') { iconBg = '#1D4ED8'; iconEmoji = '🚔'; }
                      else if (am === 'fire_station') { iconBg = '#F97316'; iconEmoji = '🚒'; }
                      else if (am === 'townhall' || of === 'government' || of === 'municipality') { iconBg = '#2563EB'; iconEmoji = '🏛️'; }
                      else if (am === 'post_office') { iconBg = '#7C3AED'; iconEmoji = '📮'; }
                      else if (pw === 'substation' || pw === 'plant' || of === 'energy') { iconBg = '#F59E0B'; iconEmoji = '⚡'; }
                      else if (am === 'bus_station' || hi === 'bus_stop') { iconBg = '#0891B2'; iconEmoji = '🚌'; }
                      else if (sh === 'mall') { iconBg = '#9333EA'; iconEmoji = '🛍️'; }
                      else if (sh === 'supermarket') { iconBg = '#10B981'; iconEmoji = '🛒'; }
                      else if (am === 'marketplace') { iconBg = '#059669'; iconEmoji = '🏪'; }
                      else if (am === 'school') { iconBg = '#D97706'; iconEmoji = '🏫'; }
                      else if (am === 'college' || am === 'university') { iconBg = '#B45309'; iconEmoji = '🎓'; }
                      else if (am === 'bank' || am === 'atm') { iconBg = '#047857'; iconEmoji = '🏦'; }
                      else if (am === 'fuel') { iconBg = '#6D28D9'; iconEmoji = '⛽'; }
                      else if (le === 'park') { iconBg = '#16A34A'; iconEmoji = '🌳'; }

                      const safePoiName = String(poi.name || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
                      const iconHtml = `<div style="background-color:${iconBg};color:white;border-radius:20px;padding:3px 8px;display:flex;align-items:center;gap:4px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 3px 8px rgba(0,0,0,0.4);white-space:nowrap;font-size:11px;font-weight:700;max-width:180px"><span style="font-size:13px">${iconEmoji}</span><span style="overflow:hidden;text-overflow:ellipsis;max-width:130px">${safePoiName}</span></div>`;

                      return (
                        <Marker
                          key={poi.id}
                          position={[poi.lat, poi.lng]}
                          icon={L.divIcon({
                            className: 'custom-poi-marker',
                            html: iconHtml,
                            iconSize: [undefined as any, 26],
                            iconAnchor: [0, 26],
                          })}
                        />
                      );
                    })}

                    <Marker 
                      position={[formData.location.lat, formData.location.lng]} 
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const position = marker.getLatLng();
                          reverseGeocode(position.lat, position.lng);
                        },
                      }}
                      icon={L.divIcon({
                        className: 'custom-leaflet-marker',
                        html: `
                          <div style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3)); display: flex; justify-content: center; align-items: flex-end;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#10B981" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3" fill="white"></circle>
                            </svg>
                          </div>
                        `,
                        iconSize: [36, 36],
                        iconAnchor: [18, 36],
                      })}
                    />
                  </MapContainer>
                </div>

                <div className="p-6 bg-zinc-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-zinc-600 text-center sm:text-left">
                    <span className="font-bold block text-zinc-900">Selected Location</span>
                    <span className="line-clamp-2">{formData.location.address}</span>
                    <span className="text-xs text-zinc-400 block mt-1">
                      {formData.location.lat.toFixed(6)}, {formData.location.lng.toFixed(6)}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowMap(false)}
                    className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shrink-0"
                  >
                    Confirm Location
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-zinc-200 disabled:opacity-70"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
