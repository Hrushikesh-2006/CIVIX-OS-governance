type TimestampLike = {
  seconds: number;
  toDate: () => Date;
};

type LocalUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  reload: () => Promise<void>;
};

type StoredAuthUser = Omit<LocalUser, 'reload'> & { password: string };
type Filter = { field: string; op: '=='; value: unknown };
type CollectionRef = { kind: 'collection'; path: string; filters?: Filter[] };
type DocRef = { kind: 'doc'; path: string; id: string; collectionPath: string };
type IncrementOp = { __op: 'increment'; by: number };

const AUTH_USERS_KEY = 'civix.localAuthUsers';
const CURRENT_USER_KEY = 'civix.currentUser';
const DB_KEY = 'civix.localDb';
const listeners = new Set<() => void>();

export type User = LocalUser;
export const db = { kind: 'local-db' };
export const auth = {
  get currentUser() {
    return getCurrentUser();
  }
};

function uid() {
  return `local_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function makeTimestamp(date = new Date()): TimestampLike {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    toDate: () => date
  };
}

function revive(value: any): any {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp') return makeTimestamp(new Date(value.iso));
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]));
  }
  return value;
}

function replacer(_key: string, value: any) {
  if (value && typeof value === 'object' && typeof value.toDate === 'function' && typeof value.seconds === 'number') {
    return { __type: 'timestamp', iso: value.toDate().toISOString() };
  }
  return value;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? revive(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value, replacer));
}

let cachedDb: Record<string, Record<string, any>> | null = null;
let cachedAuthUsers: StoredAuthUser[] | null = null;
let cachedCurrentUser: LocalUser | null | undefined = undefined;

const SEEDED_OFFICIALS: Array<StoredAuthUser & { role: 'official' | 'admin'; deptId?: string }> = [
  { uid: 'off_municipal', email: 'municipal@civix.gov.in', password: 'Muni@2026', displayName: 'Municipal Officer', photoURL: 'https://ui-avatars.com/api/?name=Municipal+Officer&background=2563eb&color=fff', emailVerified: true, role: 'official', deptId: 'municipal' },
  { uid: 'off_transport', email: 'transport@civix.gov.in', password: 'Trans@2026', displayName: 'Transport Officer', photoURL: 'https://ui-avatars.com/api/?name=Transport+Officer&background=d97706&color=fff', emailVerified: true, role: 'official', deptId: 'transport' },
  { uid: 'off_electricity', email: 'electricity@civix.gov.in', password: 'Elec@2026', displayName: 'Power Officer', photoURL: 'https://ui-avatars.com/api/?name=Power+Officer&background=eab308&color=fff', emailVerified: true, role: 'official', deptId: 'electricity' },
  { uid: 'off_water', email: 'water@civix.gov.in', password: 'Water@2026', displayName: 'Water Officer', photoURL: 'https://ui-avatars.com/api/?name=Water+Officer&background=0284c7&color=fff', emailVerified: true, role: 'official', deptId: 'water' },
  { uid: 'off_education', email: 'education@civix.gov.in', password: 'Edu@2026', displayName: 'Education Officer', photoURL: 'https://ui-avatars.com/api/?name=Education+Officer&background=7c3aed&color=fff', emailVerified: true, role: 'official', deptId: 'education' },
  { uid: 'off_health', email: 'health@civix.gov.in', password: 'Health@2026', displayName: 'Health Officer', photoURL: 'https://ui-avatars.com/api/?name=Health+Officer&background=dc2626&color=fff', emailVerified: true, role: 'official', deptId: 'health' },
  { uid: 'off_admin', email: 'admin@civix.gov.in', password: 'Admin@2026', displayName: 'Central Administrator', photoURL: 'https://ui-avatars.com/api/?name=Admin&background=10b981&color=fff', emailVerified: true, role: 'admin' },
];

function ensureSeededAccounts(users: StoredAuthUser[]): StoredAuthUser[] {
  let modified = false;
  const currentUsers = [...users];

  SEEDED_OFFICIALS.forEach(official => {
    const exists = currentUsers.some(u => u.email?.toLowerCase() === official.email.toLowerCase());
    if (!exists) {
      currentUsers.push({
        uid: official.uid,
        email: official.email,
        password: official.password,
        displayName: official.displayName,
        photoURL: official.photoURL,
        emailVerified: official.emailVerified
      });
      modified = true;
    }
  });

  if (modified) {
    writeJson(AUTH_USERS_KEY, currentUsers);
  }
  return currentUsers;
}

const FAKE_CITIZEN_IDS = ['citizen_champ_1', 'citizen_champ_2', 'citizen_champ_3', 'citizen_champ_4', 'citizen_champ_5'];

function ensureSeededUserProfiles(dbObj: Record<string, Record<string, any>>) {
  const usersCollection = dbObj['users'] || {};
  let modified = false;

  // Purge old fake citizen IDs from db if they exist
  FAKE_CITIZEN_IDS.forEach(id => {
    if (usersCollection[id]) {
      delete usersCollection[id];
      modified = true;
    }
  });

  SEEDED_OFFICIALS.forEach(official => {
    const existing = usersCollection[official.uid] || {};
    if (!existing.email || existing.displayName !== official.displayName || existing.role !== official.role || existing.departmentId !== (official.deptId || (official.role === 'admin' ? 'admin' : null))) {
      usersCollection[official.uid] = {
        ...existing,
        displayName: official.displayName,
        email: official.email,
        photoUrl: official.photoURL,
        role: official.role,
        departmentId: official.deptId || (official.role === 'admin' ? 'admin' : null),
        emailVerified: true,
        coins: existing.coins || 0,
        updatedAt: new Date().toISOString(),
        createdAt: existing.createdAt || new Date().toISOString()
      };
      modified = true;
    }
  });

  if (modified) {
    dbObj['users'] = usersCollection;
    writeJson(DB_KEY, dbObj);
  }
}

/**
 * Award Civic Coins to a user profile and update their complaint counts.
 * Syncs user metadata and triggers real-time leaderboard position updates.
 */
export function awardUserCoins(uid: string, amount: number, isResolutionBonus = false) {
  const dbObj = readDb();
  const usersCollection = dbObj['users'] || {};
  const userDoc = usersCollection[uid] || {};
  const currentUser = auth.currentUser;

  const currentCoins = userDoc.coins || userDoc.civicCoins || 0;
  const currentComplaints = userDoc.complaintsCount || 0;
  const currentResolved = userDoc.resolvedCount || 0;
  const newCoins = currentCoins + amount;

  usersCollection[uid] = {
    ...userDoc,
    displayName: userDoc.displayName || currentUser?.displayName || 'Citizen',
    email: userDoc.email || currentUser?.email || `${uid}@civix.user`,
    photoUrl: userDoc.photoUrl || currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDoc.displayName || currentUser?.displayName || 'Citizen')}&background=10b981&color=fff`,
    role: userDoc.role || 'citizen',
    coins: newCoins,
    civicCoins: newCoins,
    complaintsCount: isResolutionBonus ? currentComplaints : currentComplaints + 1,
    resolvedCount: isResolutionBonus ? currentResolved + 1 : currentResolved,
    updatedAt: new Date().toISOString()
  };

  dbObj['users'] = usersCollection;
  writeDb(dbObj);
}

