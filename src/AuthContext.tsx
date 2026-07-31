import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, User, signInWithExternalProvider, signOut as localSignOut } from './localStore';
import { useUser, useClerk } from '@clerk/clerk-react';

interface UserProfile {
  displayName: string;
  email: string;
  photoUrl: string;
  role: 'citizen' | 'official' | 'admin';
  departmentId?: string;
  civicCoins?: number;
  coins?: number;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profile: null,
  logout: async () => {},
  deleteAccount: async () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Clerk hooks
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  const logout = async () => {
    setLoading(true);
    try {
      if (clerkUser) {
        await clerkSignOut();
      }
    } catch (err) {
      console.warn('Clerk sign out notice:', err);
    }

    try {
      await localSignOut(auth);
    } catch (err) {
      console.warn('LocalStore sign out notice:', err);
    }

    setUser(null);
    setProfile(null);
    setLoading(false);
    window.location.href = '/';
  };

  const deleteAccount = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Delete user profile doc from localStore / Firestore
      await deleteDoc(doc(db, 'users', user.uid));

      // 2. Delete user's reported issues
      const q = query(collection(db, 'issues'), where('reporterUid', '==', user.uid));
      const issueSnapshots = await getDocs(q);
      for (const issueDoc of issueSnapshots.docs) {
        await deleteDoc(doc(db, 'issues', issueDoc.id));
      }

      // 3. Delete Clerk user if logged in via Clerk
      if (clerkUser) {
        await clerkUser.delete();
      }
    } catch (err) {
      console.error("Account deletion error:", err);
    } finally {
      await logout();
    }
  };

  // ── Sync Clerk Google user → localStore on every Google login ────────────
  useEffect(() => {
    if (!clerkLoaded) return;
    if (!clerkUser) return;

    const email = clerkUser.primaryEmailAddress?.emailAddress || `${clerkUser.id}@clerk`;
    const displayName = clerkUser.fullName || clerkUser.firstName || 'Google User';
    const photoURL = clerkUser.imageUrl || null;
    const uid = `clerk_${clerkUser.id}`;

    (async () => {
      try {
        const localUser = await signInWithExternalProvider(uid, email, displayName, photoURL);
        setUser(localUser);

        await setDoc(doc(db, 'users', uid), {
          displayName,
          email,
          photoUrl: photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4285F4&color=fff`,
          role: 'citizen',
          departmentId: null,
          emailVerified: true,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error('Clerk profile sync error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [clerkUser, clerkLoaded]);

  // ── Real-Time User Profile Listener ────────────
  useEffect(() => {
    if (!user?.uid) return;

    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
      }
    }, (err) => {
      console.error("User profile real-time error:", err);
    });

    return unsubProfile;
  }, [user?.uid]);

  // ── Watch localStore auth for email/password logins ─
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (clerkLoaded && clerkUser) return;

      try {
        setUser(currentUser);
        if (!currentUser) {
          setProfile(null);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [clerkUser, clerkLoaded]);

  return (
    <AuthContext.Provider value={{ user, loading, profile, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);