import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, collection, query, onSnapshot } from '../localStore';
import { MapPin, Layers, Navigation, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../LanguageContext';
import { useAuth } from '../AuthContext';

const containerStyle = { width: '100%', height: '100%', minHeight: '560px', borderRadius: '1.5rem', zIndex: 1 };
const TELANGANA_CENTER: [number, number] = [17.8495, 79.1151];
const CATEGORY_COLORS: Record<string, string> = {
  pothole: '#EF4444', garbage: '#F59E0B', water: '#3B82F6', electricity: '#10B981', other: '#6B7280'
};

// ---------- helpers ----------
function getPOIStyle(poi: any): { bg: string; emoji: string } | null {
  const { amenity: am, shop: sh, office: of_, power: pw, highway: hi, leisure: le, tourism: to, healthcare: hc, operator_type, ownership, name = '' } = poi;
  const isGovtHospital = (am === 'hospital' || hc) && (operator_type === 'government' || ownership === 'government' || /\b(government|govt|g\.h\.|general hospital|district hospital|phc|chc|primary health|community health|civil hospital|public hospital|area hospital|municipal hospital|taluk hospital)\b/i.test(name));
  const isGovtSchool = am === 'school' && (operator_type === 'government' || ownership === 'government' || /\b(government|govt|zilla parishad|ZP|mandal parishad|MPP|kasturba|navodaya|kendriya vidyalaya|KV|municipal school|panchayat|social welfare|bc welfare|sc welfare|st welfare)\b/i.test(name));
  const isDEO = of_ === 'education' || /\b(DEO|district education officer|education office)\b/i.test(name);
  const isRTO = of_ === 'transportation' || poi.government === 'transport' || /\b(RTO|regional transport office|transport office|motor vehicle)\b/i.test(name);

  if (isGovtHospital) return { bg: '#DC2626', emoji: '🏥' };
  if (am === 'hospital' || hc) return null;
  if (am === 'clinic') return { bg: '#EF4444', emoji: '🩺' };
  if (am === 'pharmacy') return { bg: '#EC4899', emoji: '💊' };
  if (am === 'police') return { bg: '#1D4ED8', emoji: '🚔' };
  if (am === 'fire_station') return { bg: '#F97316', emoji: '🚒' };
  if (isDEO) return { bg: '#0369A1', emoji: '🎒' };
  if (isRTO) return { bg: '#92400E', emoji: '🚗' };
  if (am === 'townhall' || of_ === 'government' || of_ === 'municipality') return { bg: '#2563EB', emoji: '🏛️' };
  if (am === 'post_office') return { bg: '#7C3AED', emoji: '📮' };
  if (pw === 'substation' || pw === 'plant' || of_ === 'energy') return { bg: '#F59E0B', emoji: '⚡' };
  if (am === 'bus_station' || hi === 'bus_stop') return { bg: '#0891B2', emoji: '🚌' };
  if (sh === 'mall') return { bg: '#9333EA', emoji: '🛍️' };
  if (sh === 'supermarket') return { bg: '#10B981', emoji: '🛒' };
  if (am === 'marketplace') return { bg: '#059669', emoji: '🏪' };
  if (isGovtSchool) return { bg: '#15803D', emoji: '🏫' };
  if (am === 'school') return null;
  if (am === 'college' || am === 'university') return { bg: '#B45309', emoji: '🎓' };
  if (am === 'bank' || am === 'atm') return { bg: '#047857', emoji: '🏦' };
  if (am === 'fuel') return { bg: '#6D28D9', emoji: '⛽' };
  if (am === 'restaurant') return { bg: '#B91C1C', emoji: '🍽️' };
  if (am === 'fast_food') return { bg: '#C2410C', emoji: '🍔' };
  if (le === 'park') return { bg: '#16A34A', emoji: '🌳' };
  if (to === 'hotel' || to === 'guest_house') return { bg: '#0F766E', emoji: '🏨' };
  return null;
}

// Robust location controller — lives inside MapContainer so it has access to the map instance
function LocationController({
  onLocate, onStatus, controllerRef
}: {
  onLocate: (loc: [number, number]) => void;
  onStatus: (s: 'requesting' | 'granted' | 'denied') => void;
  controllerRef: React.MutableRefObject<{ restart: () => void } | null>;
}) {
  const map = useMap();
  const watchIdRef = useRef<number | null>(null);
  const hasCenteredRef = useRef(false);

  const startWatch = useCallback(() => {
    if (!('geolocation' in navigator)) { onStatus('denied'); return; }
    onStatus('requesting');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onLocate(loc);
        onStatus('granted');
        // Force-center only on first fix
        if (!hasCenteredRef.current) {
          hasCenteredRef.current = true;
          map.setView(loc, 15);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.code, err.message);
        onStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [map, onLocate, onStatus]);

  // Expose re-locate on the map element for the button
  useEffect(() => {
    (map as any)._locateController = { flyToUser: () => {
      if (!('geolocation' in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 15); },
        undefined,
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }};
    // Expose restart for Try Again button
    if (controllerRef) {
      controllerRef.current = { restart: () => { hasCenteredRef.current = false; startWatch(); } };
    }
    startWatch();
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return null;
}


// Telangana bounding box: south, west, north, east
const TS_BBOX = '15.8,77.2,19.9,81.3';

function mapElement(e: any) {
  return {
    id: e.id, lat: e.lat || e.center?.lat, lng: e.lon || e.center?.lon,
    name: e.tags?.name, amenity: e.tags?.amenity, shop: e.tags?.shop,
    office: e.tags?.office, power: e.tags?.power, highway: e.tags?.highway,
    leisure: e.tags?.leisure, tourism: e.tags?.tourism, healthcare: e.tags?.healthcare,
    operator_type: e.tags?.['operator:type'], ownership: e.tags?.ownership, government: e.tags?.government,
  };
}

// Fetch key GOVT offices for the ENTIRE Telangana (runs once at mount)
async function fetchTelanganaGovtOffices(): Promise<any[]> {
  // Focused query: only key public infrastructure across all of Telangana
  const q = `[out:json][timeout:60];
  (
    node["amenity"="hospital"](${TS_BBOX});
    way["amenity"="hospital"](${TS_BBOX});
    node["healthcare"](${TS_BBOX});
    node["office"="education"](${TS_BBOX});
    way["office"="education"](${TS_BBOX});
    node["office"="transportation"](${TS_BBOX});
    way["office"="transportation"](${TS_BBOX});
    node["government"="transport"](${TS_BBOX});
    node["amenity"="townhall"](${TS_BBOX});
    way["amenity"="townhall"](${TS_BBOX});
    node["office"="municipality"](${TS_BBOX});
    way["office"="municipality"](${TS_BBOX});
    node["office"="government"](${TS_BBOX});
    way["office"="government"](${TS_BBOX});
    node["power"="substation"](${TS_BBOX});
    way["power"="substation"](${TS_BBOX});
    node["office"="energy"](${TS_BBOX});
    way["office"="energy"](${TS_BBOX});
  );
  out center;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
    const data = await res.json();
    return data.elements.map(mapElement).filter((p: any) => p.lat && p.lng && p.name);
  } catch { return []; }
}

function POILoader({
  onViewportLoaded, onLoading
}: {
  onViewportLoaded: (p: any[]) => void;
  onLoading: (l: boolean) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBounds = useCallback(async (map: L.Map) => {
    if (map.getZoom() < 12) { onViewportLoaded([]); return; }
    const b = map.getBounds();
    const bbox = `${b.getSouth().toFixed(5)},${b.getWest().toFixed(5)},${b.getNorth().toFixed(5)},${b.getEast().toFixed(5)}`;
    onLoading(true);
    const q = `[out:json][timeout:30];(
      node["amenity"~"clinic|pharmacy|police|fire_station|bus_station|marketplace|school|college|university|bank|atm|fuel|post_office|restaurant|fast_food|library"](${bbox});
      way["amenity"~"bus_station|school|college|university|marketplace"](${bbox});
      node["highway"="bus_stop"](${bbox});
      node["shop"~"mall|supermarket"](${bbox});
      way["shop"~"mall|supermarket"](${bbox});
      node["leisure"="park"](${bbox});
      way["leisure"="park"](${bbox});
      node["tourism"~"hotel|guest_house"](${bbox});
    );out center;`;
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
      const data = await res.json();
      onViewportLoaded(data.elements.map(mapElement).filter((p: any) => p.lat && p.lng && p.name));
    } catch { /* silent */ } finally { onLoading(false); }
  }, []);

  const map = useMapEvents({
    moveend: () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => fetchBounds(map), 700); },
    zoomend: () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => fetchBounds(map), 700); },
  });

  useEffect(() => { fetchBounds(map); }, []);
  return null;
}

// ---------- main component ----------
export default function CityMap() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [issues, setIssues] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locStatus, setLocStatus] = useState<'requesting' | 'granted' | 'denied' | 'idle'>('idle');
  const [statePOIs, setStatePOIs] = useState<any[]>([]); // govt offices for all Telangana
  const [viewportPOIs, setViewportPOIs] = useState<any[]>([]); // local POIs from map viewport
  const [poiLoading, setPoiLoading] = useState(false);
  const [stateLoading, setStateLoading] = useState(true);

  // Merged deduplicated POI list
  const allPOIs = useMemo(() => {
    const viewportIds = new Set(viewportPOIs.map(p => p.id));
    return [...statePOIs.filter(p => !viewportIds.has(p.id)), ...viewportPOIs];
  }, [statePOIs, viewportPOIs]);

  const isFemale = useMemo(() => {
    if (!user?.displayName) return false;
    const fn = user.displayName.toLowerCase().split(' ')[0];
    const female = ['jane','mary','priya','neha','sarah','emily','jessica','aarti','shruthi'];
    const male = ['shiva','krishna','aditya','ravi','hari','murali','anumula'];
    return female.includes(fn) || ((fn.endsWith('a') || fn.endsWith('i')) && !male.includes(fn));
  }, [user]);

  const locControllerRef = useRef<{ restart: () => void } | null>(null);

  const tryAgain = useCallback(() => {
    setLocStatus('requesting');
    locControllerRef.current?.restart();
  }, []);

  // Fetch key govt offices for ALL of Telangana once at mount
  useEffect(() => {
    setStateLoading(true);
    fetchTelanganaGovtOffices().then(pois => {
      setStatePOIs(pois);
      setStateLoading(false);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'issues'));
    return onSnapshot(q, (snap: any) => setIssues(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
  }, []);

  const filteredIssues = useMemo(() =>
    issues.filter(i => (filter === 'all' || i.category === filter) && i.location?.lat && i.location?.lng),
    [issues, filter]);


  const userIcon = L.divIcon({
    className: '',
    html: `<div style="background:#10B981;width:34px;height:34px;border-radius:50%;border:3px solid white;box-shadow:0 4px 10px rgba(16,185,129,.4);display:flex;align-items:center;justify-content:center;font-size:20px">${isFemale ? '🧍‍♀️' : '🧍‍♂️'}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17],
  });

  const issueIcon = (cat: string) => {
    const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
    return L.divIcon({ className: '', html: `<div style="background:${c};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,.3)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('mapTitle')}</h1>
          <p className="text-zinc-500 mt-1">Live civic issue map for Telangana</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${filter === 'all' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'}`}>
            <Layers className="w-4 h-4" />{t('feedFilterAll')}
          </button>
          {Object.keys(CATEGORY_COLORS).map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${filter === cat ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'}`}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
              {t(`mapLegend${cat.charAt(0).toUpperCase() + cat.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Location denied banner */}
      {locStatus === 'denied' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Location access denied</p>
            <p className="text-sm text-amber-700 mt-0.5">To see your surroundings accurately, please enable location services in your browser settings, then click below.</p>
          </div>
          <button onClick={tryAgain} className="shrink-0 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors flex items-center gap-2">
            <Navigation className="w-4 h-4" /> Try Again
          </button>
        </div>
      )}

      {locStatus === 'requesting' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <span className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
          <p className="text-sm font-medium text-blue-700">Requesting your location — please allow access in your browser…</p>
        </div>
      )}


      {/* Map */}
      <div className="bg-white p-2 rounded-3xl border border-zinc-200 shadow-sm overflow-hidden relative z-0" style={{ minHeight: 560 }}>
        {(poiLoading || stateLoading) && (
          <div className="absolute top-4 right-4 z-[999] bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold text-emerald-600 shadow border border-emerald-100 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
            {stateLoading ? 'Loading Telangana govt offices…' : 'Loading local landmarks…'}
          </div>
        )}

        <MapContainer center={userLoc || TELANGANA_CENTER} zoom={userLoc ? 15 : 8} style={containerStyle} maxZoom={19}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          <LocationController
            onLocate={setUserLoc}
            onStatus={setLocStatus}
            controllerRef={locControllerRef}
          />
          <POILoader onViewportLoaded={setViewportPOIs} onLoading={setPoiLoading} />

          {/* All POIs: state-wide govt offices + viewport local POIs */}
          {allPOIs.map(poi => {
            const s = getPOIStyle(poi);
            if (!s) return null;
            const safeName = String(poi.name || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
            const html = `<div style="background-color:${s.bg};color:white;border-radius:20px;padding:3px 8px;display:flex;align-items:center;gap:4px;border:2px solid rgba(255,255,255,0.9);box-shadow:0 3px 8px rgba(0,0,0,0.4);white-space:nowrap;font-size:11px;font-weight:700;max-width:220px"><span style="font-size:13px">${s.emoji}</span><span style="overflow:hidden;text-overflow:ellipsis;max-width:170px">${safeName}</span></div>`;
            return (
              <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={L.divIcon({ className: 'custom-poi-marker', html, iconSize: [undefined as any, 26], iconAnchor: [0, 26] })}>
                <Popup><b>{s.emoji} {poi.name}</b><br /><span style={{ fontSize: 11, color: '#6B7280', textTransform: 'capitalize' }}>{poi.amenity || poi.shop || poi.office || poi.highway || poi.leisure || poi.tourism || 'Landmark'}</span></Popup>
              </Marker>
            );
          })}

          {/* User location */}
          {userLoc && (
            <Marker position={userLoc} icon={userIcon}>
              <Popup><b>{user?.displayName || 'You'}</b><br /><span style={{ fontSize: 11, color: '#6B7280' }}>Your current location</span></Popup>
            </Marker>
          )}

          {/* Existing civic issues */}
          {filteredIssues.map(issue => (
            <Marker key={issue.id} position={[issue.location.lat, issue.location.lng]} icon={issueIcon(issue.category)}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '1px 6px', borderRadius: 4, background: issue.status === 'resolved' ? '#D1FAE5' : '#F3F4F6', color: issue.status === 'resolved' ? '#065F46' : '#374151' }}>{issue.status}</span>
                  <div style={{ fontWeight: 'bold', marginTop: 4 }}>{issue.title}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{issue.createdAt ? formatDistanceToNow(issue.createdAt.toDate()) + ' ago' : 'Just now'}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wider mb-3">📍 Landmarks Legend</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { e: '🏥', l: 'Govt Hospital', b: '#DC2626' }, { e: '🩺', l: 'Clinic', b: '#EF4444' }, { e: '💊', l: 'Pharmacy', b: '#EC4899' },
            { e: '🏛️', l: 'Govt / Municipality', b: '#2563EB' }, { e: '🎒', l: 'DEO Office', b: '#0369A1' }, { e: '🚗', l: 'RTO Office', b: '#92400E' },
            { e: '🚔', l: 'Police', b: '#1D4ED8' }, { e: '🚒', l: 'Fire Station', b: '#F97316' }, { e: '⚡', l: 'Electricity Dept', b: '#F59E0B' },
            { e: '📮', l: 'Post Office', b: '#7C3AED' }, { e: '🚌', l: 'Bus Stand', b: '#0891B2' }, { e: '🛍️', l: 'Mall', b: '#9333EA' },
            { e: '🛒', l: 'Supermarket', b: '#10B981' }, { e: '🏪', l: 'Market', b: '#059669' }, { e: '🏫', l: 'Govt School', b: '#15803D' },
            { e: '🎓', l: 'College / Uni', b: '#B45309' }, { e: '🏦', l: 'Bank / ATM', b: '#047857' }, { e: '⛽', l: 'Fuel Station', b: '#6D28D9' },
            { e: '🌳', l: 'Park', b: '#16A34A' }, { e: '🏨', l: 'Hotel', b: '#0F766E' },
          ].map(i => (
            <div key={i.l} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold" style={{ backgroundColor: i.b }}>
              <span>{i.e}</span><span>{i.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
