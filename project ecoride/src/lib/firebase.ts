import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBy4Q-x_Hxa012pV2lwJ6eMD5TxLaBvM5Q",
  authDomain: "ecoway-e9880.firebaseapp.com",
  projectId: "ecoway-e9880",
  storageBucket: "ecoway-e9880.firebasestorage.app",
  messagingSenderId: "43615925773",
  appId: "1:43615925773:web:d2b2acda655f1631498744",
  measurementId: "G-8GW4G1VJ3N"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage }