import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Car,
  FileText,
  History,
  ChevronRight,
  Euro,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { syncTransaction, syncLitigeResolu } from '../lib/sync';

interface Litige {
  id: string;
  chauffeur_id: string;
  passager_id: string;
  covoiturage_id: string;
  raison_litige: string;
  date_creation: any;
  date_modification: any;
  date_resolution: any;
  decision_par: string | null;
  // On n'utilise plus historique_actions dans Firestore
  historique_actions?: Array<{
    action: string;
    date: any;
    note: string;
    par: string;
  }>;
  statut: string;
}

interface UserData {
  pseudo: string;
  photo_url?: string;
  adresse_mail: string;
}

interface Carpooling {
  prix: number;
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
}

export function Litige() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [litiges, setLitiges] = useState<(Litige & {
    chauffeur?: UserData;
    passager?: UserData;
    covoiturage?: Carpooling;
  })[]>([]);
  const [selectedLitige, setSelectedLitige] = useState<string | null>(null);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/connexion');
        return;
      }

      try {
        // Vérifier que l'utilisateur est bien un employé
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'employé') {
          navigate('/');
          return;
        }

        // Récupérer tous les litiges (documents dans validations avec statut "litige")
        const litigesQuery = query(
          collection(db, 'validations'),
          where('statut', '==', 'litige'),
          orderBy('date_creation', 'desc')
        );
        const litigesSnapshot = await getDocs(litigesQuery);
        const litigesList: any[] = [];

        for (const docSnapshot of litigesSnapshot.docs) {
          const litigeData = docSnapshot.data();

          // Récupérer les informations du chauffeur
          const driverDoc = await getDoc(doc(db, 'users', litigeData.chauffeur_id));
          const driverData = driverDoc.exists() ? driverDoc.data() : null;

          // Récupérer les informations du passager
          const passengerDoc = await getDoc(doc(db, 'users', litigeData.passager_id));
          const passengerData = passengerDoc.exists() ? passengerDoc.data() : null;

          // Récupérer les informations du trajet
          const carpoolingDoc = await getDoc(doc(db, 'covoiturages', litigeData.covoiturage_id));
          const carpoolingData = carpoolingDoc.exists() ? carpoolingDoc.data() : null;

          litigesList.push({
            id: docSnapshot.id,
            ...litigeData,
            chauffeur: driverData,
            passager: passengerData,
            covoiturage: carpoolingData,
          });
        }

        setLitiges(litigesList);
      } catch (err) {
        setError('Erreur lors du chargement des litiges');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleValidateDriver = async (litige: Litige & { covoiturage?: Carpooling }) => {
    setIsProcessing(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Get employee data
      const employeeDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!employeeDoc.exists()) throw new Error('Données employé non trouvées');
      const employeeData = employeeDoc.data();

      // Récupérer le prix du trajet
      const carpoolingDoc = await getDoc(doc(db, 'covoiturages', litige.covoiturage_id));
      if (!carpoolingDoc.exists()) {
        throw new Error('Covoiturage non trouvé');
      }
      const tripPrice = carpoolingDoc.data().prix;
      console.log('Prix du trajet:', tripPrice);

      // Mise à jour du crédit du chauffeur
      const driverCreditDoc = await getDoc(doc(db, 'credit', litige.chauffeur_id));
      if (!driverCreditDoc.exists()) {
        throw new Error('Document crédit du chauffeur non trouvé');
      }
      const currentDriverCredit = Number(driverCreditDoc.data().solde || 0);
      const newDriverCredit = currentDriverCredit + tripPrice;
      console.log('Crédits chauffeur:', { avant: currentDriverCredit, ajout: tripPrice, apres: newDriverCredit });
      await updateDoc(doc(db, 'credit', litige.chauffeur_id), {
        solde: newDriverCredit,
        covoiturage_id: litige.covoiturage_id,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du crédit en attente
      const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
      if (!waitingCreditDoc.exists()) {
        throw new Error('Document "Attente" non trouvé');
      }
      const currentWaitingCredit = Number(waitingCreditDoc.data().solde || 0);
      const newWaitingCredit = currentWaitingCredit - tripPrice;
      console.log('Crédits en attente:', { avant: currentWaitingCredit, retrait: tripPrice, apres: newWaitingCredit });
      await updateDoc(doc(db, 'credit', 'Attente'), {
        solde: newWaitingCredit,
        covoiturage_id: litige.covoiturage_id,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du document de validation sans enregistrer l'historique d'action dans Firestore
      const updatedLitige = {
        statut: 'résolu',
        date_resolution: serverTimestamp(),
        decision_par: currentUser.uid,
        date_modification: serverTimestamp(),
      };
      
      await updateDoc(doc(db, 'validations', litige.id), updatedLitige);

      // Synchronisation de la transaction (et éventuellement de l'historique) dans Supabase
      // Ici, syncTransaction enregistre le paiement et vous pouvez
      // implémenter une fonction spécifique pour enregistrer l'historique dans Supabase
      await syncTransaction({
        utilisateur_id: litige.chauffeur_id,
        montant: tripPrice,
        type: 'paiement_trajet',
        description: 'Paiement suite à la résolution du litige',
        covoiturage_id: litige.covoiturage_id,
      });

      // Sync with Firestore and Supabase
      await syncLitigeResolu(litige.id, {
        ...litige,
        statut: 'résolu',
        employe_id: currentUser.uid,
        date_resolution: new Date().toISOString(),
        resolution: 'Validé'
      });

      // Mise à jour de l'état local
      setLitiges((prev) => prev.filter((l) => l.id !== litige.id));
      setSelectedLitige(null);
      setShowValidateModal(false);
    } catch (err) {
      console.error('Erreur lors de la synchronisation du litige:', err);
      setError('Erreur lors de la validation du chauffeur');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefundPassenger = async (litige: Litige & { covoiturage?: Carpooling }) => {
    setIsProcessing(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');
      
      // Get employee data
      const employeeDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!employeeDoc.exists()) throw new Error('Données employé non trouvées');
      const employeeData = employeeDoc.data();

      // Récupérer le prix du trajet
      const carpoolingDoc = await getDoc(doc(db, 'covoiturages', litige.covoiturage_id));
      if (!carpoolingDoc.exists()) throw new Error('Covoiturage non trouvé');
      const tripPrice = carpoolingDoc.data().prix;
      const refundAmount = tripPrice + 1; // remboursement : prix + 1 crédit de compensation

      // Mise à jour du crédit du passager
      const passengerCreditDoc = await getDoc(doc(db, 'credit', litige.passager_id));
      if (!passengerCreditDoc.exists()) throw new Error('Document crédit du passager non trouvé');
      const currentPassengerCredit = passengerCreditDoc.data().solde || 0;
      await updateDoc(doc(db, 'credit', litige.passager_id), {
        solde: currentPassengerCredit + refundAmount,
        covoiturage_id: litige.covoiturage_id,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du crédit de l'application (déduire 2 crédits)
      const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
      if (!appCreditDoc.exists()) throw new Error('Document crédit application non trouvé');
      const appCreditData = appCreditDoc.data();
      const currentAppCredit = appCreditData.solde ?? 0;
      await updateDoc(doc(db, 'credit', 'application'), {
        solde: currentAppCredit - 2,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du crédit en attente
      const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
      if (!waitingCreditDoc.exists()) throw new Error('Document crédit en attente non trouvé');
      const waitingCreditData = waitingCreditDoc.data();
      const currentWaitingCredit = waitingCreditData.solde || 0;
      await updateDoc(doc(db, 'credit', 'Attente'), {
        solde: currentWaitingCredit - tripPrice,
        covoiturage_id: litige.covoiturage_id,
        date_modification: serverTimestamp(),
      });

      // Mise à jour du document de validation sans historique des actions dans Firestore
      const updatedLitige = {
        statut: 'résolu',
        date_resolution: serverTimestamp(),
        decision_par: currentUser.uid,
        date_modification: serverTimestamp(),
      };
      
      await updateDoc(doc(db, 'validations', litige.id), updatedLitige);

      // Synchronisation de la transaction (et éventuellement de l'historique) dans Supabase
      await syncTransaction({
        utilisateur_id: litige.passager_id,
        montant: refundAmount,
        type: 'remboursement',
        description: 'Remboursement passager suite litige',
        covoiturage_id: litige.covoiturage_id,
      });

      // Sync with Firestore and Supabase
      await syncLitigeResolu(litige.id, {
        ...litige,
        statut: 'résolu',
        employe_id: currentUser.uid,
        date_resolution: new Date().toISOString(),
        resolution: 'Remboursé'
      });

      // Mise à jour de l'état local
      setLitiges((prev) => prev.filter((l) => l.id !== litige.id));
      setSelectedLitige(null);
      setShowRefundModal(false);
    } catch (err) {
      console.error('Erreur lors de la synchronisation du litige:', err);
      setError('Erreur lors du remboursement du passager');
    } finally {
      setIsProcessing(false);
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

  const selectedDispute = litiges.find((l) => l.id === selectedLitige);

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center space-x-3 mb-8">
          <AlertTriangle className="h-8 w-8 text-[#3E920B]" />
          <h1 className="text-3xl font-bold text-[#333333]">Gestion des litiges</h1>
        </div>

        {litiges.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-[#3E920B] mx-auto mb-4" />
            <p className="text-gray-600">Aucun litige en attente</p>
          </div>
        ) : selectedDispute ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-semibold">Détails du litige</h2>
              <button onClick={() => setSelectedLitige(null)} className="text-gray-500 hover:text-gray-700">
                Retour à la liste
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informations du chauffeur */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <Car className="w-5 h-5 text-[#3E920B]" />
                  <h3 className="font-medium">Chauffeur</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    {selectedDispute.chauffeur?.photo_url ? (
                      <img
                        src={selectedDispute.chauffeur.photo_url}
                        alt={selectedDispute.chauffeur.pseudo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-xl font-bold">
                        {selectedDispute.chauffeur?.pseudo.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {selectedDispute.chauffeur?.pseudo}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations du passager */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <User className="w-5 h-5 text-[#3E920B]" />
                  <h3 className="font-medium">Passager</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    {selectedDispute.passager?.photo_url ? (
                      <img
                        src={selectedDispute.passager.photo_url}
                        alt={selectedDispute.passager.pseudo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-xl font-bold">
                        {selectedDispute.passager?.pseudo.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {selectedDispute.passager?.pseudo}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informations du trajet */}
              <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <Car className="w-5 h-5 text-[#3E920B]" />
                  <h3 className="font-medium">Informations du trajet</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Trajet</p>
                    <p className="font-medium">
                      {selectedDispute.covoiturage?.depart_ville} → {selectedDispute.covoiturage?.arrivee_ville}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">
                      {new Date(selectedDispute.covoiturage?.date_depart || '').toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Prix</p>
                    <p className="font-medium">{selectedDispute.covoiturage?.prix} crédits</p>
                  </div>
                </div>
              </div>

              {/* Raison du litige */}
              <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <FileText className="w-5 h-5 text-[#3E920B]" />
                  <h3 className="font-medium">Raison du litige</h3>
                </div>
                <p className="text-gray-700">{selectedDispute.raison_litige}</p>
                <div className="mt-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {selectedDispute.date_creation?.toDate?.()
                        ? selectedDispute.date_creation.toDate().toLocaleDateString()
                        : new Date(selectedDispute.date_creation).toLocaleDateString()}
                    </span>
                    <Clock className="w-4 h-4 ml-2" />
                    <span>
                      {selectedDispute.date_creation?.toDate?.()
                        ? selectedDispute.date_creation.toDate().toLocaleTimeString()
                        : new Date(selectedDispute.date_creation).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* (Optionnel) Si vous souhaitez afficher un historique enregistré depuis Supabase, vous pouvez l'intégrer ici */}
            </div>

            {/* Boutons d'action */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-end">
              <button
                onClick={() => setShowValidateModal(true)}
                className="px-4 py-2 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors"
              >
                Valider le chauffeur
              </button>
              <button
                onClick={() => setShowRefundModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Rembourser le passager
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chauffeur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passager
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trajet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prix
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {litiges.map((litige) => (
                    <tr key={litige.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {litige.date_creation?.toDate?.()
                            ? litige.date_creation.toDate().toLocaleDateString()
                            : new Date(litige.date_creation).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {litige.date_creation?.toDate?.()
                            ? litige.date_creation.toDate().toLocaleTimeString()
                            : new Date(litige.date_creation).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                              {litige.chauffeur?.photo_url ? (
                                <img
                                  src={litige.chauffeur.photo_url}
                                  alt={litige.chauffeur.pseudo}
                                  className="h-10 w-10 object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 flex items-center justify-center bg-[#A7DE65] text-[#3E920B] font-bold">
                                  {litige.chauffeur?.pseudo.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {litige.chauffeur?.pseudo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                              {litige.passager?.photo_url ? (
                                <img
                                  src={litige.passager.photo_url}
                                  alt={litige.passager.pseudo}
                                  className="h-10 w-10 object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 flex items-center justify-center bg-[#A7DE65] text-[#3E920B] font-bold">
                                  {litige.passager?.pseudo.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {litige.passager?.pseudo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {litige.covoiturage?.depart_ville} → {litige.covoiturage?.arrivee_ville}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(litige.covoiturage?.date_depart || '').toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {litige.covoiturage?.prix} crédits
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLitige(litige.id)}
                          className="flex items-center space-x-1 text-[#3E920B] hover:text-[#A7DE65] transition-colors"
                        >
                          <span>Détails</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de validation du chauffeur */}
      {showValidateModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-[#3E920B]" />
              <h3 className="text-xl font-semibold text-[#333333]">Valider le chauffeur</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir valider le chauffeur ? Il recevra {selectedDispute.covoiturage?.prix} crédits.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowValidateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleValidateDriver(selectedDispute)}
                disabled={isProcessing}
                className="px-4 py-2 text-white bg-[#3E920B] hover:bg-[#A7DE65] rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Validation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de remboursement du passager */}
      {showRefundModal && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Euro className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold text-[#333333]">Rembourser le passager</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir rembourser le passager ? Il recevra {selectedDispute.covoiturage?.prix + 1} crédits (prix du trajet + 1 crédit de compensation).
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleRefundPassenger(selectedDispute)}
                disabled={isProcessing}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Remboursement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}