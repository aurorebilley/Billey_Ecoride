import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  MapPin,
  Calendar,
  Clock,
  Euro,
  Zap,
  Star,
  ChevronLeft,
  Loader2,
  Cigarette,
  Dog,
  Music,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

interface Review {
  id: string;
  note: number;
  commentaire: string;
  date: string;
  user_id: string;
  user_pseudo: string;
  user_photo?: string;
}

interface Vehicle {
  marque: string;
  modele: string;
  couleur: string;
  plaque: string;
  places: number;
  electrique: boolean;
  preferences: {
    fumeur: boolean;
    animaux: boolean;
    musique: boolean;
  };
}

interface Driver {
  pseudo: string;
  photo_url?: string;
  preferences?: string[];
}

export function CovoiturageDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [carpooling, setCarpooling] = useState<any>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReviews, setShowReviews] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [isPassenger, setIsPassenger] = useState(false);
  const [userCredit, setUserCredit] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!id) {
          setError('Identifiant du covoiturage manquant');
          return;
        }

        // Get carpooling data
        const carpoolingDoc = await getDoc(doc(db, 'covoiturages', id));
        if (!carpoolingDoc.exists()) {
          setError('Ce covoiturage n\'existe plus');
          return;
        }

        const carpoolingData = carpoolingDoc.data();
        setCarpooling(carpoolingData);

        // Check if current user is the driver or passenger
        const currentUser = auth.currentUser;
        if (currentUser) {
          if (carpoolingData.driver_id === currentUser.uid) {
            setIsDriver(true);
          } else if (carpoolingData.passagers_id?.includes(currentUser.uid)) {
            setIsPassenger(true);
          }
        }

        // Get driver data
        const driverDoc = await getDoc(doc(db, 'users', carpoolingData.driver_id));
        if (driverDoc.exists()) {
          setDriver(driverDoc.data() as Driver);
        }

        // Get vehicle data
        const vehicleDoc = await getDoc(doc(db, 'vehicules', carpoolingData.vehicule_plaque));
        if (vehicleDoc.exists()) {
          setVehicle(vehicleDoc.data() as Vehicle);
        }

        // Get passengers data
        if (carpoolingData.passagers_id?.length > 0) {
          const passengersList: Passenger[] = [];
          for (const passengerId of carpoolingData.passagers_id) {
            const passengerDoc = await getDoc(doc(db, 'users', passengerId));
          }
        }

        // Get reviews
        const reviewsQuery = query(
          collection(db, 'note'),
          where('driver_id', '==', carpoolingData.driver_id)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsList: Review[] = [];
        let totalRating = 0;
        let reviewCount = 0;

        for (const reviewDoc of reviewsSnapshot.docs) {
          const reviewData = reviewDoc.data() as Review;
          const userDoc = await getDoc(doc(db, 'users', reviewData.user_id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            reviewsList.push({
              ...reviewData,
              id: reviewDoc.id,
              user_pseudo: userData.pseudo,
              user_photo: userData.photo_url,
            });
            totalRating += reviewData.note;
            reviewCount++;
          }
        }

        setReviews(reviewsList);
        setAverageRating(reviewCount > 0 ? totalRating / reviewCount : null);
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false); 
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        const creditDoc = await getDoc(doc(db, 'credit', user.uid));
        if (creditDoc.exists()) {
          setUserCredit(creditDoc.data().solde);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleParticipate = async () => {
    try {
      const user = auth.currentUser;
      const totalPrice = carpooling.prix + 2;
      if (!user) {
        navigate('/connexion');
        return;
      }

      if (userCredit < totalPrice) {
        setError('Solde insuffisant pour participer à ce covoiturage');
        return;
      }

      // Get application credit document
      const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
      if (!appCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits de la plateforme');
      }

      // Get waiting credit document
      const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
      if (!waitingCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits en attente');
      }

      // Update carpooling document
      await updateDoc(doc(db, 'covoiturages', id!), {
        passagers_id: arrayUnion(user.uid),
        date_modification: serverTimestamp(),
      });

      // Update passenger credit (deduct total price)
      await updateDoc(doc(db, 'credit', user.uid), {
        solde: userCredit - totalPrice,
        date_modification: serverTimestamp(),
      });

      // Update application credit (add service fee)
      await updateDoc(doc(db, 'credit', 'application'), {
        Solde: appCreditDoc.data().Solde + 2,
        date_modification: serverTimestamp(),
      });

      // Update waiting credit (add trip price)
      await updateDoc(doc(db, 'credit', 'Attente'), {
        Solde: waitingCreditDoc.data().Solde + carpooling.prix,
        date_modification: serverTimestamp(),
      });

      navigate('/monespace');
    } catch (err) {
      setError('Erreur lors de l\'inscription au covoiturage');
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

  if (error || !carpooling || !driver || !vehicle) {
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
            onClick={() => navigate('/covoiturage')}
            className="mt-4 flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Retour aux covoiturages
          </button>
        </div>
      </main>
    );
  }

  const placesRestantes = vehicle.places - (carpooling.passagers_id?.length || 0);

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/covoiturage')}
          className="flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors mb-6"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Retour aux covoiturages
        </button>

        {/* Main Info Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                {driver.photo_url ? (
                  <img
                    src={driver.photo_url}
                    alt={driver.pseudo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-2xl font-bold">
                    {driver.pseudo.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#333333]">{driver.pseudo}</h1>
                <div className="flex items-center space-x-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="text-lg">
                    {averageRating ? `${averageRating.toFixed(1)}/5` : 'Nouveau'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#3E920B]">{carpooling.prix + 2} crédits</div>
              <div className="text-gray-600">
                <div>{carpooling.prix} crédits + 2 crédits de frais de service</div>
              </div>
            </div>
          </div>

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
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-[#3E920B]" />
                  <span className="font-semibold">
                    {new Date(carpooling.date_arrivee).toLocaleDateString()}
                  </span>
                  <Clock className="w-5 h-5 text-[#3E920B] ml-2" />
                  <span>{carpooling.heure_arrivee}</span>
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
              <div className="flex items-center space-x-2">
                <Car className="w-5 h-5 text-[#3E920B]" />
                <span className="font-medium">
                  {placesRestantes} place{placesRestantes > 1 ? 's' : ''} restante{placesRestantes > 1 ? 's' : ''}
                </span>
              </div>

              <div>
                <h3 className="font-medium mb-2">Véhicule</h3>
                <div className="space-y-2">
                  <p className="text-gray-600">
                    {vehicle.marque} {vehicle.modele} • {vehicle.couleur}
                  </p>
                  {vehicle.electrique && (
                    <div className="flex items-center space-x-1 text-[#3E920B]">
                      <Zap className="w-4 h-4" />
                      <span>Véhicule électrique</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Préférences</h3>
                <div className="flex flex-wrap gap-3">
                  {vehicle.preferences.fumeur ? (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full">
                      <Cigarette className="w-4 h-4" />
                      <span className="text-sm">Fumeur accepté</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-red-100 text-red-600 rounded-full">
                      <Ban className="w-4 h-4" />
                      <span className="text-sm">Non fumeur</span>
                    </div>
                  )}
                  {vehicle.preferences.animaux && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full">
                      <Dog className="w-4 h-4" />
                      <span className="text-sm">Animaux acceptés</span>
                    </div>
                  )}
                  {vehicle.preferences.musique && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full">
                      <Music className="w-4 h-4" />
                      <span className="text-sm">Musique</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <button
            onClick={() => setShowReviews(!showReviews)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-400 fill-current" />
              <h2 className="text-xl font-semibold">
                Avis ({reviews.length})
              </h2>
            </div>
            {showReviews ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          {showReviews && (
            <div className="mt-4 space-y-4">
              {reviews.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Pas encore d'avis
                </p>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-100 last:border-0 pb-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {review.user_photo ? (
                          <img
                            src={review.user_photo}
                            alt={review.user_pseudo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-lg font-bold">
                            {review.user_pseudo.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{review.user_pseudo}</span>
                          <div className="flex items-center space-x-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span>{review.note}/5</span>
                          </div>
                        </div>
                        <p className="text-gray-600 mt-1">{review.commentaire}</p>
                        <p className="text-sm text-gray-400 mt-1">
                          {new Date(review.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Participation Button */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {!isAuthenticated ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                {placesRestantes === 0 
                  ? "Ce covoiturage est complet"
                  : "Connectez-vous pour participer à ce covoiturage"
                }
              </p>
              {placesRestantes > 0 && (
                <button
                  onClick={() => navigate('/connexion')}
                  className="bg-[#3E920B] text-white px-6 py-2 rounded-lg hover:bg-[#A7DE65] transition-colors"
                >
                  Se connecter / Créer un compte
                </button>
              )}
            </div>
          ) : placesRestantes === 0 ? (
            <div className="text-center">
              <p className="text-red-600 font-semibold text-lg mb-2">Ce covoiturage est complet</p>
              <p className="text-gray-500">Il n'y a plus de places disponibles pour ce voyage</p>
            </div>
          ) : userCredit < carpooling.prix ? (
            <div className="text-center">
              <p className="text-red-600 mb-2">
                Solde insuffisant ({userCredit} crédits)
              </p>
              <p className="text-gray-600">
                Rechargez votre compte pour participer
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Solde disponible : {userCredit} crédits
              </p>
              <p className="text-sm text-gray-500 mb-4">
                La plateforme prélève 2 crédits supplémentaires pour les frais de service
              </p>
              <p className="text-sm text-gray-500 mb-4">
                La plateforme prélève 2 crédits supplémentaires pour les frais de service
              </p>
              <button
                onClick={() => setConfirmationModal(true)}
                className="bg-[#3E920B] text-white px-6 py-2 rounded-lg hover:bg-[#A7DE65] transition-colors"
              >
                Réserver pour {carpooling.prix + 2} crédits
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-[#333333] mb-4">
              Confirmer la participation
            </h3>
            <p className="text-gray-600 mb-6">
              Voulez-vous vraiment réserver ce covoiturage ? {carpooling.prix} crédits
              + 2 crédits de frais de service seront débités de votre compte.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setConfirmationModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleParticipate}
                className="px-4 py-2 text-white bg-[#3E920B] hover:bg-[#A7DE65] rounded-lg transition-colors"
              >
                Réserver
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}