import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCK7h6hOspbgKJgkmivJ9jxYHCOhmCPAKY",
  authDomain: "dhammadha-studio.firebaseapp.com",
  projectId: "dhammadha-studio",
  storageBucket: "dhammadha-studio.firebasestorage.app",
  messagingSenderId: "90771649996",
  appId: "1:90771649996:web:e25d6dabdb938247ead969",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
