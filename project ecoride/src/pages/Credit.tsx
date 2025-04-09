import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  where,
  orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  Wallet,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { syncTransaction } from '../lib/sync';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface CreditStats {
  totalPlatformCredits: number;
  totalWaitingCredits: number;
  totalUsers: number;
  dailyTrips: Array<{
    date: string;
    trips: number;
  }>;
}

export function Credit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'creation'>('week');
  const [stats, setStats] = useState<CreditStats>({
    totalPlatformCredits: 0,
    totalWaitingCredits: 0,
    totalUsers: 0,
    dailyTrips: [],
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/connexion');
        return;
      }

      try {
        // Vérifier si l'utilisateur est administrateur
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'administrateur') {
          navigate('/');
          return;
        }

        // Récupérer les crédits de la plateforme
        const appCreditDoc = await getDoc(doc(db, 'credit', 'application'));
        const platformCredits = appCreditDoc.exists() ? appCreditDoc.data().Solde : 0;

        // Récupérer les crédits en attente
        const waitingCreditDoc = await getDoc(doc(db, 'credit', 'Attente'));
        const waitingCredits = waitingCreditDoc.exists() ? waitingCreditDoc.data().Solde : 0;

        // Initialize dates before using them
        const now = new Date();
        const startDate = new Date();
        const creationDate = new Date('2025-03-10');

        switch (timeRange) {
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
          case 'creation':
            startDate.setTime(creationDate.getTime());
            break;
        }

        // Récupérer l'historique des transactions depuis Supabase
        const { data: historicTransactions, error: supabaseError } = await supabase
          .from('historique_transactions')
          .select('*')
          .gte('date_transaction', startDate.toISOString())
          .order('date_transaction', { ascending: false });

        if (supabaseError) throw supabaseError;

        // Récupérer le nombre d'utilisateurs avec le rôle "user"
        const usersQuery = query(collection(db, 'users'), where('role', '==', 'user'));
        const usersSnapshot = await getDocs(usersQuery);
        const totalUsers = usersSnapshot.size;

        // Récupérer les covoiturages pour la période
        const carpoolingsQuery = query(
          collection(db, 'covoiturages'),
          where('date_depart', '>=', startDate.toISOString().split('T')[0]),
          where('statut', 'in', ['actif', 'en_cours', 'terminé']),
          orderBy('date_depart', 'desc')
        );
        const carpoolingsSnapshot = await getDocs(carpoolingsQuery);

        // Préparer les données pour les graphiques
        const dailyStats = new Map<string, { credits: number; trips: number }>();

        carpoolingsSnapshot.forEach((docSnap) => {
          const trip = docSnap.data();
          if (trip.statut === 'actif' || trip.statut === 'en_cours' || trip.statut === 'terminé') {
            const date = trip.date_depart;
            const stats = dailyStats.get(date) || { credits: 0, trips: 0 };
            stats.trips += 1;
            stats.credits += trip.prix;
            dailyStats.set(date, stats);
          }
        });

        // Ajouter les transactions historiques aux statistiques
        if (historicTransactions) {
          historicTransactions.forEach(transaction => {
            const date = new Date(transaction.date_transaction).toLocaleDateString();
            const stats = dailyStats.get(date) || { credits: 0, trips: 0 };
            stats.credits += transaction.montant;
            dailyStats.set(date, stats);
          });
        }

        const dailyTrips = Array.from(dailyStats.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, stats]) => ({
            date: new Date(date).toLocaleDateString(),
            trips: stats.trips,
            credits: stats.credits
          }));

        setStats({
          totalPlatformCredits: platformCredits,
          totalWaitingCredits: waitingCredits,
          totalUsers,
          dailyTrips,
        });
      } catch (err) {
        setError('Erreur lors du chargement des statistiques');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate, timeRange]);

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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Wallet className="h-8 w-8 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Statistiques des crédits
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setTimeRange('week')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === 'week'
                    ? 'bg-[#3E920B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                7 jours
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === 'month'
                    ? 'bg-[#3E920B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                30 jours
              </button>
              <button
                onClick={() => setTimeRange('year')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === 'year'
                    ? 'bg-[#3E920B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                12 mois
              </button>
              <button
                onClick={() => setTimeRange('creation')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  timeRange === 'creation'
                    ? 'bg-[#3E920B] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Depuis création
              </button>
            </div>
          </div>

          {/* Credit Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#A7DE65]/20 rounded-lg">
                    <Wallet className="w-6 h-6 text-[#3E920B]" />
                  </div>
                  <h2 className="text-lg font-semibold">Crédits plateforme</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-[#3E920B]" />
              </div>
              <p className="text-3xl font-bold mt-4">{stats.totalPlatformCredits} crédits</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Calendar className="w-6 h-6 text-yellow-600" />
                  </div>
                  <h2 className="text-lg font-semibold">Crédits en attente</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold mt-4">{stats.totalWaitingCredits} crédits</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold">Utilisateurs</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold mt-4">{stats.totalUsers}</p>
              <p className="mt-2 text-sm text-gray-500">utilisateurs inscrits</p>
            </div>
          </div>

          {/* Charts */}
          <div>
            {/* Daily Trips Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold mb-6">Nombre de covoiturages par jour</h2>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.dailyTrips}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    reverseStackOrder={false}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="trips" fill="#3E920B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}