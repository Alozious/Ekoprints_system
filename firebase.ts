
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCNieyBeHBTLgXqiKt4BUnYZMehbDKJYYo",
  authDomain: "ekoprints-63f33.firebaseapp.com",
  projectId: "ekoprints-63f33",
  storageBucket: "ekoprints-63f33.firebasestorage.app",
  messagingSenderId: "267612397663",
  appId: "1:267612397663:web:db4d77f83efb262ad3bbea",
  measurementId: "G-SPE7EYYHYE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

export { db, auth };