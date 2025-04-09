import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Euro,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

interface Vehicle {
  plaque: string;
  marque: string;
  modele: string;
  couleur: string;
  electrique: boolean;
  places: number;
}

interface Carpooling {
  depart_rue: string;
  depart_code_postal: string;
  depart_ville: string;
  arrivee_rue: string;
  arrivee_code_postal: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
  date_arrivee: string;
  heure_arrivee: string;
  prix: number;
  vehicule_plaque: string;
  ecologique: boolean;
}

export function CreerVoyage() {
  const navigate = useNavigate();
  const [carpooling, setCarpooling] = useState<Carpooling>({
    depart_rue: '',
    depart_code_postal: '',
    depart_ville: '',
    arrivee_rue: '',
    arrivee_code_postal: '',
    arrivee_ville: '',
    date_depart: '',
    heure_depart: '',
    date_arrivee: '',
    heure_arrivee: '',
    prix: 0,
    vehicule_plaque: '',
    ecologique: false
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

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
          setError('Vous devez être chauffeur pour créer un voyage');
          return;
        }

        // Get user's vehicles
        const vehiclesQuery = query(
          collection(db, 'vehicules'),
          where('user_id', '==', firebaseUser.uid)
        );
        const vehiclesSnapshot = await getDocs(vehiclesQuery);
        const vehiclesList: Vehicle[] = [];
        vehiclesSnapshot.forEach((doc) => {
          vehiclesList.push(doc.data() as Vehicle);
        });
        setVehicles(vehiclesList);

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
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Validation
      if (!carpooling.depart_rue || !carpooling.depart_code_postal || !carpooling.depart_ville) {
        throw new Error('Tous les champs de l\'adresse de départ sont obligatoires');
      }
      if (!carpooling.arrivee_rue || !carpooling.arrivee_code_postal || !carpooling.arrivee_ville) {
        throw new Error('Tous les champs de l\'adresse d\'arrivée sont obligatoires');
      }
      if (!carpooling.date_depart || !carpooling.heure_depart) {
        throw new Error('La date et l\'heure de départ sont obligatoires');
      }
      if (!carpooling.date_arrivee || !carpooling.heure_arrivee) {
        throw new Error('La date et l\'heure d\'arrivée sont obligatoires');
      }
      if (!Number.isInteger(carpooling.prix) || carpooling.prix <= 0) {
        throw new Error('Le prix doit être un nombre entier supérieur à 0');
      }
      if (!carpooling.vehicule_plaque) {
        throw new Error('Veuillez sélectionner un véhicule');
      }

      // Get vehicle info for ecological status
      const vehicleDoc = await getDoc(doc(db, 'vehicules', carpooling.vehicule_plaque));
      if (!vehicleDoc.exists()) {
        throw new Error('Véhicule non trouvé');
      }
      const vehicleData = vehicleDoc.data();
      
      // Initialize empty passagers_id array
      const passagers_id: string[] = [];
      
      // Get user credit document
      const userCreditDoc = await getDoc(doc(db, 'credit', currentUser.uid));
      if (!userCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits');
      }
      
      // Check if user has enough credits
      if (userCreditDoc.data().solde < 2) {
        throw new Error('Solde insuffisant. La création d\'un trajet coûte 2 crédits');
      }
      
      // Get application credit document
      const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
      if (!appCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits de la plateforme');
      }

      // Create carpooling document
      await addDoc(collection(db, 'covoiturages'), {
        ...carpooling,
        driver_id: currentUser.uid,
        ecologique: vehicleData.electrique,
        passagers_id,
        date_creation: serverTimestamp(),
        date_modification: serverTimestamp(),
        statut: 'actif'
      });
      
      // Update user credit (deduct 2 credits)
      await updateDoc(doc(db, 'credit', currentUser.uid), {
        solde: userCreditDoc.data().solde - 2,
        date_modification: serverTimestamp(),
      });
      
      // Update application credit (add 2 credits)
      await updateDoc(doc(db, 'credit', 'application'), {
        Solde: appCreditDoc.data().Solde + 2,
        date_modification: serverTimestamp(),
      });

      setSuccess('Covoiturage créé avec succès');
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
                Créer un voyage
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
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-[#3E920B]" />
                    <span>Adresse de départ</span>
                  </div>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={carpooling.depart_rue}
                      onChange={(e) =>
                        setCarpooling((prev) => ({
                          ...prev,
                          depart_rue: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                      placeholder="Rue"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={carpooling.depart_code_postal}
                      onChange={(e) =>
                        setCarpooling((prev) => ({
                          ...prev,
                          depart_code_postal: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                      placeholder="Code postal"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={carpooling.depart_ville}
                      onChange={(e) =>
                        setCarpooling((prev) => ({
                          ...prev,
                          depart_ville: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                      placeholder="Ville"
                    />
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-[#3E920B]" />
                    <span>Adresse d'arrivée</span>
                  </div>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={carpooling.arrivee_rue}
                      onChange={(e) =>
                        setCarpooling((prev) => ({
                          ...prev,
                          arrivee_rue: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                      placeholder="Rue"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={carpooling.arrivee_code_postal}
                      onChange={(e) =>
                        setCarpooling((prev) => ({
                          ...prev,
                          arrivee_code_postal: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                      placeholder="Code postal"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={carpooling.arrivee_ville}
                      onChange={(e) =>
                        setCarpooling((prev) => ({
                          ...prev,
                          arrivee_ville: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                      placeholder="Ville"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-[#3E920B]" />
                    <span>Date de départ</span>
                  </div>
                </label>
                <input
                  type="date"
                  value={carpooling.date_depart}
                  onChange={(e) =>
                    setCarpooling((prev) => ({
                      ...prev,
                      date_depart: e.target.value,
                    }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-[#3E920B]" />
                    <span>Heure de départ</span>
                  </div>
                </label>
                <input
                  type="time"
                  value={carpooling.heure_depart}
                  onChange={(e) =>
                    setCarpooling((prev) => ({
                      ...prev,
                      heure_depart: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-[#3E920B]" />
                    <span>Date d'arrivée estimée</span>
                  </div>
                </label>
                <input
                  type="date"
                  value={carpooling.date_arrivee}
                  onChange={(e) =>
                    setCarpooling((prev) => ({
                      ...prev,
                      date_arrivee: e.target.value,
                    }))
                  }
                  min={carpooling.date_depart || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-[#3E920B]" />
                    <span>Heure d'arrivée estimée</span>
                  </div>
                </label>
                <input
                  type="time"
                  value={carpooling.heure_arrivee}
                  onChange={(e) =>
                    setCarpooling((prev) => ({
                      ...prev,
                      heure_arrivee: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <Euro className="h-4 w-4 text-[#3E920B]" />
                    <span>Prix en crédits par passager (minimum 1 crédit)</span>
                  </div>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={carpooling.prix}
                  onChange={(e) =>
                    setCarpooling((prev) => ({
                      ...prev,
                      prix: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  placeholder="1"
                />
                <p className="mt-1 text-sm text-gray-500">
                  La plateforme prélève 2 crédits supplémentaire aux voyageur pour les frais de service
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <div className="flex items-center space-x-2">
                    <Car className="h-4 w-4 text-[#3E920B]" />
                    <span>Véhicule</span>
                  </div>
                </label>
                <select
                  value={carpooling.vehicule_plaque}
                  onChange={(e) =>
                    setCarpooling((prev) => ({
                      ...prev,
                      vehicule_plaque: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                >
                  <option value="">Sélectionnez un véhicule</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.plaque} value={vehicle.plaque}>
                      {vehicle.marque} {vehicle.modele} - {vehicle.plaque}
                      {vehicle.electrique ? ' (Écologique)' : ''} ({vehicle.places} places)
                    </option>
                  ))}
                </select>
                {carpooling.vehicule_plaque && (
                  <p className="mt-1 text-sm text-gray-500">
                    Ce véhicule peut accueillir jusqu'à {vehicles.find(v => v.plaque === carpooling.vehicule_plaque)?.places || 0} passagers
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Création...' : 'Créer le covoiturage'}
            </button>
            <p className="mt-2 text-sm text-gray-500 text-center">
              La création d'un trajet coûte 2 crédits de frais de service
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}