import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  History,
  AlertCircle,
  Car,
  MapPin,
  Calendar,
  Clock,
  Euro,
  Zap,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { syncCovoiturageTermine, syncTransaction } from '../lib/sync';

interface Vehicle {
  plaque: string;
  marque: string;
  modele: string;
  couleur: string;
  electrique: boolean;
}

interface Carpooling {
  id: string;
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
  statut: string;
  driver_id: string;
  passagers_id?: string[];
}

interface HistoricCarpooling {
  covoiturage_id: string;
  chauffeur_id: string;
  passagers_ids: string[];
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  date_arrivee: string;
  prix: number;
  vehicule_plaque: string;
  ecologique: boolean;
  statut: string;
  donnees_source: any;
}

export function Historique() {
  const navigate = useNavigate();
  const [carpoolings, setCarpoolings] = useState<Carpooling[]>([]);
  const [vehicles, setVehicles] = useState<{ [key: string]: Vehicle }>({});
  const [drivers, setDrivers] = useState<{ [key: string]: string }>({});
  const [passengerTrips, setPassengerTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const processHistoricTrips = async (historicCarpoolings: any[]) => {
    const passengerTripsList = [];
    
    for (const trip of historicCarpoolings) {
      const driverDoc = await getDoc(doc(db, 'users', trip.chauffeur_id));
      const driverData = driverDoc.exists() ? driverDoc.data() : null;
      
      passengerTripsList.push({
        id: trip.covoiturage_id,
        ...trip.donnees_source,
        driver: driverData,
        vehicle: {
          marque: trip.donnees_source.vehicule_marque,
          modele: trip.donnees_source.vehicule_modele,
          couleur: trip.donnees_source.vehicule_couleur,
          electrique: trip.ecologique
        }
      });
    }
    
    return passengerTripsList;
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        navigate('/connexion');
        return;
      }
      
      try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Récupérer l'historique complet des covoiturages depuis Supabase
        const { data: historicCarpoolings, error: supabaseError } = await supabase
          .from('historique_covoiturages')
          .select('*')
          .or(`chauffeur_id.eq.${firebaseUser.uid},passagers_ids.cs.{${firebaseUser.uid}}`)
          .order('date_depart', { ascending: false });

        if (supabaseError) throw supabaseError;

        // Query pour les covoiturages où l'utilisateur est chauffeur
        const driverQuery = query(
          collection(db, 'covoiturages'),
          where('driver_id', '==', firebaseUser.uid),
          where('statut', 'in', ['inactif', 'terminé']),
          orderBy('date_depart', 'desc')
        );

        // Query pour les covoiturages où l'utilisateur est passager
        const passengerQuery = query(
          collection(db, 'covoiturages'),
          where('passagers_id', 'array-contains', firebaseUser.uid),
          where('statut', 'in', ['inactif', 'terminé']),
          orderBy('date_depart', 'desc')
        );

        const [driverSnapshot, passengerSnapshot] = await Promise.all([
          getDocs(driverQuery),
          getDocs(passengerQuery)
        ]);

        const carpoolingsList: Carpooling[] = [];
        const passengerTripsList: any[] = [];
        const vehicleIds = new Set<string>();
        const driverIds = new Set<string>();

        // Traitement des trajets actifs en tant que chauffeur
        for (const document of driverSnapshot.docs) {
          const data = document.data();
          carpoolingsList.push({ id: document.id, ...data } as Carpooling);
          vehicleIds.add(data.vehicule_plaque);
          driverIds.add(data.driver_id);

          // Synchroniser avec Supabase si ce n'est pas déjà fait
          const carpoolingData = {
            ...data,
            id: document.id
          };
          await syncCovoiturageTermine(document.id, carpoolingData);

          // Synchroniser la transaction si nécessaire
          if (data.statut === 'terminé') {
            await syncTransaction({
              utilisateur_id: data.driver_id,
              montant: data.prix * (data.passagers_id?.length || 0),
              type: 'paiement_trajet',
              description: `Paiement du trajet ${data.depart_ville} → ${data.arrivee_ville}`,
              covoiturage_id: document.id
            });
          }
        }

        // Traitement des trajets actifs en tant que passager
        for (const docSnap of passengerSnapshot.docs) {
          const data = docSnap.data();
          // Récupération des informations du chauffeur
          const driverDoc = await getDoc(doc(db, 'users', data.driver_id));
          const driverData = driverDoc.exists() ? driverDoc.data() : null;
          
          // Récupération des informations du véhicule
          const vehicleDoc = await getDoc(doc(db, 'vehicules', data.vehicule_plaque));
          const vehicleData = vehicleDoc.exists() ? vehicleDoc.data() : null;
          
          passengerTripsList.push({
            id: docSnap.id,
            ...data,
            driver: driverData,
            vehicle: vehicleData
          });

          // Synchroniser avec Supabase si ce n'est pas déjà fait
          await syncCovoiturageTermine(docSnap.id, data);
        }

        // Traiter les trajets historiques
        if (historicCarpoolings) {
          const passengerHistoricTrips = historicCarpoolings.filter(
            trip => trip.passagers_ids.includes(firebaseUser.uid)
          );
          const historicPassengerTrips = await processHistoricTrips(passengerHistoricTrips);
          passengerTripsList.push(...historicPassengerTrips);

          // Ajouter les trajets historiques où l'utilisateur est chauffeur
          const driverHistoricTrips = historicCarpoolings.filter(
            trip => trip.chauffeur_id === firebaseUser.uid
          ).map(trip => ({
            id: trip.covoiturage_id,
            driver_id: trip.chauffeur_id,
            passagers_id: trip.passagers_ids,
            date_depart: trip.date_depart,
            ecologique: trip.ecologique,
            statut: trip.statut,
            ...trip.donnees_source
          }));
          carpoolingsList.push(...driverHistoricTrips);
        }

        // Trier et dédupliquer les trajets
        const uniqueTrips = new Map();
        carpoolingsList.forEach(trip => uniqueTrips.set(trip.id, trip));
        const uniquePassengerTrips = new Map();
        passengerTripsList.forEach(trip => uniquePassengerTrips.set(trip.id, trip));

        setCarpoolings(Array.from(uniqueTrips.values()));
        setPassengerTrips(Array.from(uniquePassengerTrips.values()));

        // Récupération des données des véhicules
        const vehiclesData: { [key: string]: Vehicle } = {};
        for (const plaque of vehicleIds) {
          const vehicleDoc = await getDoc(doc(db, 'vehicules', plaque));
          if (vehicleDoc.exists()) {
            vehiclesData[plaque] = vehicleDoc.data() as Vehicle;
          }
        }
        setVehicles(vehiclesData);

        // Récupération des données des chauffeurs
        const driversData: { [key: string]: string } = {};
        for (const driverId of driverIds) {
          const driverDoc = await getDoc(doc(db, 'users', driverId));
          if (driverDoc.exists()) {
            driversData[driverId] = driverDoc.data().pseudo;
          }
        }
        setDrivers(driversData);
      } catch (err) {
        setError('Erreur lors du chargement de l\'historique');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

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
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center space-x-3 mb-6">
            <History className="h-6 w-6 text-[#3E920B]" />
            <h1 className="text-3xl font-bold text-[#333333]">
              Historique des covoiturages
              <span className="text-lg font-normal text-gray-600 ml-2">
                ({carpoolings.length + passengerTrips.length} voyages)
              </span>
            </h1>
          </div>

          <div className="space-y-4">
            {carpoolings.length === 0 && passengerTrips.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                Aucun covoiturage dans l'historique
              </p>
            ) : (
              [...carpoolings, ...passengerTrips]
              .sort((a, b) => new Date(b.date_depart).getTime() - new Date(a.date_depart).getTime())
              .map((trip) => {
                const isPassengerTrip = 'driver' in trip;
                const vehicle = isPassengerTrip ? trip.vehicle : vehicles[trip.vehicule_plaque];
                
                return(
                  <div
                    key={trip.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-5 w-5 text-[#3E920B]" />
                        <span className="font-semibold">
                          {new Date(trip.date_depart).toLocaleDateString()}
                        </span>
                        <Clock className="h-5 w-5 text-[#3E920B] ml-2" />
                        <span>{trip.heure_depart}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-5 w-5 text-[#3E920B] mt-1" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Départ</p>
                            <p className="text-sm text-gray-600">
                              {trip.depart_rue}
                            </p>
                            <p className="text-sm text-gray-600">
                              {trip.depart_code_postal} {trip.depart_ville}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-5 w-5 text-[#3E920B] mt-1" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Arrivée</p>
                            <p className="text-sm text-gray-600">
                              {trip.arrivee_rue}
                            </p>
                            <p className="text-sm text-gray-600">
                              {trip.arrivee_code_postal} {trip.arrivee_ville}
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
                          <span className="font-semibold">{trip.prix} crédits</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Car className="h-5 w-5 text-[#3E920B]" />
                          <span className="font-medium">
                            {(trip.passagers_id?.length || 0)}/{vehicle?.places || 0} places
                          </span>
                        </div>
                        {isPassengerTrip ? (
                          <div className="px-3 py-1 bg-[#3E920B] text-white text-sm rounded-full">
                            Passager
                          </div>
                        ) : (
                          <div className="px-3 py-1 bg-[#3E920B] text-white text-sm rounded-full">
                            Chauffeur
                          </div>
                        )}
                        {trip.ecologique && (
                          <div className="px-3 py-1 bg-[#A7DE65] text-[#3E920B] text-sm rounded-full flex items-center space-x-1">
                            <Zap className="h-4 w-4" />
                            <span>Écologique</span>
                          </div>
                        )}
                        {trip.statut === 'inactif' && (
                          <div className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                            Désactivé
                          </div>
                        )}
                        {trip.statut === 'terminé' && (
                          <div className="px-3 py-1 bg-green-100 text-green-600 text-sm rounded-full">
                            Terminé
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
      </div>
    </main>
  );
}