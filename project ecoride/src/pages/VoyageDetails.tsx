import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { sendCancellationEmail } from '../lib/email';
import { syncCovoiturageTermine, syncTransaction } from '../lib/sync';
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
  Users,
  AlertTriangle,
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

export function VoyageDetails() {
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
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [isDriver, setIsDriver] = useState(false);
  const [isPassenger, setIsPassenger] = useState(false);
  const [passengerRatings, setPassengerRatings] = useState<{ [key: string]: number | null }>({});
  const [cancelModal, setCancelModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userCredit, setUserCredit] = useState<number>(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!id) {
          setError('Identifiant du covoiturage manquant');
          return;
        }

        // Récupération des données du covoiturage
        const carpoolingDoc = await getDoc(doc(db, 'covoiturages', id));
        if (!carpoolingDoc.exists()) {
          setError('Ce covoiturage n\'existe plus');
          return;
        }
        const carpoolingData = carpoolingDoc.data();
        setCarpooling(carpoolingData);

        // Vérification si l'utilisateur est conducteur ou passager
        const currentUser = auth.currentUser;
        if (currentUser) {
          if (carpoolingData.driver_id === currentUser.uid) {
            setIsDriver(true);
          } else if (carpoolingData.passagers_id?.includes(currentUser.uid)) {
            setIsPassenger(true);
          }

          // Récupération du crédit utilisateur
          const userCreditDoc = await getDoc(doc(db, 'credit', currentUser.uid));
          if (userCreditDoc.exists()) {
            setUserCredit(userCreditDoc.data().solde);
          }

          // Si conducteur, récupération des données des passagers
          if (carpoolingData.passagers_id && carpoolingData.passagers_id.length > 0) {
            const passengersList: Passenger[] = [];
            const ratings: { [key: string]: number | null } = {};

            for (const passengerId of carpoolingData.passagers_id) {
              const passengerDoc = await getDoc(doc(db, 'users', passengerId));
              if (passengerDoc.exists()) {
                const passengerData = passengerDoc.data();

                // Récupération des notes du passager
                const ratingsQuery = query(
                  collection(db, 'note'),
                  where('user_id', '==', passengerId)
                );
                const ratingsSnapshot = await getDocs(ratingsQuery);
                if (!ratingsSnapshot.empty) {
                  const passengerRatings = ratingsSnapshot.docs.map(doc => doc.data().note);
                  ratings[passengerId] = passengerRatings.reduce((a, b) => a + b, 0) / passengerRatings.length;
                } else {
                  ratings[passengerId] = null;
                }

                passengersList.push({
                  id: passengerId,
                  pseudo: passengerData.pseudo,
                  photo_url: passengerData.photo_url,
                });
              }
            }
            setPassengers(passengersList);
            setPassengerRatings(ratings);
          }
        }

        // Récupération des données du conducteur
        const driverDoc = await getDoc(doc(db, 'users', carpoolingData.driver_id));
        if (driverDoc.exists()) {
          setDriver(driverDoc.data() as Driver);
        }

        // Récupération des données du véhicule
        const vehicleDoc = await getDoc(doc(db, 'vehicules', carpoolingData.vehicule_plaque));
        if (vehicleDoc.exists()) {
          setVehicle(vehicleDoc.data() as Vehicle);
        }

        // Récupération des avis
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

  const handleCancelTrip = async () => {
    setIsLoading(true);
    try {
      // Récupérer les données complètes du covoiturage avant annulation
      const carpoolingRef = doc(db, 'covoiturages', id!);
      const carpoolingDoc = await getDoc(carpoolingRef);
      if (!carpoolingDoc.exists()) {
        throw new Error('Covoiturage non trouvé');
      }
      const carpoolingData = {
        ...carpoolingDoc.data(),
        statut: 'inactif',
        passagers_id: []
      };

      // Calcul du remboursement total par passager (prix du voyage + frais de service)
      const refundAmount = carpooling.prix + 2;
      const totalPassengers = carpooling.passagers_id?.length || 0;

      // Récupérer le crédit de l'application
      const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
      if (!appCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits de la plateforme');
      }

      // Récupérer le crédit en attente
      const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
      if (!waitingCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits en attente');
      }

      // Calcul de la pénalité pour le conducteur (prix du voyage * nombre de passagers)
      const driverPenalty = carpooling.prix * totalPassengers;

      // Mise à jour du crédit de l'application (déduction des frais de service)
      await updateDoc(doc(db, 'credit', 'application'), {
        Solde: appCreditDoc.data().Solde - (2 * totalPassengers),
        date_modification: serverTimestamp(),
      });

      // Mise à jour du crédit en attente (déduction du prix du voyage)
      await updateDoc(doc(db, 'credit', 'Attente'), {
        Solde: waitingCreditDoc.data().Solde - driverPenalty,
        date_modification: serverTimestamp(),
      });

      // Remboursement de chaque passager
      for (const passengerId of carpooling.passagers_id || []) {
        const passengerCreditDoc = await getDoc(doc(db, 'credit', passengerId));
        const passengerDoc = await getDoc(doc(db, 'users', passengerId));
        if (passengerCreditDoc.exists()) {
          await updateDoc(doc(db, 'credit', passengerId), {
            solde: passengerCreditDoc.data().solde + refundAmount,
            date_modification: serverTimestamp(),
          });
          // Envoi de l'email de notification
          if (passengerDoc.exists()) {
            const passengerData = passengerDoc.data();
            try {
              await sendCancellationEmail(
                passengerData.adresse_mail,
                passengerData.pseudo,
                new Date(carpooling.date_depart).toLocaleDateString(),
                carpooling.depart_ville,
                carpooling.arrivee_ville,
                refundAmount
              );
            } catch (emailError) {
              console.error('Error sending email to passenger:', emailError);
              // On continue même en cas d'erreur d'email
            }
          }
        }
      }

      // Synchroniser avec Firestore et Supabase
      await syncCovoiturageTermine(id!, carpoolingData);

      // Synchroniser les transactions de remboursement
      for (const passengerId of carpooling.passagers_id || []) {
        await syncTransaction({
          utilisateur_id: passengerId,
          montant: refundAmount,
          type: 'remboursement',
          description: 'Remboursement suite à l\'annulation du covoiturage',
          covoiturage_id: id!
        });
      }

      navigate('/monespace');
    } catch (err) {
      setError('Erreur lors de l\'annulation du voyage');
      console.error(err);
    } finally {
      setIsLoading(false);
      setCancelModal(false);
    }
  };

  const handlePassengerCancellation = async () => {
    setIsLoading(true);
    try {
      // Récupérer les données complètes du covoiturage avant modification
      const carpoolingRef = doc(db, 'covoiturages', id!);
      const carpoolingDoc = await getDoc(carpoolingRef);
      if (!carpoolingDoc.exists()) {
        throw new Error('Covoiturage non trouvé');
      }
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Récupérer le crédit de l'application
      const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
      if (!appCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits de la plateforme');
      }

      // Récupérer le crédit en attente
      const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
      if (!waitingCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits en attente');
      }

      // Mise à jour du crédit du passager (ajout du prix du voyage + frais de service)
      await updateDoc(doc(db, 'credit', currentUser.uid), {
        solde: userCredit + carpooling.prix + 2,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du crédit de l'application (déduction de 2 crédits)
      await updateDoc(doc(db, 'credit', 'application'), {
        Solde: appCreditDoc.data().Solde - 2,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du crédit en attente (déduction du prix du voyage)
      await updateDoc(doc(db, 'credit', 'Attente'), {
        Solde: waitingCreditDoc.data().Solde - carpooling.prix,
        date_modification: serverTimestamp(),
      });

      // Retrait du passager du covoiturage
      const updatedPassengers = carpooling.passagers_id.filter((pId: string) => pId !== currentUser.uid);
      const updatedCarpoolingData = {
        ...carpoolingDoc.data(),
        passagers_id: updatedPassengers
      };

      // Synchroniser avec Firestore et Supabase
      await syncCovoiturageTermine(id!, updatedCarpoolingData);

      // Synchroniser la transaction de remboursement
      await syncTransaction({
        utilisateur_id: currentUser.uid,
        montant: carpooling.prix + 2,
        type: 'remboursement',
        description: 'Remboursement suite à l\'annulation de la réservation',
        covoiturage_id: id!
      });

      navigate('/monespace');
    } catch (err) {
      setError('Erreur lors de l\'annulation de la réservation');
      console.error(err);
    } finally {
      setIsLoading(false);
      setCancelModal(false);
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
              <div className="text-2xl font-bold text-[#3E920B]">{carpooling.prix} crédits</div>
              <div className="text-gray-600">par passager</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
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

            <div className="space-y-4">
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
          </div>
        </div>

        {/* Section Passagers */}
        {isDriver && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-[#3E920B]" />
              <h2 className="text-xl font-semibold">
                Passagers ({passengers.length})
              </h2>
            </div>
            <div className="space-y-4">
              {passengers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Aucun passager inscrit pour le moment
                </p>
              ) : (
                passengers.map((passenger) => (
                  <div key={passenger.id} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {passenger.photo_url ? (
                        <img
                          src={passenger.photo_url}
                          alt={passenger.pseudo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-lg font-bold">
                          {passenger.pseudo.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{passenger.pseudo}</span>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span>{passengerRatings[passenger.id] ? `${passengerRatings[passenger.id]?.toFixed(1)}/5` : 'Nouveau'}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Bouton d'annulation pour le conducteur */}
        {isDriver && carpooling.statut === 'actif' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <div className="text-center">
              <button
                onClick={() => setCancelModal(true)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Annuler ce voyage
              </button>
              <p className="mt-2 text-sm text-gray-500">
                En annulant ce voyage, vous perdrez {carpooling.prix} crédits par passager inscrit
              </p>
            </div>
          </div>
        )}

        {/* Bouton d'annulation pour le passager */}
        {isPassenger && carpooling.statut === 'actif' && (
          <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <div className="text-center">
              <button
                onClick={() => setCancelModal(true)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Annuler ma réservation
              </button>
              <p className="mt-2 text-sm text-gray-500">
                En annulant votre réservation, vous serez remboursé de {carpooling.prix + 2} crédits
              </p>
            </div>
          </div>
        )}

        {/* Modal de confirmation d'annulation */}
        {cancelModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <h3 className="text-xl font-semibold text-[#333333]">
                  {isDriver ? "Confirmer l'annulation" : "Annuler ma réservation"}
                </h3>
              </div>
              <div className="space-y-4 mb-6">
                <p className="text-gray-600">
                  {isDriver 
                    ? "Êtes-vous sûr de vouloir annuler ce voyage ? Cette action est irréversible."
                    : "Êtes-vous sûr de vouloir annuler votre réservation ? Cette action est irréversible."}
                </p>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="font-medium">Conséquences de l'annulation :</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {isDriver ? (
                      <>
                        <li>• Vous perdrez {carpooling.prix} crédits par passager inscrit</li>
                        <li>• Les passagers seront remboursés ({carpooling.prix + 2} crédits chacun)</li>
                        <li>• Le voyage ne sera plus visible dans les recherches</li>
                      </>
                    ) : (
                      <>
                        <li>• Vous serez remboursé de {carpooling.prix + 2} crédits</li>
                        <li>• Votre place sera libérée pour d'autres voyageurs</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setCancelModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={isDriver ? handleCancelTrip : handlePassengerCancellation}
                  disabled={isLoading}
                  className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Annulation...' : isDriver ? "Confirmer l'annulation" : 'Annuler ma réservation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Avis */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <h2 className="text-xl font-semibold">
              Avis ({reviews.length})
            </h2>
          </div>
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
        </div>

      </div>
    </main>
  );
}