function ensureSeededAnnouncements(dbObj: Record<string, Record<string, any>>) {
  // Purge any old demo announcement IDs from db if they exist
  const annCollection = dbObj['announcements'] || {};
  let modified = false;
  ['ann_1', 'ann_2', 'ann_3'].forEach(id => {
    if (annCollection[id]) {
      delete annCollection[id];
      modified = true;
    }
  });
  if (modified) {
    dbObj['announcements'] = annCollection;
    writeJson(DB_KEY, dbObj);
  }
}

function ensureSeededIssues(_dbObj: Record<string, Record<string, any>>) {
  // No demo data — only real citizen-reported issues appear in the feed
}

// ── One-time migration: remove old seeded demo issues & demo accounts ──────
const DEMO_ISSUE_IDS = ['issue_101', 'issue_102', 'issue_103', 'issue_104'];
const MIGRATION_KEY = 'civix.migrated_v3';
if (typeof window !== 'undefined' && !localStorage.getItem(MIGRATION_KEY)) {
  try {
    const raw = localStorage.getItem('civix.localDb');
    if (raw) {
      const db = JSON.parse(raw);
      let changed = false;
      if (db.issues) {
        DEMO_ISSUE_IDS.forEach(id => {
          if (db.issues[id]) {
            delete db.issues[id];
            changed = true;
          }
        });
      }
      if (db.users) {
        Object.keys(db.users).forEach(uid => {
          if (db.users[uid]?.email === 'google.citizen@civix.demo') {
            delete db.users[uid];
            changed = true;
          }
        });
      }
      if (changed) localStorage.setItem('civix.localDb', JSON.stringify(db));
    }
    const currentRaw = localStorage.getItem('civix.currentUser');
    if (currentRaw && currentRaw.includes('google.citizen@civix.demo')) {
      localStorage.removeItem('civix.currentUser');
    }
  } catch { /* ignore parse errors */ }
  localStorage.setItem(MIGRATION_KEY, '1');
}


