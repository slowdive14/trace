import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDXL7BdN1a-eCBbgkmm9FwQchwQlxiAWrY",
    authDomain: "trace-fa37e.firebaseapp.com",
    projectId: "trace-fa37e",
    storageBucket: "trace-fa37e.firebasestorage.app",
    messagingSenderId: "524305052006",
    appId: "1:524305052006:web:0e75a710fbaf6f04f618a7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
