import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AlertCircle } from 'lucide-react';
import { auth, db } from '../lib/firebase';

export function Inscription() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { user } = userCredential;

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        date_creation: serverTimestamp(),
        date_modification: serverTimestamp(),
        user_id: user.uid,
        adresse_mail: email,
        pseudo,
        role: 'user'
      });

      // Create credit document in Firestore
      await setDoc(doc(db, 'credit', user.uid), {
        date_creation: serverTimestamp(),
        date_modification: serverTimestamp(),
        user_id: user.uid,
        solde: 20
      });

      // Redirect to user space
      navigate('/fiche-renseignement');
    } catch (err: any) {
      let message = 'Une erreur est survenue';
      switch (err.code) {
        case 'auth/email-already-in-use':
          message = 'Cette adresse e-mail est déjà utilisée';
          break;
        case 'auth/invalid-email':
          message = 'Adresse e-mail invalide';
          break;
        case 'auth/weak-password':
          message = 'Le mot de passe doit contenir au moins 8 caractères';
          break;
        case 'auth/operation-not-allowed':
          message = "La création de compte n'est pas autorisée";
          break;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-[#333333]">
            Créer un compte EcoWay
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Rejoignez notre communauté de covoiturage écologique
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Adresse e-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-[#3E920B] focus:border-[#3E920B] focus:z-10 sm:text-sm"
                placeholder="Adresse e-mail"
              />
            </div>
            <div>
              <label htmlFor="pseudo" className="sr-only">
                Pseudo
              </label>
              <input
                id="pseudo"
                name="pseudo"
                type="text"
                autoComplete="username"
                required
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-[#3E920B] focus:border-[#3E920B] focus:z-10 sm:text-sm"
                placeholder="Pseudo"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-[#3E920B] focus:border-[#3E920B] focus:z-10 sm:text-sm"
                placeholder="Mot de passe (8 caractères minimum)"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Création du compte...' : 'Créer mon compte'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Déjà inscrit ?{' '}
            <Link to="/connexion" className="font-medium text-[#3E920B] hover:text-[#A7DE65]">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}