let lastRawDbString: string | null = null;
let lastRawAuthUsersString: string | null = null;

function readAuthUsers(): StoredAuthUser[] {
  const currentRaw = localStorage.getItem(AUTH_USERS_KEY);
  if (!cachedAuthUsers || currentRaw !== lastRawAuthUsersString) {
    lastRawAuthUsersString = currentRaw;
    const rawUsers = readJson<StoredAuthUser[]>(AUTH_USERS_KEY, []);
    cachedAuthUsers = ensureSeededAccounts(rawUsers);
  }
  return cachedAuthUsers;
}

function writeAuthUsers(users: StoredAuthUser[]) {
  cachedAuthUsers = users;
  const raw = JSON.stringify(users, replacer);
  lastRawAuthUsersString = raw;
  localStorage.setItem(AUTH_USERS_KEY, raw);
}

function toUser(stored: Omit<StoredAuthUser, 'password'>): LocalUser {
  return {
    uid: stored.uid,
    email: stored.email,
    displayName: stored.displayName,
    photoURL: stored.photoURL,
    emailVerified: stored.emailVerified,
    reload: async () => {}
  };
}

function getCurrentUser(): LocalUser | null {
  if (cachedCurrentUser === undefined) {
    const current = readJson<Omit<StoredAuthUser, 'password'> | null>(CURRENT_USER_KEY, null);
    cachedCurrentUser = current ? toUser(current) : null;
  }
  return cachedCurrentUser;
}

function setCurrentUser(user: LocalUser | null) {
  cachedCurrentUser = user;
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    try { channel?.postMessage({ type: 'auth_updated' }); } catch { /* ignore */ }
    notify();
    return;
  }
  writeJson(CURRENT_USER_KEY, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified
  });
  try { channel?.postMessage({ type: 'auth_updated' }); } catch { /* ignore */ }
  notify();
}

function readDb(): Record<string, Record<string, any>> {
  const currentRaw = localStorage.getItem(DB_KEY);
  if (!cachedDb || currentRaw !== lastRawDbString) {
    lastRawDbString = currentRaw;
    const rawDb = readJson<Record<string, Record<string, any>>>(DB_KEY, {});
    ensureSeededUserProfiles(rawDb);
    ensureSeededAnnouncements(rawDb);
    ensureSeededIssues(rawDb);
    cachedDb = rawDb;
  }
  return cachedDb;
}

