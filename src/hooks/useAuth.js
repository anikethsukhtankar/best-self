import { useState, useEffect, useCallback } from 'react';
import { loadFirebase, isFirebaseConfigured } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    loadFirebase()
      .then((fb) => {
        if (cancelled || !fb) return;
        unsubscribe = fb.authMod.onAuthStateChanged(fb.auth, (nextUser) => {
          setUser(nextUser);
          setLoading(false);
        });
      })
      .catch((error) => {
        console.error('Firebase failed to load:', error);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const fb = await loadFirebase();
    if (!fb) throw new Error('Firebase is not configured');
    const result = await fb.authMod.signInWithPopup(fb.auth, fb.googleProvider);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    const fb = await loadFirebase();
    if (fb) await fb.authMod.signOut(fb.auth);
  }, []);

  return { user, loading, signInWithGoogle, signOut, isFirebaseConfigured };
}
