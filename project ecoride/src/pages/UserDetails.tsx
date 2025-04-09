import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  ChevronLeft,
  Car,
  Calendar,
  Star,
  MapPin,
  Clock,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

interface User {
  id: string;
  pseudo: string;
  adresse_mail: string;
  role: string;
  roles?: string[];
  date_creation: string;
  photo_url?: string;
  statut: 'actif' | 'bloqué';
}

interface Trip {
  id: string;
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
  statut: string;
  prix: number;
}

export function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [credit, setCredit] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState(0);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showLitigeModal, setShowLitigeModal] = useState(false);
  const [litigeAction, setLitigeAction] = useState<'validate' | 'cancel'>('validate');

  const logAdminAction = async (action: string) => {
    try {
      const admin = auth.currentUser;
      if (!admin) throw new Error('Admin non connecté');
      if (!user) throw new Error('Utilisateur non trouvé');

      // Get admin user data to get pseudo
      const adminDoc = await getDoc(doc(db, 'users', admin.uid));
      const adminPseudo = adminDoc.exists() ? adminDoc.data().pseudo : 'Admin';

      await addDoc(collection(db, 'administration'), {
        user_id: id,
        user_pseudo: user.pseudo,
        admin_id: admin.uid,
        admin_pseudo: adminPseudo,
        action: action,
        date_action: serverTimestamp()
      });
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de l\'action:', err);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/connexion');
        return;
      }

      try {
        // Verify admin role
        const adminDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!adminDoc.exists() || adminDoc.data().role !== 'administrateur') {
          navigate('/');
          return;
        }

        if (!id) {
          setError('Identifiant utilisateur manquant');
          return;
        }

        // Get user data
        const userDoc = await getDoc(doc(db, 'users', id));
        if (!userDoc.exists()) {
          setError('Utilisateur non trouvé');
          return;
        }

        setUser({ id, ...userDoc.data() } as User);

        // Get user credit
        const creditDoc = await getDoc(doc(db, 'credit', id));
        if (creditDoc.exists()) {
          setCredit(creditDoc.data().solde);
        }

        // Get user rating
        const ratingsQuery = query(
          collection(db, 'note'),
          where('driver_id', '==', id)
        );
        const ratingsSnapshot = await getDocs(ratingsQuery);
        if (!ratingsSnapshot.empty) {
          const ratings = ratingsSnapshot.docs.map(doc => doc.data().note);
          const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          setAverageRating(average);
        }

        // Get user trips
        const tripsQuery = query(
          collection(db, 'covoiturages'),
          where('driver_id', '==', id)
        );
        const tripsSnapshot = await getDocs(tripsQuery);
        const tripsList: Trip[] = [];
        tripsSnapshot.forEach((doc) => {
          tripsList.push({ id: doc.id, ...doc.data() } as Trip);
        });
        const sortedTrips = tripsList.sort((a, b) => 
          new Date(b.date_depart).getTime() - new Date(a.date_depart).getTime()
        );
        setTrips(sortedTrips);
        setRecentTrips(sortedTrips.slice(0, 4));

      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [id, navigate]);

  const handleRoleToggle = async (role: 'chauffeur' | 'passager') => {
    try {
      const currentRoles = user?.roles || [];
      let newRoles: string[];

      if (currentRoles.includes(role)) {
        newRoles = currentRoles.filter(r => r !== role);
      } else {
        newRoles = [...currentRoles, role];
      }

      await updateDoc(doc(db, 'users', id!), {
        roles: newRoles,
        date_modification: serverTimestamp()
      });

      setUser(prev => prev ? { ...prev, roles: newRoles } : null);
      await logAdminAction(`Modification des rôles: ${newRoles.join(', ')}`);
      setShowRoleModal(false);
    } catch (err) {
      setError('Erreur lors de la modification des rôles');
      console.error(err);
    }
  };

  const handleCreditUpdate = async () => {
    try {
      const creditDoc = await getDoc(doc(db, 'credit', id!));
      if (!creditDoc.exists()) {
        throw new Error('Document de crédit non trouvé');
      }

      const newBalance = creditDoc.data().solde + creditAmount;
      if (newBalance < 0) {
        throw new Error('Le solde ne peut pas être négatif');
      }

      await updateDoc(doc(db, 'credit', id!), {
        solde: newBalance,
        date_modification: serverTimestamp()
      });

      await logAdminAction(`${creditAmount >= 0 ? 'Ajout' : 'Retrait'} de ${Math.abs(creditAmount)} crédits`);
      setCredit(newBalance);
      setShowCreditModal(false);
      setCreditAmount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification des crédits');
      console.error(err);
    }
  };

  const handleStatusToggle = async () => {
    try {
      const newStatus = user?.statut === 'bloqué' ? 'actif' : 'bloqué';
      await updateDoc(doc(db, 'users', id!), {
        statut: newStatus,
        date_modification: serverTimestamp()
      });

      await logAdminAction(`${newStatus === 'bloqué' ? 'Blocage' : 'Déblocage'} du compte`);
      setUser(prev => prev ? { ...prev, statut: newStatus } : null);
    } catch (err) {
      setError('Erreur lors de la modification du statut');
      console.error(err);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'SUPPRIMER') {
      setError('Veuillez saisir SUPPRIMER pour confirmer');
      return;
    }

    try {
      // Delete user document
      await deleteDoc(doc(db, 'users', id!));
      
      // Delete credit document
      await deleteDoc(doc(db, 'credit', id!));

      await logAdminAction('Suppression du compte');
      navigate('/user');
    } catch (err) {
      setError('Erreur lors de la suppression du compte');
      console.error(err);
    }
  };

  const handleLitigeAction = async () => {
    try {
      const litigesQuery = query(
        collection(db, 'validations'),
        where('passager_id', '==', id),
        where('statut', '==', 'litige')
      );
      const litigesSnapshot = await getDocs(litigesQuery);

      for (const litigeDoc of litigesSnapshot.docs) {
        if (litigeAction === 'validate') {
          await updateDoc(doc(db, 'validations', litigeDoc.id), {
            statut: 'validé',
            date_modification: serverTimestamp()
          });
        } else {
          await updateDoc(doc(db, 'validations', litigeDoc.id), {
            statut: 'annulé',
            date_modification: serverTimestamp()
          });
        }
      }

      await logAdminAction(`${litigeAction === 'validate' ? 'Validation' : 'Annulation'} des litiges`);
      setShowLitigeModal(false);
    } catch (err) {
      setError('Erreur lors du traitement des litiges');
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

  if (error || !user) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error || 'Données non disponibles'}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/user')}
            className="mt-4 flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Retour à la liste des utilisateurs
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/user')}
          className="flex items-center text-[#3E920B] hover:text-[#A7DE65] transition-colors mb-6"
        >
          <ChevronLeft className="h-5 w-5 mr-2" />
          Retour à la liste des utilisateurs
        </button>

        {/* User Profile Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="h-20 w-20 rounded-full bg-gray-200 overflow-hidden">
              {user.photo_url ? (
                <img
                  src={user.photo_url}
                  alt={user.pseudo}
                  className="h-20 w-20 object-cover"
                />
              ) : (
                <div className="h-20 w-20 flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-3xl font-bold">
                  {user.pseudo.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#333333]">{user.pseudo}</h1>
              <p className="text-gray-600">{user.adresse_mail}</p>
              <div className="flex items-center space-x-2 mt-2">
                {user.roles?.map((role) => (
                  <span
                    key={role}
                    className="px-2 py-1 text-sm font-semibold bg-[#A7DE65]/20 text-[#3E920B] rounded-full"
                  >
                    {role === 'chauffeur' ? 'Chauffeur' : 'Passager'}
                  </span>
                ))}
                <span
                  className={`px-2 py-1 text-sm font-semibold rounded-full ${
                   user.statut !== 'bloqué'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                 {user.statut !== 'bloqué' ? 'Actif' : 'Bloqué'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Crédits</h3>
              <p className="text-2xl font-bold text-[#3E920B] mt-1">{credit}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Note moyenne</h3>
              <div className="flex items-center space-x-1 mt-1">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-2xl font-bold">
                  {averageRating ? `${averageRating.toFixed(1)}/5` : 'N/A'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Membre depuis</h3>
              <p className="text-2xl font-bold mt-1">
                {user.date_creation?.toDate?.() 
                  ? user.date_creation.toDate().toLocaleDateString()
                  : new Date(user.date_creation).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Actions administratives</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowRoleModal(true)}
              className="p-4 border border-gray-200 rounded-lg hover:border-[#3E920B] transition-colors text-left"
            >
              <h3 className="font-medium mb-1">Gestion des rôles</h3>
              <p className="text-sm text-gray-600">Modifier les rôles de l'utilisateur</p>
            </button>

            <button
              onClick={() => setShowCreditModal(true)}
              className="p-4 border border-gray-200 rounded-lg hover:border-[#3E920B] transition-colors text-left"
            >
              <h3 className="font-medium mb-1">Gestion des crédits</h3>
              <p className="text-sm text-gray-600">Ajouter ou retirer des crédits</p>
            </button>

            <button
              onClick={handleStatusToggle}
              className="p-4 border border-gray-200 rounded-lg hover:border-[#3E920B] transition-colors text-left"
            >
              <h3 className="font-medium mb-1">
                {user?.statut === 'bloqué' ? 'Réactiver le compte' : 'Suspendre le compte'}
              </h3>
              <p className="text-sm text-gray-600">
                {user?.statut === 'bloqué' ? 'Permettre' : 'Empêcher'} l'accès au compte
              </p>
            </button>

            <button
              onClick={() => setShowLitigeModal(true)}
              className="p-4 border border-gray-200 rounded-lg hover:border-[#3E920B] transition-colors text-left"
            >
              <h3 className="font-medium mb-1">Gestion des litiges</h3>
              <p className="text-sm text-gray-600">Forcer la validation ou l'annulation des litiges</p>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-4 border border-red-200 rounded-lg hover:border-red-500 transition-colors text-left text-red-600 col-span-full"
            >
              <h3 className="font-medium mb-1">Supprimer le compte</h3>
              <p className="text-sm">Supprimer définitivement le compte et toutes ses données</p>
            </button>
          </div>
        </div>

        {/* Recent Trips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recentTrips.map((trip) => (
            <div
              key={trip.id}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-[#3E920B]" />
                  <span className="font-semibold">
                    {new Date(trip.date_depart).toLocaleDateString()}
                  </span>
                  <Clock className="w-5 h-5 text-[#3E920B] ml-2" />
                  <span>{trip.heure_depart}</span>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    trip.statut === 'actif'
                      ? 'bg-blue-100 text-blue-800'
                      : trip.statut === 'en_cours'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {trip.statut}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <MapPin className="w-5 h-5 text-[#3E920B]" />
                <span>
                  {trip.depart_ville} → {trip.arrivee_ville}
                </span>
              </div>
              <div className="mt-4 text-[#3E920B] font-semibold text-lg">
                {trip.prix} crédits
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Gestion des rôles</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={user?.roles?.includes('chauffeur')}
                  onChange={() => handleRoleToggle('chauffeur')}
                  className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                />
                <span>Chauffeur</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={user?.roles?.includes('passager')}
                  onChange={() => handleRoleToggle('passager')}
                  className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                />
                <span>Passager</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Gestion des crédits</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Solde actuel : {credit} crédits</p>
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                placeholder="Montant (négatif pour retirer)"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleCreditUpdate}
                className="px-4 py-2 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-red-600 mb-4">Supprimer le compte</h3>
            <p className="text-gray-600 mb-4">
              Cette action est irréversible. Toutes les données de l'utilisateur seront supprimées.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tapez SUPPRIMER pour confirmer
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                disabled={deleteConfirmation !== 'SUPPRIMER'}
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Litige Modal */}
      {showLitigeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Gestion des litiges</h3>
            <div className="space-y-4 mb-6">
              <button
                onClick={() => setLitigeAction('validate')}
                className={`w-full p-4 rounded-lg border ${
                  litigeAction === 'validate'
                    ? 'border-[#3E920B] bg-[#3E920B]/10'
                    : 'border-gray-200'
                }`}
              >
                Valider tous les litiges
              </button>
              <button
                onClick={() => setLitigeAction('cancel')}
                className={`w-full p-4 rounded-lg border ${
                  litigeAction === 'cancel'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200'
                }`}
              >
                Annuler tous les litiges
              </button>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowLitigeModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
              <button
                onClick={handleLitigeAction}
                className="px-4 py-2 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}