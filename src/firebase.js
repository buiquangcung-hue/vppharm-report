// Firebase core
import { initializeApp } from "firebase/app";

// Firebase services
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxkm22xRpjMckegNdEvVs0-jHJ2UraVXM",
  authDomain: "enthusiasts-golf-club-6868.firebaseapp.com",
  projectId: "enthusiasts-golf-club-6868",
  storageBucket: "enthusiasts-golf-club-6868.appspot.com",
  messagingSenderId: "698818839991",
  appId: "1:698818839991:web:88181ce4eae924ee4c1432",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export services
export { auth, db, storage };