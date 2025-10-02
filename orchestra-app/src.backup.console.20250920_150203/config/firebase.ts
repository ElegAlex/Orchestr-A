import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// import { getAnalytics } from 'firebase/analytics';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "orchestr-a-3b48e.web.app",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "orchestr-a-3b48e",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "727625651545",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:727625651545:web:bcfec2aff94934c73f6848",
  // measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-ZE4L1M8C8G"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// export const analytics = getAnalytics(app);
export const functions = getFunctions(app, 'europe-west1'); // Spécifier la région

// Pour le développement local (optionnel)
if (process.env.NODE_ENV === 'development') {
  // connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;