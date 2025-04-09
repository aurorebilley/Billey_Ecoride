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
  BarChart3,
  TrendingUp,
  Users,
  Car,
  Zap,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Stats {
  totalTrips: number;
  dailyTrips: Array<{
    date: string;
    trips: number;
  }>;
  averageOccupancy: number;
  ecoTripsPercentage: number;
  recentTrips: Array<{
    id: string;
    driver: {
      pseudo: string;
      email: string;
      photo_url?: string;
    };
    passengers: number;
    date: string;
    time: string;
    status: string;
  }>;
}

export function CovoiturageStat() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year' | 'creation'>('week');
  const [stats, setStats] = useState<Stats>({
    totalTrips: 0,
    dailyTrips: [],
    averageOccupancy: 0,
    ecoTripsPercentage: 0,
    recentTrips: [],
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

        // Calculer la plage de dates
        const now = new Date();
        const startDate = new Date();
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
            startDate.setTime(new Date('2025-03-10').getTime());
            break;
        }

        // Récupérer tous les covoiturages
        const carpoolingsQuery = query(
          collection(db, 'covoiturages'),
          where('date_depart', '>=', startDate.toISOString().split('T')[0]),
          where('statut', 'in', ['actif', 'en_cours']),
          orderBy('date_depart', 'desc')
        );
        const carpoolingsSnapshot = await getDocs(carpoolingsQuery);

        // Récupérer l'historique des covoiturages depuis Supabase
        const { data: historicCarpoolings, error: supabaseError } = await supabase
          .from('historique_covoiturages')
          .select('*')
          .gte('date_depart', startDate.toISOString())
          .order('date_depart', { ascending: false });

        if (supabaseError) throw supabaseError;

        let totalTrips = 0;
        let totalOccupancyRate = 0;
        let ecoTrips = 0;
        const dailyStats = new Map<string, number>();
        const recentTrips = [];
        const trips = [...carpoolingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];

        // Ajouter les trajets historiques
        if (historicCarpoolings) {
          historicCarpoolings.forEach(trip => {
            trips.push({
              id: trip.covoiturage_id,
              driver_id: trip.chauffeur_id,
              passagers_id: trip.passagers_ids,
              date_depart: trip.date_depart,
              ecologique: trip.ecologique,
              statut: trip.statut,
              vehicule_plaque: trip.vehicule_plaque,
              ...trip.donnees_source
            });
          });
        }

        // Traiter les trajets
        for (const trip of trips) {
          // Incrémenter le total des trajets
          totalTrips++;
          
          // Compter les trajets écologiques
          if (trip.ecologique) {
            ecoTrips++;
          }

          // Récupérer les données du véhicule pour obtenir le nombre de places
          const vehicleDoc = await getDoc(doc(db, 'vehicules', trip.vehicule_plaque));
          if (vehicleDoc.exists()) {
            const vehicleData = vehicleDoc.data();
            const passengers = trip.passagers_id?.length || 0;
            const occupancyRate = (passengers / vehicleData.places) * 100;
            totalOccupancyRate += occupancyRate;
          }

          // Grouper les trajets par date
          const date = new Date(trip.date_depart).toLocaleDateString();
          dailyStats.set(date, (dailyStats.get(date) || 0) + 1);

          // Récupérer les informations des derniers trajets
          if (recentTrips.length < 3 && (trip.statut === 'actif' || trip.statut === 'en_cours' || trip.statut === 'terminé')) {
            const driverRef = doc(db, 'users', trip.driver_id);
            const driverDoc = await getDoc(driverRef);
            const driverData = driverDoc.data();
            
            const passengers = trip.passagers_id?.length || 0;
            recentTrips.push({
              id: trip.id, // Correction ici : utilisation de trip.id
              driver: {
                pseudo: driverData?.pseudo || '',
                email: driverData?.adresse_mail || '',
                photo_url: driverData?.photo_url,
              },
              passengers: passengers,
              date: trip.date_depart,
              time: trip.heure_depart,
              status: trip.statut,
            });
          }
        }

        // Convertir et trier les statistiques quotidiennes
        const dailyTrips = Array.from(dailyStats.entries())
          .map(([date, count]) => ({ date, trips: count }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .reverse();

        setStats({
          totalTrips,
          dailyTrips,
          averageOccupancy: totalTrips > 0 ? Math.round(totalOccupancyRate / totalTrips) : 0,
          ecoTripsPercentage: totalTrips > 0 ? Math.round((ecoTrips / totalTrips) * 100) : 0,
          recentTrips,
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
              <BarChart3 className="h-8 w-8 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Statistiques des covoiturages
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

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-[#A7DE65]/20 rounded-lg">
                    <Car className="w-6 h-6 text-[#3E920B]" />
                  </div>
                  <h2 className="text-lg font-semibold">Total trajets</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-[#3E920B]" />
              </div>
              <p className="text-3xl font-bold mt-4">{stats.totalTrips}</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold">Taux de remplissage</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold mt-4">{Math.round(stats.averageOccupancy)}%</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Zap className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-lg font-semibold">Trajets écologiques</h2>
                </div>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold mt-4">{Math.round(stats.ecoTripsPercentage)}%</p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Daily Trips Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold mb-6">Nombre de trajets par jour</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dailyTrips}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="trips" fill="#3E920B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Eco vs Non-Eco Trips */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold mb-6">Répartition des trajets écologiques</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Écologique', value: stats.ecoTripsPercentage, display: `${Math.round(stats.ecoTripsPercentage)}%` },
                        { name: 'Standard', value: 100 - stats.ecoTripsPercentage, display: `${Math.round(100 - stats.ecoTripsPercentage)}%` },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ display }) => display}
                      labelLine={false}
                    >
                      <Cell key="cell-ecologique" fill="#3E920B" />
                      <Cell key="cell-standard" fill="#E5E7EB" />
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${Math.round(value)}%`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Trips Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">3 derniers trajets</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chauffeur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passagers
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentTrips.map((trip) => (
                    <tr key={trip.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                              {trip.driver.photo_url ? (
                                <img
                                  src={trip.driver.photo_url}
                                  alt={trip.driver.pseudo}
                                  className="h-10 w-10 object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 flex items-center justify-center bg-[#A7DE65] text-[#3E920B] font-bold">
                                  {trip.driver.pseudo.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {trip.driver.pseudo}
                            </div>
                            <div className="text-sm text-gray-500">
                              {trip.driver.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {trip.passengers}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(trip.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">{trip.time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {trip.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
