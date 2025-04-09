import { createClient } from '@supabase/supabase-js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function migrateCovoiturages() {
  try {
    // Récupérer les covoiturages terminés de Firestore
    const covoituragesQuery = query(
      collection(db, 'covoiturages'),
      where('statut', '==', 'terminé')
    );
    const snapshot = await getDocs(covoituragesQuery);
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Insérer dans Supabase
      const { error } = await supabase
        .from('historique_covoiturages')
        .insert({
          covoiturage_id: doc.id,
          chauffeur_id: data.driver_id,
          passagers_ids: data.passagers_id || [],
          depart_ville: data.depart_ville,
          arrivee_ville: data.arrivee_ville,
          date_depart: data.date_depart,
          date_arrivee: data.date_arrivee,
          prix: data.prix,
          vehicule_plaque: data.vehicule_plaque,
          ecologique: data.ecologique || false,
          statut: data.statut,
          donnees_source: data
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la migration des covoiturages:', error);
    throw error;
  }
}

export async function migrateLitiges() {
  try {
    // Récupérer les litiges résolus de Firestore
    const litigesQuery = query(
      collection(db, 'validations'),
      where('statut', 'in', ['résolu', 'remboursé'])
    );
    const snapshot = await getDocs(litigesQuery);
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Insérer dans Supabase
      const { error } = await supabase
        .from('historique_litiges')
        .insert({
          litige_id: doc.id,
          covoiturage_id: data.covoiturage_id,
          chauffeur_id: data.chauffeur_id,
          passager_id: data.passager_id,
          raison: data.raison_litige,
          resolution: data.statut === 'résolu' ? 'Validé' : 'Remboursé',
          date_creation: data.date_creation,
          date_resolution: data.date_modification
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la migration des litiges:', error);
    throw error;
  }
}

export async function migrateAvis() {
  try {
    // Récupérer tous les avis de Firestore
    const avisSnapshot = await getDocs(collection(db, 'note'));
    
    for (const doc of avisSnapshot.docs) {
      const data = doc.data();
      
      // Insérer dans Supabase
      const { error } = await supabase
        .from('historique_avis')
        .insert({
          avis_id: doc.id,
          chauffeur_id: data.driver_id,
          passager_id: data.passager_id,
          note: data.note,
          commentaire: data.commentaire,
          date_creation: data.date_creation
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la migration des avis:', error);
    throw error;
  }
}

export async function migrateTransactions() {
  try {
    // Récupérer toutes les transactions de Firestore
    const transactionsSnapshot = await getDocs(collection(db, 'credit'));
    
    for (const doc of transactionsSnapshot.docs) {
      const data = doc.data();
      
      // Ne pas migrer les documents spéciaux
      if (['application', 'Attente'].includes(doc.id)) continue;
      
      // Insérer dans Supabase
      const { error } = await supabase
        .from('historique_transactions')
        .insert({
          utilisateur_id: doc.id,
          montant: data.solde,
          type: 'solde',
          description: 'Migration du solde',
          date_transaction: data.date_modification || data.date_creation
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la migration des transactions:', error);
    throw error;
  }
}