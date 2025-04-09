import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { auth, db, storage } from './lib/firebase';
import App from './App.tsx';
import './index.css';

// Ensure Firebase is initialized
if (!auth || !db || !storage) {
  throw new Error('Firebase services not initialized properly');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
