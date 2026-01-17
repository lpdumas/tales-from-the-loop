import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD3NX9D6WjLJyq7Z3LVlbnRdSjUDGrY2FU',
  authDomain: 'tales-from-the-loop-cfdb9.firebaseapp.com',
  projectId: 'tales-from-the-loop-cfdb9',
  storageBucket: 'tales-from-the-loop-cfdb9.firebasestorage.app',
  messagingSenderId: '36219916873',
  appId: '1:36219916873:web:1c65563ec6ae9a9eeee598',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
