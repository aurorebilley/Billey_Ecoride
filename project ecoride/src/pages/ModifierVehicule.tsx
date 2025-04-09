import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  ArrowLeft,
  Trash2,
  AlertTriangle,
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
  user_id: string;
  preferences: {
    fumeur: boolean;
    animaux: boolean;
    musique: boolean;
  };
}

export function ModifierVehicule() {
  const navigate = useNavigate();
  const { id: vehicleId } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(false);

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

      if (!vehicleId) {
        setError('Identifiant du véhicule manquant');
        setIsLoading(false);
        return;
      }

      try {
        // Get vehicle data
        const vehicleDoc = await getDoc(doc(db, 'vehicules', vehicleId));
        
        if (!vehicleDoc.exists()) {
          setError('Véhicule non trouvé');
          setIsLoading(false);
          return;
        }

        const vehicleData = vehicleDoc.data() as Vehicle;

        // Check if user owns the vehicle
        if (vehicleData.user_id !== firebaseUser.uid) {
          setError('Vous n\'avez pas les droits pour modifier ce véhicule');
          setIsLoading(false);
          return;
        }

        setVehicle(vehicleData);
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate, vehicleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!vehicle || !vehicleId) {
        throw new Error('Données du véhicule manquantes');
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

      // Update vehicle
      await updateDoc(doc(db, 'vehicules', vehicleId), {
        ...vehicle,
        date_modification: serverTimestamp(),
      });

      setSuccess('Véhicule mis à jour avec succès');
      setTimeout(() => navigate('/monespace'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      if (!vehicleId) {
        throw new Error('Identifiant du véhicule manquant');
      }

      await deleteDoc(doc(db, 'vehicules', vehicleId));
      navigate('/monespace');
    } catch (err) {
      setError('Erreur lors de la suppression du véhicule');
      console.error(err);
    } finally {
      setIsLoading(false);
      setDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center">Chargement...</div>
      </main>
    );
  }

  if (error && !vehicle) {
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

  if (!vehicle) {
    return null;
  }

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Car className="h-6 w-6 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Modifier le véhicule
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
                    setVehicle((prev) =>
                      prev ? { ...prev, plaque: e.target.value.toUpperCase() } : null
                    )
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
                    setVehicle((prev) =>
                      prev ? { ...prev, dateImmatriculation: e.target.value } : null
                    )
                  }
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
                    setVehicle((prev) =>
                      prev ? { ...prev, marque: e.target.value } : null
                    )
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
                    setVehicle((prev) =>
                      prev ? { ...prev, modele: e.target.value } : null
                    )
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
                    setVehicle((prev) =>
                      prev ? { ...prev, couleur: e.target.value } : null
                    )
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
                    setVehicle((prev) =>
                      prev ? { ...prev, places: parseInt(e.target.value) } : null
                    )
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
                      setVehicle((prev) =>
                        prev ? { ...prev, electrique: e.target.checked } : null
                      )
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
                      setVehicle((prev) =>
                        prev
                          ? {
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                fumeur: e.target.checked,
                              },
                            }
                          : null
                      )
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
                      setVehicle((prev) =>
                        prev
                          ? {
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                animaux: e.target.checked,
                              },
                            }
                          : null
                      )
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
                      setVehicle((prev) =>
                        prev
                          ? {
                              ...prev,
                              preferences: {
                                ...prev.preferences,
                                musique: e.target.checked,
                              },
                            }
                          : null
                      )
                    }
                    className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span className="text-sm">Musique pendant le trajet</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteModal(true)}
                className="sm:flex-none px-4 py-2 border border-transparent rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Supprimer ce véhicule
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Confirmer la suppression
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est
              irréversible.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setDeleteModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}