import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  MapPin,
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { syncCovoiturageTermine } from '../lib/sync';

interface Passenger {
  id: string;
  pseudo: string;
  photo_url?: string;
}

interface Vehicle {
  marque: string;
  modele: string;
  couleur: string;
  plaque: string;
}

export function Demarrer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [carpooling, setCarpooling] = useState<any>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDriver, setIsDriver] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!id) {
          setError('Identifiant du voyage manquant');
          return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigate('/connexion');
          return;
        }

        // Get carpooling data
        const carpoolingDoc = await getDoc(doc(db, 'covoiturages', id));
        if (!carpoolingDoc.exists()) {
          setError('Ce voyage n\'existe plus');
          return;
        }

        const carpoolingData = carpoolingDoc.data();
        
        // Check if current user is the driver
        if (carpoolingData.driver_id !== currentUser.uid) {
          setError('Vous n\'êtes pas le conducteur de ce voyage');
          return;
        }

        setIsDriver(true);
        setCarpooling(carpoolingData);

        // Get vehicle data
        const vehicleDoc = await getDoc(doc(db, 'vehicules', carpoolingData.vehicule_plaque));
        if (vehicleDoc.exists()) {
          setVehicle(vehicleDoc.data() as Vehicle);
        }

        // Get passengers data
        if (carpoolingData.passagers_id && carpoolingData.passagers_id.length > 0) {
          const passengersList: Passenger[] = [];
          for (const passengerId of carpoolingData.passagers_id) {
            const passengerDoc = await getDoc(doc(db, 'users', passengerId));
            if (passengerDoc.exists()) {
              const passengerData = passengerDoc.data();
              passengersList.push({
                id: passengerId,
                pseudo: passengerData.pseudo,
                photo_url: passengerData.photo_url,
              });
            }
          }
          setPassengers(passengersList);
        }
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate]);

  const handleStartTrip = async () => {
    try {
      // Récupérer les données complètes du covoiturage
      const carpoolingRef = doc(db, 'covoiturages', id!);
      const carpoolingDoc = await getDoc(carpoolingRef);
      if (!carpoolingDoc.exists()) {
        throw new Error('Covoiturage non trouvé');
      }

      const carpoolingData = {
        ...carpoolingDoc.data(),
        statut: 'en_cours'
      };

      // Synchroniser avec Firestore et Supabase
      await syncCovoiturageTermine(id!, carpoolingData);

      navigate('/monespace');
    } catch (err) {
      setError('Erreur lors du démarrage du voyage');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 text-[#3E920B] animate-spin" />
        </div>
      </main>
    );
  }

  if (error || !carpooling || !vehicle) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error || 'Données non disponibles'}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/monespace')}
            className="mt-4 flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Retour à mon espace
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/monespace')}
          className="flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors mb-6"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Retour à mon espace
        </button>

        {/* Trip Info Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-[#333333] mb-6">
            Démarrer le voyage
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-5 h-5 text-[#3E920B]" />
                  <span className="font-semibold">
                    {new Date(carpooling.date_depart).toLocaleDateString()}
                  </span>
                  <Clock className="w-5 h-5 text-[#3E920B] ml-2" />
                  <span>{carpooling.heure_depart}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-5 h-5 text-[#3E920B] mt-1" />
                  <div>
                    <p className="font-medium">Départ</p>
                    <p className="text-gray-600">{carpooling.depart_rue}</p>
                    <p className="text-gray-600">
                      {carpooling.depart_code_postal} {carpooling.depart_ville}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <MapPin className="w-5 h-5 text-[#3E920B] mt-1" />
                  <div>
                    <p className="font-medium">Arrivée</p>
                    <p className="text-gray-600">{carpooling.arrivee_rue}</p>
                    <p className="text-gray-600">
                      {carpooling.arrivee_code_postal} {carpooling.arrivee_ville}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Véhicule</h3>
                <div className="flex items-center space-x-2">
                  <Car className="w-5 h-5 text-[#3E920B]" />
                  <p className="text-gray-600">
                    {vehicle.marque} {vehicle.modele} • {vehicle.couleur}
                  </p>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Plaque: {vehicle.plaque}
                </p>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-5 h-5 text-[#3E920B]" />
                  <h3 className="font-medium">Passagers ({passengers.length})</h3>
                </div>
                <div className="space-y-2">
                  {passengers.length === 0 ? (
                    <p className="text-gray-500">
                      Aucun passager inscrit pour ce voyage
                    </p>
                  ) : (
                    passengers.map((passenger) => (
                      <div
                        key={passenger.id}
                        className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                          {passenger.photo_url ? (
                            <img
                              src={passenger.photo_url}
                              alt={passenger.pseudo}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-sm font-bold">
                              {passenger.pseudo.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="font-medium">{passenger.pseudo}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={handleStartTrip}
              className="px-8 py-3 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors"
            >
              Démarrer le voyage
            </button>
            <p className="mt-2 text-sm text-gray-500">
              En démarrant le voyage, vous confirmez que tous les passagers sont présents
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}