function writeDb(data: Record<string, Record<string, any>>) {
  cachedDb = data;
  const raw = JSON.stringify(data, replacer);

  try {
    localStorage.setItem(DB_KEY, raw);
    lastRawDbString = raw;
  } catch (err: any) {
    // QuotaExceededError — strip large base64 images and retry
    if (err?.name === 'QuotaExceededError' || err?.code === 22 || err?.code === 1014) {
      console.warn('LocalStorage quota exceeded. Stripping large images and retrying...');
      const stripped = JSON.parse(JSON.stringify(data, replacer));
      if (stripped.issues) {
        Object.keys(stripped.issues).forEach(id => {
          const issue = stripped.issues[id];
          if (issue.photoUrl && issue.photoUrl.startsWith('data:') && issue.photoUrl.length > 20000) {
            issue.photoUrl = '';
          }
          if (issue.resolutionPhotoUrl && issue.resolutionPhotoUrl.startsWith('data:') && issue.resolutionPhotoUrl.length > 20000) {
            issue.resolutionPhotoUrl = '';
          }
        });
      }
      try {
        const strippedRaw = JSON.stringify(stripped, replacer);
        localStorage.setItem(DB_KEY, strippedRaw);
        lastRawDbString = strippedRaw;
        cachedDb = stripped;
        console.warn('Saved with images stripped due to quota limit.');
      } catch (e2) {
        console.error('Failed to save even after stripping images:', e2);
      }
    } else {
      console.error('Failed to write to localStorage:', err);
    }
  }

  // Push update to ALL other portals/tabs instantly via BroadcastChannel
  try { channel?.postMessage({ type: 'db_updated' }); } catch { /* ignore */ }
  notify();
}

// ─── Cross-Tab Real-Time Sync ────────────────────────────────────────────────
// BroadcastChannel fires instantly in ALL same-origin tabs/windows in the same
// browser — unlike the storage event which only fires in OTHER tabs and is
// often delayed. This ensures Citizens, Municipal, Electricity, Water, etc.
// portals ALL get live updates the instant anyone writes data.
let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  try {
    channel = new BroadcastChannel('civix_db_sync');
    channel.addEventListener('message', (evt) => {
      if (evt.data?.type === 'db_updated') {
        cachedDb = null;
        lastRawDbString = null;
        notify();
      }
      if (evt.data?.type === 'auth_updated') {
        cachedCurrentUser = undefined;
        notify();
      }
    });
  } catch {
    // BroadcastChannel not supported (very old browsers) — fall back to storage events
  }

  // Storage event fallback for when tabs are in different browser windows
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) {
      cachedDb = null;
      lastRawDbString = e.newValue ?? null;
      notify();
    }
    if (e.key === AUTH_USERS_KEY) {
      cachedAuthUsers = null;
      lastRawAuthUsersString = null;
      notify();
    }
    if (e.key === CURRENT_USER_KEY) {
      cachedCurrentUser = undefined;
      notify();
    }
  });
}


function notify() {
  listeners.forEach(listener => listener());
}

function docSnapshot(id: string, data?: any) {
  return {
    id,
    exists: () => Boolean(data),
    data: () => data || {}
  };
}

function collectionDocs(ref: CollectionRef) {
  const all = readDb()[ref.path] || {};
  let docs = Object.entries(all).map(([id, data]) => docSnapshot(id, data));

  for (const filter of ref.filters || []) {
    docs = docs.filter(snapshot => snapshot.data()?.[filter.field] === filter.value);
  }

  return docs;
}

function applyValue(current: any, value: any) {
  if (value && value.__op === 'increment') return (Number(current) || 0) + value.by;
  return value;
}

function writeDoc(ref: DocRef, data: Record<string, any>, merge = false) {
  const store = readDb();
  const collectionData = store[ref.collectionPath] || {};
  const previous = collectionData[ref.id] || {};
  collectionData[ref.id] = merge ? { ...previous, ...data } : data;
  store[ref.collectionPath] = collectionData;
  writeDb(store);
}

