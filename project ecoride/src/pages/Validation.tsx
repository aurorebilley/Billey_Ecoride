import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MapPin,
  Calendar,
  Clock,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { syncCovoiturageTermine } from '../lib/sync';

interface Validation {
  id: string;
  chauffeur_id: string;
  passager_id: string;
  statut: 'non validé' | 'litige';
  date_creation: string;
}

interface Driver {
  pseudo: string;
  photo_url?: string;
}

interface Carpooling {
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
}

export function Validation() {
  const navigate = useNavigate();
  const [validations, setValidations] = useState<(Validation & { driver?: Driver, carpooling?: Carpooling })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/connexion');
        return;
      }

      try {
        // Check if user is a passenger
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || !userDoc.data().roles?.includes('passager')) {
          setError('Accès non autorisé');
          return;
        }

        // Get validations for the user
        const validationsQuery = query(
          collection(db, 'validations'),
          where('passager_id', '==', user.uid),
          where('statut', 'in', ['non validé', 'litige'])
        );

        const validationsSnapshot = await getDocs(validationsQuery);
        const validationsList = [];

        for (const validationDoc of validationsSnapshot.docs) {
          const validationData = validationDoc.data();
          
          // Get driver info
          const driverDoc = await getDoc(doc(db, 'users', validationData.chauffeur_id));
          const driverData = driverDoc.exists() ? driverDoc.data() : null;

          // Get carpooling info
          const carpoolingQuery = query(
            collection(db, 'covoiturages'),
            where('driver_id', '==', validationData.chauffeur_id),
            where('passagers_id', 'array-contains', user.uid),
            where('statut', '==', 'terminé')
          );
          const carpoolingSnapshot = await getDocs(carpoolingQuery);
          const carpoolingData = carpoolingSnapshot.docs[0]?.data();

          validationsList.push({
            id: validationDoc.id,
            ...validationData,
            driver: driverData,
            carpooling: carpoolingData,
          });
        }

        setValidations(validationsList);
      } catch (err) {
        setError('Erreur lors du chargement des validations');
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
        <div className="max-w-3xl mx-auto">
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
    <main className="flex-grow container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h1 className="text-3xl font-bold text-[#333333] mb-6">
            Validations en attente
          </h1>

          {validations.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Aucune validation en attente
            </p>
          ) : (
            <div className="space-y-4">
              {validations.map((validation) => (
                <div
                  key={validation.id}
                  onClick={() => navigate(`/validation/${validation.id}`)}
                  className="border border-gray-200 rounded-lg p-4 hover:border-[#3E920B] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                        {validation.driver?.photo_url ? (
                          <img
                            src={validation.driver.photo_url}
                            alt={validation.driver.pseudo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-xl font-bold">
                            {validation.driver?.pseudo?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {validation.driver?.pseudo}
                        </h3>
                      </div>
                    </div>
                    {validation.statut === 'non validé' ? (
                      <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">À valider</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 rounded-full">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">Litige</span>
                      </div>
                    )}
                  </div>

                  {validation.carpooling && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-5 h-5 text-[#3E920B]" />
                          <span className="font-semibold">
                            {new Date(validation.carpooling.date_depart).toLocaleDateString()}
                          </span>
                          <Clock className="w-5 h-5 text-[#3E920B] ml-2" />
                          <span>{validation.carpooling.heure_depart}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-gray-600">
                        <MapPin className="w-5 h-5 text-[#3E920B]" />
                        <span>
                          {validation.carpooling.depart_ville} → {validation.carpooling.arrivee_ville}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}