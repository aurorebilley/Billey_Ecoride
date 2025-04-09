import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  ArrowLeft,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

interface Vehicle {
  plaque: string;
  dateImmatriculation: string;
  marque: string;
  modele: string;
  couleur: string;
  places: number;
  electrique: boolean;
  preferences: {
    fumeur: boolean;
    animaux: boolean;
    musique: boolean;
  };
}

export function AjouterVehicule() {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle>({
    plaque: '',
    dateImmatriculation: '',
    marque: '',
    modele: '',
    couleur: '',
    places: 4,
    electrique: false,
    preferences: {
      fumeur: false,
      animaux: false,
      musique: false,
    },
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Validation des plaques d'immatriculation (format français)
  const validatePlaque = (plaque: string) => {
    const regex = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;
    return regex.test(plaque);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/connexion');
        return;
      }

      try {
        // Get user data and check if they have the driver role
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          setError('Profil utilisateur non trouvé');
          return;
        }

        const userData = userDoc.data();
        if (!userData.roles?.includes('chauffeur')) {
          setError('Vous devez être chauffeur pour ajouter un véhicule');
          return;
        }

        setIsAuthorized(true);
      } catch (err) {
        setError('Erreur lors de la vérification des droits');
        console.error(err);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Utilisateur non connecté');
      }

      // Validate fields
      if (!validatePlaque(vehicle.plaque)) {
        throw new Error('Format de plaque invalide (ex: AB-123-CD)');
      }
      if (!vehicle.marque || !vehicle.modele || !vehicle.couleur) {
        throw new Error('Tous les champs sont obligatoires');
      }
      if (vehicle.places < 1 || vehicle.places > 9) {
        throw new Error('Le nombre de places doit être entre 1 et 9');
      }

      // Check if vehicle already exists
      const vehicleDoc = await getDoc(doc(db, 'vehicules', vehicle.plaque));
      if (vehicleDoc.exists()) {
        throw new Error('Un véhicule avec cette plaque existe déjà');
      }

      // Create vehicle document
      await setDoc(doc(db, 'vehicules', vehicle.plaque), {
        ...vehicle,
        user_id: currentUser.uid,
        date_creation: serverTimestamp(),
        date_modification: serverTimestamp(),
      });

      setSuccess('Véhicule ajouté avec succès');
      setTimeout(() => navigate('/monespace'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/monespace')}
            className="mt-4 flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Retour à mon espace
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Car className="h-6 w-6 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Ajouter un véhicule
              </h1>
            </div>
            <button
              onClick={() => navigate('/monespace')}
              className="flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Retour
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="ml-3 text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plaque d'immatriculation
                </label>
                <input
                  type="text"
                  value={vehicle.plaque}
                  onChange={(e) =>
                    setVehicle((prev) => ({
                      ...prev,
                      plaque: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="AB-123-CD"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de première immatriculation
                </label>
                <input
                  type="date"
                  value={vehicle.dateImmatriculation}
                  onChange={(e) =>
                    setVehicle((prev) => ({
                      ...prev,
                      dateImmatriculation: e.target.value,
                    }))
                  }
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Marque
                </label>
                <input
                  type="text"
                  value={vehicle.marque}
                  onChange={(e) =>
                    setVehicle((prev) => ({
                      ...prev,
                      marque: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modèle
                </label>
                <input
                  type="text"
                  value={vehicle.modele}
                  onChange={(e) =>
                    setVehicle((prev) => ({
                      ...prev,
                      modele: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Couleur
                </label>
                <input
                  type="text"
                  value={vehicle.couleur}
                  onChange={(e) =>
                    setVehicle((prev) => ({
                      ...prev,
                      couleur: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de places
                </label>
                <input
                  type="number"
                  min="1"
                  max="9"
                  value={vehicle.places}
                  onChange={(e) =>
                    setVehicle((prev) => ({
                      ...prev,
                      places: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={vehicle.electrique}
                    onChange={(e) =>
                      setVehicle((prev) => ({
                        ...prev,
                        electrique: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Véhicule électrique
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Préférences
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={vehicle.preferences.fumeur}
                    onChange={(e) =>
                      setVehicle((prev) => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          fumeur: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span className="text-sm">Fumeur accepté</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={vehicle.preferences.animaux}
                    onChange={(e) =>
                      setVehicle((prev) => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          animaux: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span className="text-sm">Animaux acceptés</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={vehicle.preferences.musique}
                    onChange={(e) =>
                      setVehicle((prev) => ({
                        ...prev,
                        preferences: {
                          ...prev.preferences,
                          musique: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span className="text-sm">Musique pendant le trajet</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enregistrement...' : 'Ajouter le véhicule'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}