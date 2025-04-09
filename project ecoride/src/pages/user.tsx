import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getFirestore,
  collection,
  query,
  getDocs,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  Users,
  Search,
  ChevronLeft,
  CheckCircle2,
  Ban,
  Euro,
  UserCog,
  History,
  Filter,
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

interface AdminAction {
  id: string;
  admin_id: string;
  admin_pseudo: string;
  user_id: string;
  user_pseudo: string;
  action_type: 'block' | 'unblock' | 'role_change' | 'credit_change';
  details: string;
  date: string;
}

interface Credit {
  solde: number;
}

export function User() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<(User & { credit?: number })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'chauffeur' | 'passager'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'actif' | 'bloqué'>('all');
  const [showBlockModal, setShowBlockModal] = useState<{ isOpen: boolean; userId: string }>({
    isOpen: false,
    userId: '',
  });
  const [showUnblockModal, setShowUnblockModal] = useState<{ isOpen: boolean; userId: string }>({
    isOpen: false,
    userId: '',
  });
  const [showRoleModal, setShowRoleModal] = useState<{ isOpen: boolean; user: User | null }>({
    isOpen: false,
    user: null,
  });
  const [showCreditModal, setShowCreditModal] = useState<{
    isOpen: boolean;
    userId: string;
    currentCredit: number;
    adjustment: number;
  }>({
    isOpen: false,
    userId: '',
    currentCredit: 0,
    adjustment: 0,
  });
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/connexion');
        return;
      }

      try {
        const firestore = getFirestore();
        if (!firestore) {
          throw new Error('Firestore not initialized');
        }

        // Vérifier si l'utilisateur est administrateur
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'administrateur') {
          navigate('/');
          return;
        }

        // Récupérer tous les utilisateurs
        const usersQuery = query(collection(firestore, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const usersList: (User & { credit?: number })[] = [];

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          if (userData.role === 'user') {
            // Get user's credit depuis une collection de premier niveau
            const creditDoc = await getDoc(doc(db, 'credit', userDoc.id));
            const credit = creditDoc.exists() ? creditDoc.data().solde : 0;

            usersList.push({
              id: userDoc.id,
              ...userData,
              credit,
              statut: userData.statut || 'actif',
            } as User & { credit: number });
          }
        }

        setUsers(usersList);

        // Récupérer l'historique des actions administratives
        const actionsQuery = query(
          collection(db, 'administration'),
          orderBy('date_action', 'desc')
        );
        const actionsSnapshot = await getDocs(actionsQuery);
        const actionsList: AdminAction[] = [];
        const months = new Set<string>();

        actionsSnapshot.forEach((doc) => {
          const data = doc.data();
          const date = data.date_action?.toDate?.() 
            ? data.date_action.toDate() 
            : new Date(data.date_action);
          const monthKey = date.toISOString().slice(0, 7);
          months.add(monthKey);
          actionsList.push({ 
            id: doc.id,
            ...data,
            date: date
          });
        });

        setAdminActions(actionsList);
        setAvailableMonths(Array.from(months).sort().reverse());

      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const logAdminAction = async (
    userId: string,
    userPseudo: string,
    actionType: AdminAction['action_type'],
    details: string
  ) => {
    try {
      const admin = auth.currentUser;
      if (!admin) return;

      const adminDoc = await getDoc(doc(db, 'users', admin.uid));
      const adminPseudo = adminDoc.exists() ? adminDoc.data().pseudo : 'Admin';

      const actionData = {
        admin_id: admin.uid,
        admin_pseudo: adminPseudo,
        user_id: userId,
        user_pseudo: userPseudo,
        action_type: actionType,
        details,
        date: new Date().toISOString(),
      };

      const actionRef = await addDoc(collection(db, 'admin_actions'), actionData);
      setAdminActions(prev => [{
        id: actionRef.id,
        ...actionData
      }, ...prev]);
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement de l\'action:', err);
    }
  };

  const handleBlock = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      await updateDoc(doc(db, 'users', userId), {
        statut: 'bloqué',
        date_modification: serverTimestamp(),
      });

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, statut: 'bloqué' } : u
        )
      );

      await logAdminAction(
        userId,
        user.pseudo,
        'block',
        'Compte bloqué'
      );

      setShowBlockModal({ isOpen: false, userId: '' });
    } catch (err) {
      setError('Erreur lors du blocage de l\'utilisateur');
      console.error(err);
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      await updateDoc(doc(db, 'users', userId), {
        statut: 'actif',
        date_modification: serverTimestamp(),
      });

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, statut: 'actif' } : u
        )
      );

      await logAdminAction(
        userId,
        user.pseudo,
        'unblock',
        'Compte débloqué'
      );

      setShowUnblockModal({ isOpen: false, userId: '' });
    } catch (err) {
      setError('Erreur lors du déblocage de l\'utilisateur');
      console.error(err);
    }
  };

  const handleRoleChange = async (user: User, newRole: string) => {
    try {
      const currentRoles = user.roles || [];
      let updatedRoles: string[];

      if (newRole === 'chauffeur') {
        updatedRoles = currentRoles.includes('chauffeur') 
          ? currentRoles.filter(r => r !== 'chauffeur')
          : [...currentRoles, 'chauffeur'];
      } else {
        updatedRoles = currentRoles.includes('passager')
          ? currentRoles.filter(r => r !== 'passager')
          : [...currentRoles, 'passager'];
      }

      await updateDoc(doc(db, 'users', user.id), {
        roles: updatedRoles,
        date_modification: serverTimestamp(),
      });

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === user.id ? { ...u, roles: updatedRoles } : u
        )
      );

      await logAdminAction(
        user.id,
        user.pseudo,
        'role_change',
        `Rôles modifiés: ${updatedRoles.join(', ')}`
      );

      setShowRoleModal({ isOpen: false, user: null });
    } catch (err) {
      setError('Erreur lors de la modification des rôles');
      console.error(err);
    }
  };

  const handleCreditChange = async (userId: string, adjustment: number) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const creditRef = doc(db, 'credit', userId);
      const creditDoc = await getDoc(creditRef);
      const currentCredit = creditDoc.exists() ? creditDoc.data().solde : 0;
      const newCredit = currentCredit + adjustment;

      if (newCredit < 0) {
        throw new Error('Le solde ne peut pas être négatif');
      }

      await updateDoc(creditRef, {
        solde: newCredit,
        date_modification: serverTimestamp(),
      });

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, credit: newCredit } : u
        )
      );

      await logAdminAction(
        userId,
        user.pseudo,
        'credit_change',
        `Crédits ${adjustment >= 0 ? 'ajoutés' : 'retirés'}: ${Math.abs(adjustment)}`
      );

      setShowCreditModal({ isOpen: false, userId: '', currentCredit: 0, adjustment: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification des crédits');
      console.error(err);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.pseudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.adresse_mail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = 
      roleFilter === 'all' ||
      (roleFilter === 'chauffeur' && user.roles?.includes('chauffeur')) ||
      (roleFilter === 'passager' && user.roles?.includes('passager'));

    const matchesStatus = 
      statusFilter === 'all' ||
      user.statut === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

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

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/users')}
              className="text-[#3E920B] hover:text-[#A7DE65] transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Gestion des utilisateurs
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              >
                <option value="all">Tous les rôles</option>
                <option value="chauffeur">Chauffeurs</option>
                <option value="passager">Passagers</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="actif">Actifs</option>
                <option value="bloqué">Bloqués</option>
              </select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rôles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Crédits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date d'inscription
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.id}
                    onClick={() => navigate(`/user/${user.id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                            {user.photo_url ? (
                              <img
                                src={user.photo_url}
                                alt={user.pseudo}
                                className="h-10 w-10 object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 flex items-center justify-center bg-[#A7DE65] text-[#3E920B] font-bold">
                                {user.pseudo.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.pseudo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.adresse_mail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="space-x-1">
                          {user.roles?.map((role) => (
                            <span
                              key={role}
                              className="px-2 py-1 text-xs font-semibold bg-[#A7DE65]/20 text-[#3E920B] rounded-full"
                            >
                              {role === 'chauffeur' ? 'Chauffeur' : 'Passager'}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowRoleModal({ isOpen: true, user })}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <UserCog className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{user.credit} crédits</span>
                        <button
                          onClick={() => setShowCreditModal({
                            isOpen: true,
                            userId: user.id,
                            currentCredit: user.credit || 0,
                            adjustment: 0
                          })}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <Euro className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.statut === 'actif' ? (
                        <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                          Actif
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">
                          Bloqué
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {user.date_creation?.toDate?.() 
                          ? user.date_creation.toDate().toLocaleDateString()
                          : new Date(user.date_creation).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Admin Actions History */}
        <div className="bg-white rounded-xl shadow-lg p-6 overflow-hidden">
          <div className="flex items-center space-x-3 mb-6">
            <History className="h-6 w-6 text-[#3E920B]" />
            <h2 className="text-xl font-semibold text-[#333333]">
              Historique des actions administratives
            </h2>
          </div>
          
          {/* Month Navigation */}
          <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-2">
            {availableMonths.map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                  selectedMonth === month
                    ? 'bg-[#3E920B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {new Date(month).toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric'
                })}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {adminActions
              .filter(action => action.date.toISOString().slice(0, 7) === selectedMonth)
              .map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm font-medium">
                      {action.admin_pseudo} - {action.action}
                    </p>
                    <p className="text-sm text-gray-500">
                      Utilisateur concerné : {action.user_id}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {action.date.toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            ))}
            {adminActions.filter(action => 
              action.date.toISOString().slice(0, 7) === selectedMonth
            ).length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Aucune action administrative pour cette période
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Block User Modal */}
      {showBlockModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Ban className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Bloquer l'utilisateur
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir bloquer cet utilisateur ? Il ne pourra plus accéder à son compte.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowBlockModal({ isOpen: false, userId: '' })}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleBlock(showBlockModal.userId)}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Bloquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock User Modal */}
      {showUnblockModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Débloquer l'utilisateur
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir débloquer cet utilisateur ? Il pourra à nouveau accéder à son compte.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowUnblockModal({ isOpen: false, userId: '' })}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleUnblock(showUnblockModal.userId)}
                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Débloquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {showRoleModal.isOpen && showRoleModal.user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <UserCog className="h-6 w-6 text-[#3E920B]" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Modifier les rôles
              </h3>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="role-chauffeur"
                  checked={showRoleModal.user.roles?.includes('chauffeur')}
                  onChange={() => handleRoleChange(showRoleModal.user!, 'chauffeur')}
                  className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                />
                <label htmlFor="role-chauffeur" className="text-gray-700">Chauffeur</label>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="role-passager"
                  checked={showRoleModal.user.roles?.includes('passager')}
                  onChange={() => handleRoleChange(showRoleModal.user!, 'passager')}
                  className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                />
                <label htmlFor="role-passager" className="text-gray-700">Passager</label>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowRoleModal({ isOpen: false, user: null })}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Change Modal */}
      {showCreditModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Euro className="h-6 w-6 text-[#3E920B]" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Modifier les crédits
              </h3>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Solde actuel
                </label>
                <p className="text-2xl font-bold text-[#3E920B]">
                  {showCreditModal.currentCredit} crédits
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ajustement
                </label>
                <input
                  type="number"
                  value={showCreditModal.adjustment}
                  onChange={(e) => setShowCreditModal(prev => ({
                    ...prev,
                    adjustment: parseInt(e.target.value) || 0
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  placeholder="Entrez un montant (négatif pour retirer)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau solde
                </label>
                <p className="text-lg font-semibold">
                  {showCreditModal.currentCredit + showCreditModal.adjustment} crédits
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowCreditModal({ isOpen: false, userId: '', currentCredit: 0, adjustment: 0 })}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleCreditChange(showCreditModal.userId, showCreditModal.adjustment)}
                className="px-4 py-2 text-white bg-[#3E920B] hover:bg-[#A7DE65] rounded-lg transition-colors"
                disabled={showCreditModal.adjustment === 0}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
