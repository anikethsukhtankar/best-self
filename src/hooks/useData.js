import { useState, useEffect, useCallback } from 'react';
import { loadFirebase, isFirebaseConfigured } from '../firebase';
import { STORAGE_KEY, DEFAULT_STATE } from '../utils/constants';
import { sanitizeData } from '../utils/habits';
import { sampleState } from '../utils/sample';

// Is there anything stored on this device yet? (A first visit shows the welcome.)
export const hasStoredState = () => {
  try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
};

// Start this device with the default habits, stored right away so the welcome does not return.
export const beginFresh = ({ darkMode = false } = {}) => {
  const fresh = sanitizeData({ ...DEFAULT_STATE, settings: { ...DEFAULT_STATE.settings, darkMode } });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch { /* private mode: it lives in memory */ }
};

// `sample`: a year of sample history held in memory only. Nothing is read from or written to
// storage or the cloud while it is shown, so real data is never touched.
export function useData(user, { sample = false, darkMode = false } = {}) {
  const [state, setState] = useState(() => (sample ? sanitizeData(sampleState(new Date(), { darkMode })) : null));
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  // Load initial data
  useEffect(() => {
    if (sample) return;
    const loadData = async () => {
      if (user && isFirebaseConfigured) {
        // User is signed in - load from Firestore
        try {
          const fb = await loadFirebase();
          const { doc, getDoc, setDoc } = fb.firestoreMod;
          const docRef = doc(fb.db, 'users', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setState(sanitizeData(data));
            setLastSynced(new Date());
          } else {
            // New user - check for local data to migrate
            const localData = localStorage.getItem(STORAGE_KEY);
            if (localData) {
              const parsed = JSON.parse(localData);
              await setDoc(docRef, parsed);
              setState(sanitizeData(parsed));
            } else {
              // Completely new - use defaults
              await setDoc(docRef, DEFAULT_STATE);
              setState(sanitizeData(DEFAULT_STATE));
            }
            setLastSynced(new Date());
          }
        } catch (error) {
          console.error('Error loading data:', error);
          // Fall back to local storage
          const localData = localStorage.getItem(STORAGE_KEY);
          setState(sanitizeData(localData ? JSON.parse(localData) : DEFAULT_STATE));
        }
      } else {
        // Not signed in - use local storage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          setState(sanitizeData(stored ? JSON.parse(stored) : DEFAULT_STATE));
        } catch {
          setState(sanitizeData(DEFAULT_STATE));
        }
      }
    };

    loadData();
  }, [user, sample]);

  // Another tab on this device saved: take its state, so two open tabs never overwrite each other.
  useEffect(() => {
    if (sample || (user && isFirebaseConfigured)) return undefined;
    const onStorage = (ev) => {
      if (ev.key !== STORAGE_KEY || !ev.newValue) return;
      try { setState(sanitizeData(JSON.parse(ev.newValue))); } catch { /* a half-written value: the next save wins */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user, sample]);

  // Subscribe to real-time updates when signed in
  useEffect(() => {
    if (sample || !user || !isFirebaseConfigured) return undefined;

    let cancelled = false;
    let unsubscribe = () => {};
    loadFirebase().then((fb) => {
      if (cancelled || !fb) return;
      const { doc, onSnapshot } = fb.firestoreMod;
      const docRef = doc(fb.db, 'users', user.uid);
      unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Only update if data is different (avoid loops)
          setState(prev => {
            const newData = sanitizeData(data);
            if (JSON.stringify(prev) !== JSON.stringify(newData)) {
              setLastSynced(new Date());
              return newData;
            }
            return prev;
          });
        }
      }, (error) => {
        console.error('Snapshot error:', error);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, sample]);

  // Save data
  const save = useCallback(async (newState) => {
    setState(newState);
    if (sample) return;

    if (user && isFirebaseConfigured) {
      // Save to Firestore
      setSyncing(true);
      try {
        const fb = await loadFirebase();
        const docRef = fb.firestoreMod.doc(fb.db, 'users', user.uid);
        await fb.firestoreMod.setDoc(docRef, {
          ...newState,
          updatedAt: new Date().toISOString()
        });
        setLastSynced(new Date());
      } catch (error) {
        console.error('Error saving to Firestore:', error);
      } finally {
        setSyncing(false);
      }
    }

    // Always save to local storage as backup
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
  }, [user, sample]);

  // Import data (for backup restore)
  const importData = useCallback(async (data) => {
    const sanitized = sanitizeData(data);
    await save({
      ...sanitized,
      settings: {
        ...sanitized.settings,
        darkMode: sanitized.settings?.darkMode || false
      }
    });
  }, [save]);

  // Export data
  const exportData = useCallback(() => {
    if (!state) return;

    const data = {
      ...state,
      exportedAt: new Date().toISOString(),
      version: '3.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `best-self-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state]);

  return {
    state,
    save,
    importData,
    exportData,
    syncing,
    lastSynced,
    isCloudEnabled: !!user
  };
}