function patchDoc(ref: DocRef, data: Record<string, any>) {
  const store = readDb();
  const collectionData = store[ref.collectionPath] || {};
  const previous = collectionData[ref.id] || {};
  const next = { ...previous };

  Object.entries(data).forEach(([key, value]) => {
    next[key] = applyValue(previous[key], value);
  });

  collectionData[ref.id] = next;
  store[ref.collectionPath] = collectionData;
  writeDb(store);
}

function removeDoc(ref: DocRef) {
  const store = readDb();
  const collectionData = store[ref.collectionPath] || {};
  delete collectionData[ref.id];
  store[ref.collectionPath] = collectionData;
  writeDb(store);
}

export function collection(_dbOrRef: unknown, path: string): CollectionRef {
  return { kind: 'collection', path };
}

export function doc(dbOrCollection: unknown, pathOrId?: string, maybeId?: string): DocRef {
  if ((dbOrCollection as CollectionRef)?.kind === 'collection') {
    const collectionRef = dbOrCollection as CollectionRef;
    const id = pathOrId || uid();
    return { kind: 'doc', path: `${collectionRef.path}/${id}`, id, collectionPath: collectionRef.path };
  }

  const fullPath = maybeId ? `${pathOrId}/${maybeId}` : pathOrId || uid();
  const parts = fullPath.split('/').filter(Boolean);
  const id = parts.pop() || uid();
  const collectionPath = parts.join('/');
  return { kind: 'doc', path: fullPath, id, collectionPath };
}

export function where(field: string, op: '==', value: unknown): Filter {
  return { field, op, value };
}

export function query(ref: CollectionRef, ...filters: Filter[]): CollectionRef {
  return { ...ref, filters: [...(ref.filters || []), ...filters] };
}

export function orderBy() {
  return null;
}

export function limit() {
  return null;
}

export function onSnapshot(ref: CollectionRef | DocRef, next: (snapshot: any) => void, error?: (error: Error) => void) {
  const emit = () => {
    try {
      if (ref.kind === 'collection') {
        next({ docs: collectionDocs(ref) });
      } else {
        const data = readDb()[ref.collectionPath]?.[ref.id];
        next(docSnapshot(ref.id, data));
      }
    } catch (err) {
      error?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  emit();
  listeners.add(emit);
  return () => listeners.delete(emit);
}

export async function getDoc(ref: DocRef) {
  return docSnapshot(ref.id, readDb()[ref.collectionPath]?.[ref.id]);
}

export async function getDocs(ref: CollectionRef) {
  return { docs: collectionDocs(ref) };
}

export async function setDoc(ref: DocRef, data: Record<string, any>, options?: { merge?: boolean }) {
  writeDoc(ref, data, Boolean(options?.merge));
}

export async function updateDoc(ref: DocRef, data: Record<string, any>) {
  patchDoc(ref, data);
}

export async function addDoc(ref: CollectionRef, data: Record<string, any>) {
  const newDoc = doc(ref);
  writeDoc(newDoc, data);
  return newDoc;
}

export async function deleteDoc(ref: DocRef) {
  removeDoc(ref);
}

export function serverTimestamp() {
  return makeTimestamp();
}

export function increment(by: number): IncrementOp {
  return { __op: 'increment', by };
}

/**
 * Prune base64 images from localStorage to free up space before saving a new large payload.
 * Removes photoUrl and resolutionPhotoUrl from all issues EXCEPT the one being updated.
 * This prevents QuotaExceededError when multiple issues have photos.
 */
export function pruneImagesInStore(exceptIssueId?: string) {
  const store = readDb();
  if (!store.issues) return;
  let modified = false;
  Object.keys(store.issues).forEach(id => {
    if (id === exceptIssueId) return;
    const issue = store.issues[id];
    if (issue.photoUrl && issue.photoUrl.startsWith('data:')) {
      issue.photoUrl = '';
      modified = true;
    }
    if (issue.resolutionPhotoUrl && issue.resolutionPhotoUrl.startsWith('data:')) {
      issue.resolutionPhotoUrl = '';
      modified = true;
    }
  });
  if (modified) {
    try {
      const raw = JSON.stringify(store, replacer);
      localStorage.setItem(DB_KEY, raw);
      lastRawDbString = raw;
      cachedDb = store;
    } catch {
      // ignore
    }
  }
}

export function writeBatch(_db?: unknown) {
  const ops: Array<() => void> = [];
  return {
    set: (ref: DocRef, data: Record<string, any>) => ops.push(() => writeDoc(ref, data, true)),
    update: (ref: DocRef, data: Record<string, any>) => ops.push(() => patchDoc(ref, data)),
    delete: (ref: DocRef) => ops.push(() => removeDoc(ref)),
    commit: async () => {
      ops.forEach(operation => operation());
    }
  };
}

export const Timestamp = {
  now: () => makeTimestamp()
};

export function onAuthStateChanged(_auth: typeof auth, callback: (user: LocalUser | null) => void) {
  const emit = () => callback(getCurrentUser());
  emit();
  listeners.add(emit);
  return () => listeners.delete(emit);
}

export async function createUserWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readAuthUsers();

  if (users.some(user => user.email === normalizedEmail)) {
    throw Object.assign(new Error('This email is already registered.'), { code: 'auth/email-already-in-use' });
  }

  if (password.length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters.'), { code: 'auth/weak-password' });
  }

  const stored: StoredAuthUser = {
    uid: uid(),
    email: normalizedEmail,
    password,
    displayName: normalizedEmail.split('@')[0],
    photoURL: null,
    emailVerified: true
  };

  writeAuthUsers([...users, stored]);
  const user = toUser(stored);
  setCurrentUser(user);
  return { user };
}

export async function signInWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = readAuthUsers().find(item => item.email === normalizedEmail && item.password === password);

  if (!user) {
    throw Object.assign(new Error('Invalid email or password.'), { code: 'auth/invalid-credential' });
  }

  const localUser = toUser(user);
  setCurrentUser(localUser);
  return { user: localUser };
}

