import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { STORAGE_KEY, DEFAULT_STATE } from '../utils/constants';
import { sanitizeData } from '../utils/habits';

export function useData(user) {
  const [state, setState] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        // User is signed in - load from Firestore
        try {
          const docRef = doc(db, 'users', user.uid);
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
              setState(DEFAULT_STATE);
            }
            setLastSynced(new Date());
          }
        } catch (error) {
          console.error('Error loading data:', error);
          // Fall back to local storage
          const localData = localStorage.getItem(STORAGE_KEY);
          setState(localData ? JSON.parse(localData) : DEFAULT_STATE);
        }
      } else {
        // Not signed in - use local storage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          setState(stored ? JSON.parse(stored) : DEFAULT_STATE);
        } catch (err) {
          setState(DEFAULT_STATE);
        }
      }
    };

    loadData();
  }, [user]);

  // Subscribe to real-time updates when signed in
  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
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

    return () => unsubscribe();
  }, [user]);

  // Save data
  const save = useCallback(async (newState) => {
    setState(newState);

    if (user) {
      // Save to Firestore
      setSyncing(true);
      try {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
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
  }, [user]);

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
      version: '2.0'
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
