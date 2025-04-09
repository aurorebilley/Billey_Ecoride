import { db } from './firebase';
import { supabase } from './supabase';
import { doc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Interfaces pour les différents types de données

// Données de covoiturage
interface CovoiturageData {
  driver_id: string;
  passagers_id: string[];
  depart_ville: string;
  arrivee_ville: string;
  date_depart: string;
  date_arrivee: string;
  prix: number;
  vehicule_plaque: string;
  ecologique: boolean;
  statut: string;
  [key: string]: any;
}

// Données de litige
interface LitigeData {
  chauffeur_id: string;
  passager_id: string;
  covoiturage_id: string;
  raison_litige: string;
  statut: string;
  // Vous pouvez ajouter d'autres champs si nécessaire
  [key: string]: any;
}

// Données d'avis
interface AvisData {
  driver_id: string;
  passager_id: string;
  note: number;
  commentaire?: string;
  [key: string]: any;
}

// Données de transaction
interface TransactionData {
  utilisateur_id: string;
  montant: number;
  type: string;
  description?: string;
  covoiturage_id?: string;
}

/**
 * Synchronise un covoiturage terminé avec l'historique Supabase.
 */
export async function syncCovoiturageTermine(covoiturageId: string, data: CovoiturageData) {
  try {
    // Mise à jour dans Firestore
    await updateDoc(doc(db, 'covoiturages', covoiturageId), {
      ...data,
      date_modification: serverTimestamp(),
    });

    // Ajout dans l'historique Supabase
    const { error } = await supabaseClient
      .from('historique_covoiturages')
      .insert({
        covoiturage_id: covoiturageId,
        chauffeur_id: data.driver_id,
        passagers_ids: data.passagers_id,
        depart_ville: data.depart_ville,
        arrivee_ville: data.arrivee_ville,
        date_depart: data.date_depart,
        date_arrivee: data.date_arrivee,
        prix: data.prix,
        vehicule_plaque: data.vehicule_plaque,
        ecologique: data.ecologique,
        statut: data.statut,
        donnees_source: data,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Erreur lors de la synchronisation du covoiturage:', error);
    throw error;
  }
}

/**
 * Synchronise un litige résolu avec l'historique Supabase.
 */
export async function syncLitigeResolu(litigeId: string, data: LitigeData) {
  try {
    // Format dates properly
    const dateResolution = data.date_resolution || new Date().toISOString();

    // Insert into Supabase historique_litiges
    const { error: supabaseError } = await supabase
      .from('historique_litiges')
      .insert({
        litige_id: litigeId,
        covoiturage_id: data.covoiturage_id,
        chauffeur_id: data.chauffeur_id,
        passager_id: data.passager_id,
        raison: data.raison_litige,
        resolution: data.resolution,
        date_creation: data.date_creation,
        date_resolution: dateResolution,
        employe_id: data.employe_id,
        date_archivage: new Date().toISOString()
      });

    if (supabaseError) throw supabaseError;

    // Update Firestore document
    await updateDoc(doc(db, 'validations', litigeId), {
      ...data,
      date_resolution: serverTimestamp(), 
      employe_id: data.employe_id,
      date_modification: serverTimestamp()
    });
  } catch (err) {
    console.error('Erreur lors de la synchronisation du litige:', err);
    throw err;
  }
}

/**
 * Synchronise un litige en cours avec l'historique Supabase.
 */
export async function syncLitigeEnCours(litigeId: string, data: LitigeData) {
  try {
    // Mise à jour dans Firestore
    await updateDoc(doc(db, 'validations', litigeId), {
      ...data,
      date_modification: serverTimestamp(),
    });

    // Ajout dans l'historique Supabase
    const { error } = await supabaseClient
      .from('historique_litiges')
      .insert({
        litige_id: litigeId,
        covoiturage_id: data.covoiturage_id,
        chauffeur_id: data.chauffeur_id,
        passager_id: data.passager_id,
        raison: data.raison_litige,
        resolution: 'En cours',
        date_creation: data.date_creation,
        date_resolution: null,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Erreur lors de la synchronisation du litige:', error);
    throw error;
  }
}

/**
 * Synchronise un avis avec l'historique Supabase.
 */
export async function syncAvis(avisId: string, data: AvisData) {
  try {
    // Création dans Firestore
    await setDoc(doc(db, 'note', avisId), {
      ...data,
      date_creation: serverTimestamp(),
      date_modification: serverTimestamp(),
    });

    // Ajout dans l'historique Supabase
    const { error } = await supabaseClient
      .from('historique_avis')
      .insert({
        avis_id: avisId,
        chauffeur_id: data.driver_id,
        passager_id: data.passager_id,
        note: data.note,
        commentaire: data.commentaire,
        date_creation: new Date().toISOString(),
      });

    if (error) throw error;
  } catch (error) {
    console.error("Erreur lors de la synchronisation de l'avis:", error);
    throw error;
  }
}

/**
 * Synchronise une transaction avec l'historique Supabase.
 *
 * Pour adapter la synchronisation, cette fonction ajuste le signe du montant en fonction du type de transaction.
 * Par convention :
 * - Pour un paiement (type "paiement_trajet"), le montant est positif.
 * - Pour un remboursement (type "remboursement"), le montant est négatif.
 */
export async function syncTransaction(data: TransactionData) {
  try {
    let adjustedMontant = data.montant;

    if (data.type === 'remboursement') {
      // Si c'est un remboursement, le montant doit être négatif (s'il doit retirer des crédits)
      adjustedMontant = -Math.abs(data.montant);
    } else if (data.type === 'paiement_trajet') {
      // Pour un paiement, le montant sera positif
      adjustedMontant = Math.abs(data.montant);
    }
    // Vous pouvez ajouter d'autres types si nécessaire

    // Insertion dans la table historique_transactions de Supabase
    const { error } = await supabaseClient
      .from('historique_transactions')
      .insert({
        utilisateur_id: data.utilisateur_id,
        montant: adjustedMontant,
        type: data.type,
        description: data.description,
        covoiturage_id: data.covoiturage_id,
        date_transaction: new Date().toISOString(),
      });

    if (error) throw error;
  } catch (err) {
    console.error('Erreur lors de la synchronisation de la transaction:', err);
    throw err;
  }
}