export async function updateProfile(user: LocalUser, profile: { displayName?: string; photoURL?: string }) {
  const users = readAuthUsers();
  const index = users.findIndex(item => item.uid === user.uid);

  if (index >= 0) {
    users[index] = {
      ...users[index],
      displayName: profile.displayName ?? users[index].displayName,
      photoURL: profile.photoURL ?? users[index].photoURL
    };
    writeAuthUsers(users);
  }

  user.displayName = profile.displayName ?? user.displayName;
  user.photoURL = profile.photoURL ?? user.photoURL;
  setCurrentUser(user);
}

export async function signOut(_auth?: typeof auth) {
  setCurrentUser(null);
}

/**
 * Sign in a user authenticated via an external provider (e.g., Clerk Google OAuth)
 * without needing a password. Creates a local account record if one doesn't exist yet,
 * then sets the user as current so the rest of the app sees them as logged in.
 */
export async function signInWithExternalProvider(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string | null
): Promise<LocalUser> {
  const users = readAuthUsers();
  const existing = users.find(u => u.uid === uid || u.email?.toLowerCase() === email.toLowerCase());

  if (!existing) {
    const newUser: StoredAuthUser = {
      uid,
      email: email.toLowerCase(),
      password: '__external__', // placeholder — never used for auth
      displayName,
      photoURL: photoURL ?? null,
      emailVerified: true
    };
    writeAuthUsers([...users, newUser]);
  } else if (existing.uid !== uid) {
    // email matches but uid differs — update uid to match external provider
    const idx = users.indexOf(existing);
    users[idx] = { ...existing, uid, displayName, photoURL: photoURL ?? existing.photoURL };
    writeAuthUsers(users);
  }

  const localUser: LocalUser = {
    uid,
    email,
    displayName,
    photoURL: photoURL ?? null,
    emailVerified: true,
    reload: async () => {}
  };
  setCurrentUser(localUser);
  return localUser;
}