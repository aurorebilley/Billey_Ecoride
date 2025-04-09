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
  deleteDoc,
  addDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  Star,
  Search,
  Filter,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Mail,
  Flag,
  CheckCircle2,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { supabase } from '../lib/supabase';

interface Review {
  id: string;
  driver_id: string;
  passager_id: string;
  covoiturage_id: string;
  note: number;
  commentaire: string;
  date_creation: string;
  signale?: boolean;
  modifie?: boolean;
  raison_modification?: string;
  modifie_par?: string;
  date_modification?: string;
}

interface User {
  pseudo: string;
  adresse_mail: string;
  photo_url?: string;
}

interface Carpooling {
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  heure_depart: string;
}

export function Avis() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<(Review & {
    author?: User;
    driver?: User;
    carpooling?: Carpooling;
  })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'signale'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [modificationReason, setModificationReason] = useState('');

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

        // Get all reviews
        const reviewsQuery = query(
          collection(db, 'note'),
          orderBy('date_creation', 'desc')
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        const reviewsList = [];
        const months = new Set<string>();

        for (const reviewDoc of reviewsSnapshot.docs) {
          const reviewData = reviewDoc.data();
          
          // Get author data
          const authorDoc = await getDoc(doc(db, 'users', reviewData.passager_id));
          const authorData = authorDoc.exists() ? authorDoc.data() : null;

          // Get driver data
          const driverDoc = await getDoc(doc(db, 'users', reviewData.driver_id));
          const driverData = driverDoc.exists() ? driverDoc.data() : null;

          // Get carpooling data
          const carpoolingDoc = await getDoc(doc(db, 'covoiturages', reviewData.covoiturage_id));
          const carpoolingData = carpoolingDoc.exists() ? carpoolingDoc.data() : null;

          // Add month to available months
          const date = reviewData.date_creation?.toDate?.()
            ? reviewData.date_creation.toDate()
            : new Date(reviewData.date_creation);
          const monthKey = date.toISOString().slice(0, 7);
          months.add(monthKey);

          reviewsList.push({
            id: reviewDoc.id,
            ...reviewData,
            author: authorData,
            driver: driverData,
            carpooling: carpoolingData,
          });
        }

        setReviews(reviewsList);
        setAvailableMonths(Array.from(months).sort().reverse());
      } catch (err) {
        setError('Erreur lors du chargement des avis');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleDeleteReview = async () => {
    if (!selectedReview) return;

    const avisId = crypto.randomUUID();
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Supprimer l'avis de Firestore
      await deleteDoc(doc(db, 'note', selectedReview.id));

      // Archiver l'avis dans Supabase
      const { error: supabaseError } = await supabase
        .from('historique_avis')
        .insert({
          avis_id: selectedReview.id,
          chauffeur_id: selectedReview.driver_id,
          passager_id: selectedReview.passager_id,
          note: selectedReview.note,
          commentaire: selectedReview.commentaire,
          date_creation: selectedReview.date_creation
        });

      if (supabaseError) throw supabaseError;

      // Enregistrer l'action administrative
      await addDoc(collection(db, 'administration'), {
        employe_id: currentUser.uid,
        date_action: serverTimestamp(),
        action: 'Suppression d\'un avis',
        avis_id: selectedReview.id,
        avis_initial: selectedReview.commentaire,
        utilisateur_cible: {
          pseudo: selectedReview.author?.pseudo,
          email: selectedReview.author?.adresse_mail
        }
      });

      // Mettre à jour l'état local
      // Update local state
      setReviews(prev => prev.filter(review => review.id !== selectedReview.id));
      setShowDeleteModal(false);
      setSelectedReview(null);
    } catch (err) {
      setError('Erreur lors de la suppression de l\'avis');
      console.error(err);
    }
  };

  const handleEditReview = async () => {
    if (!selectedReview) return;

    const avisId = crypto.randomUUID();
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Mettre à jour l'avis dans Firestore
      await updateDoc(doc(db, 'note', selectedReview.id), {
        commentaire: editedComment,
        modifie: true,
        modifie_par: currentUser.email,
        raison_modification: modificationReason,
        date_modification: serverTimestamp()
      });

      // Archiver la nouvelle version dans Supabase
      const { error: supabaseError } = await supabase
        .from('historique_avis')
        .insert({
          avis_id: selectedReview.id,
          chauffeur_id: selectedReview.driver_id,
          passager_id: selectedReview.passager_id,
          note: selectedReview.note,
          commentaire: editedComment,
          date_creation: selectedReview.date_creation,
          date_archivage: new Date().toISOString()
        });

      if (supabaseError) throw supabaseError;

      // Enregistrer l'action administrative
      await addDoc(collection(db, 'administration'), {
        employe_id: currentUser.uid,
        date_action: serverTimestamp(),
        action: 'Modification d\'un avis',
        avis_id: selectedReview.id,
        avis_initial: selectedReview.commentaire,
        avis_modifie: editedComment,
        raison_modification: modificationReason,
        utilisateur_cible: {
          pseudo: selectedReview.author?.pseudo,
          email: selectedReview.author?.adresse_mail
        }
      });

      // Update local state
      setReviews(prev => prev.map(review =>
        review.id === selectedReview.id
          ? {
              ...review,
              commentaire: editedComment,
              modifie: true,
              modifie_par: currentUser.email,
              raison_modification: modificationReason,
              date_modification: new Date().toISOString()
            }
          : review
      ));

      setShowEditModal(false);
      setSelectedReview(null);
      setEditedComment('');
      setModificationReason('');
    } catch (err) {
      setError('Erreur lors de la modification de l\'avis');
      console.error(err);
    }
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = 
      review.author?.pseudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.driver?.pseudo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.commentaire.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRating = 
      ratingFilter === 'all' ||
      review.note === ratingFilter;

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'signale' && review.signale) ||
      (statusFilter === 'normal' && !review.signale);

    // Handle date comparison safely
    const reviewDate = review.date_creation?.toDate?.()
      ? review.date_creation.toDate()
      : new Date(review.date_creation);
    const reviewMonth = reviewDate.toISOString().slice(0, 7);
    const matchesMonth = reviewMonth === selectedMonth;

    return matchesSearch && matchesRating && matchesStatus && matchesMonth;
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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Star className="h-8 w-8 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Gestion des avis
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                >
                  <option value="all">Toutes les notes</option>
                  <option value="1">1 étoile</option>
                  <option value="2">2 étoiles</option>
                  <option value="3">3 étoiles</option>
                  <option value="4">4 étoiles</option>
                  <option value="5">5 étoiles</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="normal">Normal</option>
                  <option value="signale">Signalé</option>
                </select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher un avis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                />
              </div>
            </div>
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
            {filteredReviews.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <p className="text-gray-500">Aucun avis trouvé</p>
              </div>
            ) : (
              filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white rounded-xl shadow-lg overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                            {review.author?.photo_url ? (
                              <img
                                src={review.author.photo_url}
                                alt={review.author.pseudo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-xl font-bold">
                                {review.author?.pseudo.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{review.author?.pseudo}</p>
                            <div className="flex items-center space-x-1 text-sm text-gray-500">
                              <Mail className="w-4 h-4" />
                              <span>{review.author?.adresse_mail}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-gray-400 mx-4">→</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                            {review.driver?.photo_url ? (
                              <img
                                src={review.driver.photo_url}
                                alt={review.driver.pseudo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#A7DE65] text-[#3E920B] text-xl font-bold">
                                {review.driver?.pseudo.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{review.driver?.pseudo}</p>
                            <div className="flex items-center space-x-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="text-sm text-gray-500">
                                {review.note}/5
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {review.signale && (
                          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center space-x-1">
                            <Flag className="w-4 h-4" />
                            <span>Signalé</span>
                          </span>
                        )}
                        {review.modifie && (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium flex items-center space-x-1">
                            <Pencil className="w-4 h-4" />
                            <span>Modifié</span>
                          </span>
                        )}
                        <button
                          onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          {expandedReview === review.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {review.date_creation?.toDate?.()
                            ? review.date_creation.toDate().toLocaleDateString()
                            : new Date(review.date_creation).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {review.date_creation?.toDate?.()
                            ? review.date_creation.toDate().toLocaleTimeString()
                            : new Date(review.date_creation).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {expandedReview === review.id && (
                      <div className="mt-6 space-y-6 border-t pt-6">
                        <div>
                          <h3 className="font-medium mb-2">Commentaire</h3>
                          <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">
                            {review.commentaire}
                          </p>
                        </div>

                        {review.modifie && (
                          <div>
                            <h3 className="font-medium mb-2">Historique de modification</h3>
                            <div className="bg-yellow-50 p-4 rounded-lg space-y-2">
                              <p className="text-sm text-yellow-800">
                                <span className="font-medium">Modifié par :</span> {review.modifie_par}
                              </p>
                              <p className="text-sm text-yellow-800">
                                <span className="font-medium">Raison :</span> {review.raison_modification}
                              </p>
                              <p className="text-sm text-yellow-800">
                                <span className="font-medium">Date :</span>{' '}
                                {review.date_modification?.toDate?.()
                                  ? review.date_modification.toDate().toLocaleString()
                                  : new Date(review.date_modification || '').toLocaleString()}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4">
                          <button
                            onClick={() => {
                              setSelectedReview(review);
                              setEditedComment(review.commentaire);
                              setShowEditModal(true);
                            }}
                            className="flex-1 py-2 px-4 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReview(review);
                              setShowDeleteModal(true);
                            }}
                            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Pencil className="h-6 w-6 text-[#3E920B]" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Modifier l'avis
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commentaire
                </label>
                <textarea
                  value={editedComment}
                  onChange={(e) => setEditedComment(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raison de la modification
                </label>
                <textarea
                  value={modificationReason}
                  onChange={(e) => setModificationReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  placeholder="Expliquez pourquoi vous modifiez cet avis..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedReview(null);
                  setEditedComment('');
                  setModificationReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleEditReview}
                disabled={!editedComment.trim() || !modificationReason.trim()}
                className="px-4 py-2 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Supprimer l'avis
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer cet avis ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedReview(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteReview}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}