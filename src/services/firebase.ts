import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDXL7BdN1a-eCBbgkmm9FwQchwQlxiAWrY",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "trace-fa37e.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "trace-fa37e",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "trace-fa37e.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "524305052006",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:524305052006:web:0e75a710fbaf6f04f618a7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
