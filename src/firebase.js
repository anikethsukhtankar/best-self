// Firebase is optional. Without VITE_FIREBASE_* values the app is local-only and the SDK is never
// downloaded; with them, loadFirebase() imports the SDK on demand and initialises it once.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== 'undefined'
);

let ready = null;

export function loadFirebase() {
  if (!isFirebaseConfigured) return Promise.resolve(null);
  if (!ready) {
    ready = Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(
      ([appMod, authMod, firestoreMod]) => {
        const app = appMod.initializeApp(firebaseConfig);
        return {
          app,
          auth: authMod.getAuth(app),
          googleProvider: new authMod.GoogleAuthProvider(),
          db: firestoreMod.getFirestore(app),
          authMod,
          firestoreMod,
        };
      }
    );
  }
  return ready;
}
