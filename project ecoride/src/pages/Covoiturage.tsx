import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import {
  Search,
  Car,
  MapPin,
  Calendar,
  Clock,
  Euro,
  Zap,
  Star,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

interface SearchFilters {
  departVille: string;
  arriveeVille: string;
  dateDepart: string;
  ecologique: boolean;
  prixMax: number;
  dureeMax: number;
  noteMin: number;
}

interface Carpooling {
  id: string;
  driver_id: string;
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
  date_arrivee: string;
  heure_arrivee: string;
  prix: number;
  vehicule_plaque: string;
  ecologique: boolean;
  passagers_id: string[];
  places_totales: number;
}

interface Driver {
  pseudo: string;
  photo_url?: string;
  note?: number;
}

interface Vehicle {
  places: number;
  electrique: boolean;
}

export function Covoiturage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filters, setFilters] = useState<SearchFilters>({
    departVille: '',
    arriveeVille: '',
    dateDepart: '',
    ecologique: false,
    prixMax: 1000,
    dureeMax: 24,
    noteMin: 0,
  });
  const [carpoolings, setCarpoolings] = useState<Carpooling[]>([]);
  const [drivers, setDrivers] = useState<{ [key: string]: Driver }>({});
  const [vehicles, setVehicles] = useState<{ [key: string]: Vehicle }>({});
  const [loading, setLoading] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Récupérer les paramètres de recherche dans l'URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const depart = searchParams.get('depart');
    const arrivee = searchParams.get('arrivee');
    const date = searchParams.get('date');
    const eco = searchParams.get('eco');

    if (depart || arrivee || date || eco) {
      setFilters((prev) => ({
        ...prev,
        departVille: depart || '',
        arriveeVille: arrivee || '',
        dateDepart: date || '',
        ecologique: eco === 'true',
      }));
    }
  }, [location.search]);

  const searchCarpoolings = useCallback(async () => {
    // On ne lance la recherche que si l'utilisateur est authentifié
    if (!currentUserId) return;

    setLoading(true);
    setError('');
    try {
      // Requête de base
      const q = query(
        collection(db, 'covoiturages'),
        where('statut', '==', 'actif'),
        orderBy('date_depart')
      );

      const snapshot = await getDocs(q);
      let results: Carpooling[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Exclure les trajets dont le driver_id correspond à l'utilisateur connecté
        if (data.driver_id !== currentUserId) {
          results.push({ id: doc.id, ...data });
        }
      });

      // Application des filtres
      results = results.filter((carpooling) => {
        const departMatch =
          !filters.departVille ||
          carpooling.depart_ville.toLowerCase().includes(filters.departVille.toLowerCase());
        const arriveeMatch =
          !filters.arriveeVille ||
          carpooling.arrivee_ville.toLowerCase().includes(filters.arriveeVille.toLowerCase());
        const dateMatch = !filters.dateDepart || carpooling.date_depart === filters.dateDepart;
        const prixMatch = !filters.prixMax || carpooling.prix <= filters.prixMax;
        const ecoMatch = !filters.ecologique || carpooling.ecologique;

        return departMatch && arriveeMatch && dateMatch && prixMatch && ecoMatch;
      });

      // Définir la prochaine date disponible si aucun résultat n'est trouvé
      if (results.length === 0 && filters.departVille && filters.arriveeVille) {
        const futureTrips = snapshot.docs
          .map((doc) => doc.data())
          .filter(
            (data) =>
              data.depart_ville.toLowerCase().includes(filters.departVille.toLowerCase()) &&
              data.arrivee_ville.toLowerCase().includes(filters.arriveeVille.toLowerCase()) &&
              new Date(data.date_depart) > new Date()
          )
          .sort(
            (a, b) =>
              new Date(a.date_depart).getTime() - new Date(b.date_depart).getTime()
          );

        if (futureTrips.length > 0) {
          setNextAvailableDate(futureTrips[0].date_depart);
        } else {
          setNextAvailableDate(null);
        }
      }

      // Récupérer les informations des drivers et des véhicules
      const driversData: { [key: string]: Driver } = {};
      const vehiclesData: { [key: string]: Vehicle } = {};

      // Get ratings for each driver
      for (const carpooling of results) {
        if (!driversData[carpooling.driver_id]) {
          const driverDoc = await getDoc(doc(db, 'users', carpooling.driver_id));
          if (driverDoc.exists()) {
            // Get driver ratings
            const ratingsQuery = query(
              collection(db, 'note'),
              where('driver_id', '==', carpooling.driver_id)
            );
            const ratingsSnapshot = await getDocs(ratingsQuery);
            let averageRating = null;
            if (!ratingsSnapshot.empty) {
              const ratings = ratingsSnapshot.docs.map(doc => doc.data().note);
              averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            }
            
            driversData[carpooling.driver_id] = {
              ...(driverDoc.data() as Driver),
              note: averageRating
            };
          }
        }

        if (!vehiclesData[carpooling.vehicule_plaque]) {
          const vehicleDoc = await getDoc(doc(db, 'vehicules', carpooling.vehicule_plaque));
          if (vehicleDoc.exists()) {
            vehiclesData[carpooling.vehicule_plaque] = vehicleDoc.data() as Vehicle;
          }
        }
      }

      setDrivers(driversData);
      setVehicles(vehiclesData);
      
      // Filter results by minimum rating if specified
      const filteredResults = results.filter(carpooling => {
        const driverRating = driversData[carpooling.driver_id]?.note;
        return filters.noteMin === 0 || (driverRating && driverRating >= filters.noteMin);
      });
      
      setCarpoolings(filteredResults);
    } catch (err) {
      setError('Erreur lors de la recherche des covoiturages');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, currentUserId]);

  useEffect(() => {
    searchCarpoolings();
  }, [searchCarpoolings]);

  const calculatePlacesRestantes = (carpooling: Carpooling) => {
    const vehicle = vehicles[carpooling.vehicule_plaque];
    if (!vehicle) return 0;
    const passengersCount = Array.isArray(carpooling.passagers_id)
      ? carpooling.passagers_id.length
      : 0;
    return vehicle.places - passengersCount;
  };

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-7xl mx-auto">
        {/* Section de recherche */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-[#3E920B] w-5 h-5" />
              <input
                type="text"
                placeholder="Ville de départ"
                value={filters.departVille}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, departVille: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-[#3E920B] w-5 h-5" />
              <input
                type="text"
                placeholder="Ville d'arrivée"
                value={filters.arriveeVille}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, arriveeVille: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 text-[#3E920B] w-5 h-5" />
              <input
                type="date"
                value={filters.dateDepart}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, dateDepart: e.target.value }))
                }
                min={new Date().toISOString().split('T')[0]}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
            <button
              onClick={searchCarpoolings}
              className="bg-[#3E920B] text-white px-6 py-2 rounded-lg hover:bg-[#A7DE65] transition-colors flex items-center justify-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>Rechercher</span>
            </button>
          </div>

          {/* Filtres */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.ecologique}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, ecologique: e.target.checked }))
                }
                className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
              />
              <span className="text-sm">Voyage écologique</span>
            </label>
            <div>
              <label className="text-sm text-gray-600">Prix maximum</label>
              <input
                type="number"
                placeholder="Prix en crédits"
                value={filters.prixMax}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    prixMax: parseInt(e.target.value),
                  }))
                }
                min="0"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Durée maximum (heures)</label>
              <input
                type="number"
                value={filters.dureeMax}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    dureeMax: parseInt(e.target.value),
                  }))
                }
                min="1"
                max="24"
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Note minimale</label>
              <select
                value={filters.noteMin}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    noteMin: parseInt(e.target.value),
                  }))
                }
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              >
                <option value="0">Toutes les notes</option>
                <option value="3">3 étoiles et +</option>
                <option value="4">4 étoiles et +</option>
                <option value="5">5 étoiles</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section des résultats */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 text-[#3E920B] animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        ) : carpoolings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-2">
              Aucun covoiturage disponible pour ces critères
            </p>
            {nextAvailableDate && (
              <p className="text-[#3E920B]">
                Prochain trajet disponible le{' '}
                {new Date(nextAvailableDate).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {carpoolings.map((carpooling) => {
              const driver = drivers[carpooling.driver_id];
              const placesRestantes = calculatePlacesRestantes(carpooling);

              return (
                <div
                  key={carpooling.id}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                        {driver?.photo_url ? (
                          <img
                            src={driver.photo_url}
                            alt={driver.pseudo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-xl font-bold">
                            {driver?.pseudo?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{driver?.pseudo}</h3>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">
                            {driver?.note ? `${driver.note.toFixed(1)}/5` : 'Nouveau'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Car className="w-5 h-5 text-[#3E920B]" />
                      <span className="font-medium">
                        {placesRestantes === 0 ? (
                          <span className="text-red-600 font-semibold">COMPLET</span>
                        ) : (
                          `${placesRestantes} place${placesRestantes > 1 ? 's' : ''} restante${placesRestantes > 1 ? 's' : ''}`
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-[#3E920B]" />
                      <span className="font-semibold">
                        {new Date(carpooling.date_depart).toLocaleDateString()}
                      </span>
                      <Clock className="w-5 h-5 text-[#3E920B] ml-2" />
                      <span>{carpooling.heure_depart}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-5 h-5 text-[#3E920B] mt-1" />
                        <div>
                          <p className="text-sm font-medium">Départ</p>
                          <p className="text-sm text-gray-600">
                            {carpooling.depart_ville}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <MapPin className="w-5 h-5 text-[#3E920B] mt-1" />
                        <div>
                          <p className="text-sm font-medium">Arrivée</p>
                          <p className="text-sm text-gray-600">
                            {carpooling.arrivee_ville}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      <Euro className="w-5 h-5 text-[#3E920B]" />
                      <span className="font-bold text-lg">
                        {carpooling.prix} crédits
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {carpooling.ecologique && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-[#A7DE65]/20 text-[#3E920B] rounded-full text-sm">
                          <Zap className="w-4 h-4" />
                          <span>Écologique</span>
                        </div>
                      )}
                      {placesRestantes === 0 && (
                        <div className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-sm">
                          Complet
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/covoiturage/${carpooling.id}`)}
                      className="flex items-center space-x-1 text-[#3E920B] hover:text-[#A7DE65] transition-colors"
                    >
                      <span>Détail</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
