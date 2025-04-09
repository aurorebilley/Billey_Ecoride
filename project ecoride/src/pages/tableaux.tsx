import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  LayoutDashboard,
  AlertTriangle,
  CheckCircle2,
  Flag,
  ArrowRight,
  Car,
  Star,
  MapPin,
  Calendar,
  Clock,
  Mail,
  History,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  litiges: number;
  avisSignales: number;
}

interface Task {
  id: string;
  type: 'litige' | 'avis';
  date: string;
  user: {
    pseudo: string;
    photo_url?: string;
  };
  details: string;
}

interface AdminAction {
  id: string;
  employe_id: string;
  employe_pseudo: string;
  date_action: string;
  action: string;
  details: string;
}

export function Tableaux() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    litiges: 0, 
    avisSignales: 0
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'creation'>('week');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/connexion');
        return;
      }

      try {
        // Verify employee role
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'employé') {
          navigate('/');
          return;
        }

        // Get litiges count
        const litigesQuery = query(
          collection(db, 'validations'),
          where('statut', '==', 'litige')
        );
        const litigesSnapshot = await getDocs(litigesQuery);
        const litigesCount = litigesSnapshot.size;

        // Get signaled reviews count
        const reviewsQuery = query(
          collection(db, 'note'),
          where('signale', '==', true)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsCount = reviewsSnapshot.size;

        setStats({
          litiges: litigesCount,
          avisSignales: reviewsCount,
        });

        // Get recent tasks
        const tasks: Task[] = [];

        // Get recent litiges
        const recentLitigesQuery = query(
          collection(db, 'validations'),
          where('statut', '==', 'litige'),
          orderBy('date_creation', 'desc'),
          limit(5)
        );
        const recentLitigesSnapshot = await getDocs(recentLitigesQuery);

        for (const litigeDoc of recentLitigesSnapshot.docs) {
          const litigeData = litigeDoc.data();
          const userDoc = await getDoc(doc(db, 'users', litigeData.passager_id));
          const userData = userDoc.exists() ? userDoc.data() : null;

          tasks.push({
            id: litigeDoc.id,
            type: 'litige',
            date: litigeData.date_creation,
            user: {
              pseudo: userData?.pseudo || 'Utilisateur inconnu',
              photo_url: userData?.photo_url,
            },
            details: litigeData.raison_litige,
          });
        }

        // Get recent signaled reviews
        const recentReviewsQuery = query(
          collection(db, 'note'),
          where('signale', '==', true),
          orderBy('date_creation', 'desc'),
          limit(5)
        );
        const recentReviewsSnapshot = await getDocs(recentReviewsQuery);

        for (const reviewDoc of recentReviewsSnapshot.docs) {
          const reviewData = reviewDoc.data();
          const userDoc = await getDoc(doc(db, 'users', reviewData.passager_id));
          const userData = userDoc.exists() ? userDoc.data() : null;

          tasks.push({
            id: reviewDoc.id,
            type: 'avis',
            date: reviewData.date_creation,
            user: {
              pseudo: userData?.pseudo || 'Utilisateur inconnu',
              photo_url: userData?.photo_url,
            },
            details: reviewData.commentaire,
          });
        }

        // Sort tasks by date
        tasks.sort((a, b) => {
          const dateA = a.date?.toDate?.() ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate?.() ? b.date.toDate() : new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });

        setRecentTasks(tasks.slice(0, 5));

        // Get recent admin actions
        // Get actions from Supabase historique_litiges
        const { data: historicActions, error: actionsError } = await supabase
          .from('historique_litiges')
          .select('*')
          .eq('employe_id', user.uid)
          .order('date_resolution', { ascending: false });

        if (actionsError) throw actionsError;

        // Get additional user data for each action
        const actionsWithDetails = await Promise.all((historicActions || []).map(async (action) => {
          // Get chauffeur data
          const driverDoc = await getDoc(doc(db, 'users', action.chauffeur_id));
          const driverData = driverDoc.exists() ? driverDoc.data() : null;

          // Get passager data
          const passengerDoc = await getDoc(doc(db, 'users', action.passager_id));
          const passengerData = passengerDoc.exists() ? passengerDoc.data() : null;

          return {
            ...action,
            chauffeur_pseudo: driverData?.pseudo || 'Utilisateur inconnu',
            passager_pseudo: passengerData?.pseudo || 'Utilisateur inconnu'
          };
        }));

        setRecentActions(actionsWithDetails);

      } catch (err) {
        setError('Une erreur est survenue');
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
        <div className="flex items-center space-x-3 mb-8">
          <LayoutDashboard className="h-8 w-8 text-[#3E920B]" />
          <h1 className="text-3xl font-bold text-[#333333]">
            Tableau de bord
          </h1>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            to="/litige"
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#333333]">Litiges</h2>
                  <p className="text-sm text-gray-500">En attente de traitement</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-red-600">{stats.litiges}</span>
            </div>
          </Link>

          <Link
            to="/avis"
            className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Flag className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#333333]">Avis signalés</h2>
                  <p className="text-sm text-gray-500">À modérer</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-orange-600">{stats.avisSignales}</span>
            </div>
          </Link>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-[#333333]">Tâches prioritaires</h2>
            <div className="flex space-x-4">
              <Link
                to="/litige"
                className="text-[#3E920B] hover:text-[#A7DE65] flex items-center space-x-1"
              >
                <span>Voir tous les litiges</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/avis"
                className="text-[#3E920B] hover:text-[#A7DE65] flex items-center space-x-1"
              >
                <span>Voir tous les avis</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {recentTasks.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                Aucune tâche en attente
              </p>
            ) : (
              recentTasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/${task.type}/${task.id}`}
                  className="block bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {task.user.photo_url ? (
                        <img
                          src={task.user.photo_url}
                          alt={task.user.pseudo}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-lg font-bold">
                          {task.user.pseudo.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{task.user.pseudo}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-sm text-gray-500">
                          {task.date?.toDate?.()
                            ? task.date.toDate().toLocaleString()
                            : new Date(task.date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{task.details}</p>
                    </div>
                    {task.type === 'litige' && (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    )}
                    {task.type === 'avis' && (
                      <Flag className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Actions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center space-x-3 mb-6">
            <History className="w-6 h-6 text-[#3E920B]" />
            <h2 className="text-xl font-semibold text-[#333333]">
              Mes actions récentes
            </h2>
          </div>

          <div className="space-y-4">
            {recentActions.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                Vous n'avez effectué aucune action récemment
              </p>
            ) : (
              recentActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="text-sm font-medium">
                        Litige résolu - {action.resolution}
                      </p>
                      <p className="text-sm text-gray-500">
                        Entre {action.chauffeur_pseudo} (chauffeur) et {action.passager_pseudo} (passager)
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Raison : {action.raison}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(action.date_resolution).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}