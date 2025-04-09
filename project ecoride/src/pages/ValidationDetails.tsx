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
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Car,
  MapPin,
  Calendar,
  Clock,
  Star,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { syncLitigeResolu, syncLitigeEnCours, syncAvis } from '../lib/sync';

interface Driver {
  pseudo: string;
  photo_url?: string;
}

interface Carpooling {
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
  prix: number;
}

export function ValidationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [validation, setValidation] = useState<any>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [carpooling, setCarpooling] = useState<Carpooling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [carpoolingId, setCarpoolingId] = useState<string>('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!id) {
          setError('Identifiant de la validation manquant');
          return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigate('/connexion');
          return;
        }

        // Get validation data
        const validationDoc = await getDoc(doc(db, 'validations', id));
        if (!validationDoc.exists()) {
          setError('Cette validation n\'existe plus');
          return;
        }

        const validationData = validationDoc.data();
        
        // Check if current user is the passenger
        if (validationData.passager_id !== currentUser.uid) {
          setError('Vous n\'êtes pas autorisé à voir cette validation');
          return;
        }

        setValidation(validationData);

        // Get driver data
        const driverDoc = await getDoc(doc(db, 'users', validationData.chauffeur_id));
        if (driverDoc.exists()) {
          setDriver(driverDoc.data() as Driver);
        }

        // Get carpooling data
        const carpoolingQuery = query(
          collection(db, 'covoiturages'),
          where('driver_id', '==', validationData.chauffeur_id),
          where('passagers_id', 'array-contains', currentUser.uid),
          where('statut', '==', 'terminé')
        );
        const carpoolingSnapshot = await getDocs(carpoolingQuery);
        if (!carpoolingSnapshot.empty) {
          const carpoolingData = carpoolingSnapshot.docs[0].data() as Carpooling;
          setCarpooling(carpoolingData);
          setCarpoolingId(carpoolingSnapshot.docs[0].id);
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

  const handleValidate = async () => {
    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Créer l'avis dans Firestore et Supabase
      const avisId = crypto.randomUUID();
      await syncAvis(avisId, {
        driver_id: validation.chauffeur_id,
        passager_id: currentUser.uid,
        covoiturage_id: carpoolingId,
        note: rating,
        commentaire: comment
      });

      // Get waiting credit document
      const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
      if (!waitingCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits en attente');
      }

      // Get driver credit document
      const driverCreditDoc = await getDoc(doc(db, 'credit', validation.chauffeur_id));
      if (!driverCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits du chauffeur');
      }

      // Update driver credit (add trip price)
      await updateDoc(doc(db, 'credit', validation.chauffeur_id), {
        solde: driverCreditDoc.data().solde + carpooling!.prix,
        covoiturage_id: carpoolingId,
        date_modification: serverTimestamp(),
        type: 'validation_trajet'
      });

      // Update waiting credit (deduct trip price)
      await updateDoc(doc(db, 'credit', 'Attente'), {
        Solde: waitingCreditDoc.data().Solde - carpooling!.prix,
        covoiturage_id: carpoolingId,
        date_modification: serverTimestamp(),
        type: 'validation_trajet'
      });

      // Get application credit document
      const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
      if (!appCreditDoc.exists()) {
        throw new Error('Erreur lors de la récupération des crédits de la plateforme');
      }

      // Update application credit
      await updateDoc(doc(db, 'credit', 'application'), {
        Solde: appCreditDoc.data().Solde,
        covoiturage_id: carpoolingId,
        date_modification: serverTimestamp(),
        type: 'validation_trajet'
      });

      // Update validation status
      await updateDoc(doc(db, 'validations', id!), {
        statut: 'validé',
        date_modification: serverTimestamp()
      });

      navigate('/validation');
    } catch (err) {
      console.error('Erreur détaillée:', err);
      setError('Erreur lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispute = async () => {
    setIsSubmitting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Format dates properly
      const dateCreation = new Date().toISOString();

      // Préparer les données du litige
      const litigeData = {
        chauffeur_id: validation.chauffeur_id,
        passager_id: auth.currentUser?.uid,
        covoiturage_id: carpoolingId,
        statut: 'litige',
        raison_litige: disputeReason,
        date_creation: dateCreation
        // date_resolution is omitted since dispute is not yet resolved
      };

      // Synchroniser le litige avec Firestore et Supabase
      await syncLitigeEnCours(id!, litigeData);

      navigate('/validation');
    } catch (err) {
      setError('Erreur lors de la déclaration du litige');
      console.error(err);
    } finally {
      setIsSubmitting(false);
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

  if (error || !validation || !driver || !carpooling) {
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
            onClick={() => navigate('/validation')}
            className="mt-4 flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Retour aux validations
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/validation')}
          className="flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors mb-6"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Retour aux validations
        </button>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
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
              </div>
            </div>
            {validation.statut === 'non validé' ? (
              <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                <span>À valider</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 rounded-full">
                <AlertTriangle className="w-4 h-4" />
                <span>Litige</span>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-[#3E920B]" />
                  <span className="font-semibold">
                    {new Date(carpooling.date_depart).toLocaleDateString()}
                  </span>
                  <Clock className="w-5 h-5 text-[#3E920B] ml-2" />
                  <span>{carpooling.heure_depart}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-[#3E920B]" />
                <span className="text-gray-600">
                  {carpooling.depart_ville} → {carpooling.arrivee_ville}
                </span>
              </div>
            </div>

            {validation.statut === 'non validé' && !showDisputeForm && (
              <div className="space-y-6 border-t pt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note
                  </label>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`p-1 ${
                          star <= rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      >
                        <Star className="w-8 h-8 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commentaire
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                    placeholder="Partagez votre expérience..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={handleValidate}
                    disabled={isSubmitting}
                    className="flex-1 py-2 px-4 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Validation...' : 'Valider le trajet'}
                  </button>
                  <button
                    onClick={() => setShowDisputeForm(true)}
                    disabled={isSubmitting}
                    className="py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Déclarer un litige
                  </button>
                </div>
              </div>
            )}

            {validation.statut === 'non validé' && showDisputeForm && (
              <div className="space-y-6 border-t pt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Raison du litige
                  </label>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                    placeholder="Expliquez la raison du litige..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setShowDisputeForm(false)}
                    className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDispute}
                    disabled={isSubmitting || !disputeReason.trim()}
                    className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Envoi...' : 'Envoyer le litige'}
                  </button>
                </div>
              </div>
            )}

            {validation.statut === 'litige' && (
              <div className="border-t pt-6">
                <div className="bg-red-50 p-4 rounded-lg">
                  <h3 className="font-medium text-red-800 mb-2">Raison du litige</h3>
                  <p className="text-red-700">{validation.raison_litige}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}