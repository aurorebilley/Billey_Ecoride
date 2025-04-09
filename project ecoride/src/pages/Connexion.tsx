import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';
import { auth } from '../lib/firebase';

export function Connexion() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      let message = 'Une erreur est survenue';
      switch (err.code) {
        case 'auth/invalid-email':
          message = 'Adresse e-mail invalide';
          break;
        case 'auth/user-not-found':
          message = 'Aucun compte trouvé avec cette adresse e-mail';
          break;
        case 'auth/wrong-password':
          message = 'Mot de passe incorrect';
          break;
        case 'auth/too-many-requests':
          message = 'Trop de tentatives. Veuillez réessayer plus tard';
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
            Connexion à EcoWay
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connectez-vous pour accéder à votre espace de covoiturage
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
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-[#3E920B] focus:border-[#3E920B] focus:z-10 sm:text-sm"
                placeholder="Mot de passe (1 majuscule et 1 caractère spécial requis)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Le mot de passe doit contenir au moins une majuscule et un caractère spécial
              </p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="font-medium text-[#3E920B] hover:text-[#A7DE65]">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}