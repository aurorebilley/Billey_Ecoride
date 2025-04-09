import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  Star,
  History,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Zap,
  Ban,
  Music,
  Dog,
  Cigarette,
  MapPin,
  Calendar,
  Clock,
  Euro,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { syncCovoiturageTermine } from '../lib/sync';

interface User {
  pseudo: string;
  adresse_mail: string;
  photo_url?: string;
  roles: string[];
}

interface Credit {
  solde: number;
}

interface Vehicle {
  plaque: string;
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
  passagers_id?: string[];
}

export function MonEspace() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverCarpoolings, setDriverCarpoolings] = useState<any[]>([]);
  const [passengerCarpoolings, setPassengerCarpoolings] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [deleteCarpoolingModal, setDeleteCarpoolingModal] = useState<{ isOpen: boolean; id: string }>({
    isOpen: false,
    id: ''
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; plaque: string }>({
    isOpen: false,
    plaque: ''
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/connexion');
        return;
      }

      try {
        // Get user ratings
        const ratingsQuery = query(
          collection(db, 'note'),
          where('driver_id', '==', firebaseUser.uid)
        );
        const ratingsSnapshot = await getDocs(ratingsQuery);
        if (!ratingsSnapshot.empty) {
          const ratings = ratingsSnapshot.docs.map(doc => doc.data().note);
          setReviews(ratings);
          const average = ratings.reduce((sum, note) => sum + note, 0) / ratings.length;
          setAverageRating(average);
        }

        // Get user data
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          setError('Profil utilisateur non trouvé');
          return;
        }
        setUser(userDoc.data() as User);

        // Get credit data
        const creditDoc = await getDoc(doc(db, 'credit', firebaseUser.uid));
        if (creditDoc.exists()) {
          setCredit(creditDoc.data() as Credit);
        }

        // Get user's vehicles if they are a driver
        if (userDoc.data().roles?.includes('chauffeur')) {
          const q = query(
            collection(db, 'vehicules'),
            where('user_id', '==', firebaseUser.uid)
          );

          const unsubscribeVehicles = onSnapshot(q, (snapshot) => {
            const vehiclesList: Vehicle[] = [];
            snapshot.forEach((docSnapshot) => {
              vehiclesList.push(docSnapshot.data() as Vehicle);
            });
            setVehicles(vehiclesList);
          });

          // Subscribe to driver's upcoming carpoolings
          const activeCarpoolingsQuery = query(
            collection(db, 'covoiturages'),
            where('driver_id', '==', firebaseUser.uid),
            where('statut', 'in', ['actif', 'en_cours'])
          );

          const unsubscribeDriverCarpoolings = onSnapshot(activeCarpoolingsQuery, (snapshot) => {
            const carpoolingsList: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.statut === 'actif' || data.statut === 'en_cours') {
                carpoolingsList.push({ id: doc.id, ...data });
              }
            });
            // Sort by date and time
            setDriverCarpoolings(carpoolingsList.sort((a, b) => 
              a.date_depart.localeCompare(b.date_depart) ||
              a.heure_depart.localeCompare(b.heure_depart)
            ));
          });

          return () => {
            unsubscribeVehicles();
            unsubscribeDriverCarpoolings();
          };
        }

        // Subscribe to passenger's upcoming carpoolings
        const passengerCarpoolingsQuery = query(
          collection(db, 'covoiturages'),
          where('passagers_id', 'array-contains', firebaseUser.uid),
          where('statut', 'in', ['actif', 'en_cours'])
        );

        const unsubscribePassengerCarpoolings = onSnapshot(passengerCarpoolingsQuery, async (snapshot) => {
          const carpoolingsList: any[] = [];
          for (const docSnapshot of snapshot.docs) {
            const data = docSnapshot.data();
            if (data.statut === 'actif' || data.statut === 'en_cours') {
              // Get driver info
              const driverDoc = await getDoc(doc(db, 'users', data.driver_id));
              const driverData = driverDoc.exists() ? driverDoc.data() : null;
              
              // Get vehicle info
              const vehicleDoc = await getDoc(doc(db, 'vehicules', data.vehicule_plaque));
              const vehicleData = vehicleDoc.exists() ? vehicleDoc.data() : null;
              
              carpoolingsList.push({
                id: docSnapshot.id,
                ...data,
                driver: driverData,
                vehicle: vehicleData
              });
            }
          }
          // Sort by date and time
          setPassengerCarpoolings(carpoolingsList.sort((a, b) => 
            a.date_depart.localeCompare(b.date_depart) ||
            a.heure_depart.localeCompare(b.heure_depart)
          ));
        });

        return () => {
          unsubscribePassengerCarpoolings();
        };
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'vehicules', deleteModal.plaque));
      setDeleteModal({ isOpen: false, plaque: '' });
    } catch (err) {
      setError('Erreur lors de la suppression du véhicule');
      console.error(err);
    }
  };

  const openDeleteModal = (plaque: string) => {
    setDeleteModal({ isOpen: true, plaque });
  };

  const openDeleteCarpoolingModal = (id: string) => {
    setDeleteCarpoolingModal({ isOpen: true, id });
  };

  const confirmDeleteCarpooling = async () => {
    try {
      const carpoolingRef = doc(db, 'covoiturages', deleteCarpoolingModal.id);
      const carpoolingDoc = await getDoc(carpoolingRef);
      if (!carpoolingDoc.exists()) {
        throw new Error('Covoiturage non trouvé');
      }

      const carpoolingData = {
        ...carpoolingDoc.data(),
        statut: 'inactif',
        passagers_id: []
      };

      await syncCovoiturageTermine(deleteCarpoolingModal.id, carpoolingData);
      setDeleteCarpoolingModal({ isOpen: false, id: '' });
    } catch (err) {
      setError('Erreur lors de la désactivation du covoiturage');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="text-center">Chargement...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="ml-3 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* User Info Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                {user?.photo_url ? (
                  <img
                    src={user.photo_url}
                    alt={user.pseudo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-2xl font-bold">
                    {user?.pseudo?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
              <h1 className="text-3xl font-bold text-[#333333] mb-2">
                Bonjour {user?.pseudo}
              </h1>
              <div className="flex items-center space-x-2 mb-2">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-gray-600">
                  {averageRating ? `${averageRating.toFixed(1)}/5 (${reviews.length} avis)` : 'Nouveau'}
                </span>
              </div>
              <p className="text-gray-600">{user?.adresse_mail}</p>
              <div className="mt-2 flex flex-wrap gap-2 mb-4">
                {(user?.roles || []).map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1 bg-[#A7DE65]/20 text-[#3E920B] rounded-full text-sm"
                  >
                    {role === 'chauffeur' ? 'Chauffeur' : 'Passager'}
                  </span>
                ))}
              </div>
              <button
                onClick={() => navigate('/historique')}
                className="flex items-center space-x-2 text-[#3E920B] hover:text-[#A7DE65] transition-colors"
              >
                <History className="h-6 w-6" />
              </button>
            </div>
            </div>
            <button
              onClick={() => navigate('/modifier-profil')}
              className="flex items-center space-x-2 text-[#3E920B] hover:text-[#A7DE65] transition-colors"
            >
              <UserCog className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Carpoolings Section */}
        {(user?.roles?.includes('chauffeur') || user?.roles?.includes('passager')) && (
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#333333]">
                Mes voyages à venir
              </h2>
              {user?.roles?.includes('chauffeur') && (
                <button
                  onClick={() => navigate('/creer-voyage')}
                  className="flex items-center space-x-2 text-white bg-[#3E920B] hover:bg-[#A7DE65] px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="h-6 w-6" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {driverCarpoolings.length === 0 && passengerCarpoolings.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Vous n'avez pas encore de voyages prévus
                </p>
              ) : (
                [...driverCarpoolings, ...passengerCarpoolings].sort((a, b) => 
                  a.date_depart.localeCompare(b.date_depart) ||
                  a.heure_depart.localeCompare(b.heure_depart)
                ).map((carpooling) => {
                  const vehicle = vehicles.find(v => v.plaque === carpooling.vehicule_plaque);
                  return (
                    <div
                      onClick={() => navigate(`/voyage/${carpooling.id}`)}
                      key={carpooling.id}
                      className="w-full text-left border border-gray-200 rounded-lg p-4 hover:border-[#3E920B] transition-colors cursor-pointer"
                    >
                      <div className="space-y-3">
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-5 w-5 text-[#3E920B]" />
                              <span className="font-semibold">
                                {new Date(carpooling.date_depart).toLocaleDateString()}
                              </span>
                              <Clock className="h-5 w-5 text-[#3E920B] ml-2" />
                              <span>{carpooling.heure_depart}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start space-x-2">
                            <MapPin className="h-5 w-5 text-[#3E920B] mt-1" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Départ</p>
                              <p className="text-sm text-gray-600">
                                {carpooling.depart_rue}
                              </p>
                              <p className="text-sm text-gray-600">
                                {carpooling.depart_code_postal} {carpooling.depart_ville}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-2">
                            <MapPin className="h-5 w-5 text-[#3E920B] mt-1" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Arrivée</p>
                              <p className="text-sm text-gray-600">
                                {carpooling.arrivee_rue}
                              </p>
                              <p className="text-sm text-gray-600">
                                {carpooling.arrivee_code_postal} {carpooling.arrivee_ville}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          {vehicle && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Car className="h-4 w-4" />
                              <span>
                                {vehicle.marque} {vehicle.modele} • {vehicle.couleur}
                              </span>
                              {vehicle.electrique && (
                                <Zap className="h-4 w-4 text-[#3E920B]" />
                              )}
                            </div>
                          )}                          
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center space-x-1">
                            <Euro className="h-5 w-5 text-[#3E920B]" />
                            <span className="font-semibold">
                              {carpooling.driver_id === auth.currentUser?.uid 
                                ? `${carpooling.prix} crédits` 
                                : `${carpooling.prix + 2} crédits`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Car className="h-5 w-5 text-[#3E920B]" />
                            <span className="font-medium">
                              {(carpooling.passagers_id?.length || 0)}/{vehicle?.places || 0} places
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {carpooling.driver_id === auth.currentUser?.uid && (
                              <div className="px-3 py-1 bg-[#3E920B] text-white text-sm rounded-full">
                                Chauffeur
                              </div>
                            )}
                            {carpooling.driver_id === auth.currentUser?.uid && carpooling.statut === 'actif' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/demarrer/${carpooling.id}`);
                                }}
                                className="px-3 py-1 bg-[#3E920B] text-white text-sm rounded-full hover:bg-[#A7DE65] transition-colors"
                              >
                                Démarrer
                              </button>
                            )}
                            {carpooling.driver_id === auth.currentUser?.uid && carpooling.statut === 'en_cours' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/terminer/${carpooling.id}`);
                                }}
                                className="px-3 py-1 bg-[#3E920B] text-white text-sm rounded-full hover:bg-[#A7DE65] transition-colors"
                              >
                                Terminer
                              </button>
                            )}
                          </div>
                          {carpooling.passagers_id?.includes(auth.currentUser?.uid) && (
                            <div className="px-3 py-1 bg-[#3E920B] text-white text-sm rounded-full">
                              Passager
                            </div>
                          )}
                          {carpooling.ecologique && (
                            <div className="px-3 py-1 bg-[#A7DE65] text-[#3E920B] text-sm rounded-full flex items-center space-x-1">
                              <Zap className="h-4 w-4" />
                              <span>Écologique</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Credits Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            Mes crédits
          </h2>
          <p className="text-3xl font-bold text-[#3E920B]">
            {credit?.solde || 0} crédits
          </p>
        </div>

        {/* Vehicles Section */}
        {user?.roles?.includes('chauffeur') && (
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[#333333]">
                Mes véhicules
              </h2>
              <button
                onClick={() => navigate('/ajouter-vehicule')}
                className="flex items-center space-x-2 text-white bg-[#3E920B] hover:bg-[#A7DE65] px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {vehicles.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Vous n'avez pas encore ajouté de véhicule
                </p>
              ) : (
                vehicles.map((vehicle) => (
                  <div
                    key={vehicle.plaque}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Car className="h-5 w-5 text-[#3E920B]" />
                          <h3 className="font-semibold">
                            {vehicle.marque} {vehicle.modele}
                          </h3>
                          {vehicle.electrique && (
                            <Zap className="h-5 w-5 text-[#3E920B]" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Plaque: {vehicle.plaque}
                        </p>
                        <p className="text-sm text-gray-600">
                          {vehicle.places} places • {vehicle.couleur}
                        </p>
                        <div className="flex space-x-3">
                          {vehicle.preferences.fumeur ? (
                            <Cigarette className="h-4 w-4 text-gray-600" />
                          ) : (
                            <Ban className="h-4 w-4 text-red-500" />
                          )}
                          {vehicle.preferences.animaux && (
                            <Dog className="h-4 w-4 text-gray-600" />
                          )}
                          {vehicle.preferences.musique && (
                            <Music className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            navigate(`/modifier-vehicule/${vehicle.plaque}`)
                          }
                          className="p-2 text-[#3E920B] hover:bg-[#A7DE65]/20 rounded-lg transition-colors"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(vehicle.plaque)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 m-4">
            <h3 className="text-xl font-semibold text-[#333333] mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer ce véhicule ? Cette action est irréversible.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, plaque: '' })}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="w-full sm:w-auto px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Carpooling Confirmation Modal */}
      {deleteCarpoolingModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 m-4">
            <h3 className="text-xl font-semibold text-[#333333] mb-4">
              Confirmer la désactivation
            </h3>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir désactiver ce covoiturage ? Il ne sera plus visible dans les recherches.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setDeleteCarpoolingModal({ isOpen: false, id: '' })}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteCarpooling}
                className="w-full sm:w-auto px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Désactiver
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}