-- =============================================
-- SCRIPT DE MIGRATION ECORIDE VERS POSTGRESQL
-- =============================================

-- Ce script crée une structure de base de données relationnelle
-- pour remplacer l'architecture hybride Firebase/Supabase
-- =============================================

-- Suppression des tables existantes si nécessaire
DROP TABLE IF EXISTS historique_actions_litige CASCADE;
DROP TABLE IF EXISTS historique_avis CASCADE;
DROP TABLE IF EXISTS historique_litiges CASCADE;
DROP TABLE IF EXISTS historique_transactions CASCADE;
DROP TABLE IF EXISTS historique_covoiturages CASCADE;
DROP TABLE IF EXISTS validations CASCADE;
DROP TABLE IF EXISTS avis CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS participations CASCADE;
DROP TABLE IF EXISTS covoiturages CASCADE;
DROP TABLE IF EXISTS vehicules CASCADE;
DROP TABLE IF EXISTS credits CASCADE;
DROP TABLE IF EXISTS utilisateurs CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- =============================================
-- TABLES DE BASE
-- =============================================

-- Table des rôles utilisateurs
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des utilisateurs
CREATE TABLE utilisateurs (
    id VARCHAR(50) PRIMARY KEY, -- ID Firebase Auth
    pseudo VARCHAR(100) NOT NULL,
    adresse_mail VARCHAR(255) NOT NULL UNIQUE,
    role_id INTEGER REFERENCES roles(id),
    photo_url TEXT,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif', -- actif, bloqué
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des sous-rôles utilisateurs (chauffeur, passager)
CREATE TABLE utilisateur_roles (
    utilisateur_id VARCHAR(50) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- chauffeur, passager
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (utilisateur_id, role)
);

-- Table des crédits
CREATE TABLE credits (
    utilisateur_id VARCHAR(50) PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
    solde INTEGER NOT NULL DEFAULT 0,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des véhicules
CREATE TABLE vehicules (
    plaque VARCHAR(10) PRIMARY KEY,
    utilisateur_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    marque VARCHAR(100) NOT NULL,
    modele VARCHAR(100) NOT NULL,
    couleur VARCHAR(50) NOT NULL,
    places INTEGER NOT NULL DEFAULT 4,
    electrique BOOLEAN NOT NULL DEFAULT FALSE,
    date_immatriculation DATE,
    fumeur_accepte BOOLEAN NOT NULL DEFAULT FALSE,
    animaux_acceptes BOOLEAN NOT NULL DEFAULT FALSE,
    musique_acceptee BOOLEAN NOT NULL DEFAULT FALSE,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TABLES MÉTIER
-- =============================================

-- Table des covoiturages
CREATE TABLE covoiturages (
    id VARCHAR(50) PRIMARY KEY, -- ID généré par l'application
    chauffeur_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    vehicule_plaque VARCHAR(10) NOT NULL REFERENCES vehicules(plaque) ON DELETE CASCADE,
    depart_rue TEXT NOT NULL,
    depart_code_postal VARCHAR(10) NOT NULL,
    depart_ville VARCHAR(100) NOT NULL,
    arrivee_rue TEXT NOT NULL,
    arrivee_code_postal VARCHAR(10) NOT NULL,
    arrivee_ville VARCHAR(100) NOT NULL,
    date_depart DATE NOT NULL,
    heure_depart TIME NOT NULL,
    date_arrivee DATE NOT NULL,
    heure_arrivee TIME NOT NULL,
    prix INTEGER NOT NULL,
    ecologique BOOLEAN NOT NULL DEFAULT FALSE,
    statut VARCHAR(20) NOT NULL DEFAULT 'actif', -- actif, en_cours, terminé, inactif
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des participations (passagers)
CREATE TABLE participations (
    covoiturage_id VARCHAR(50) REFERENCES covoiturages(id) ON DELETE CASCADE,
    passager_id VARCHAR(50) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    statut VARCHAR(20) NOT NULL DEFAULT 'confirmé', -- confirmé, annulé
    prix_payé INTEGER NOT NULL, -- prix + frais de service
    date_reservation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (covoiturage_id, passager_id)
);

-- Table des transactions
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    utilisateur_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    montant INTEGER NOT NULL, -- positif pour crédit, négatif pour débit
    type VARCHAR(50) NOT NULL, -- paiement_trajet, remboursement, ajout_admin, etc.
    description TEXT,
    covoiturage_id VARCHAR(50) REFERENCES covoiturages(id) ON DELETE SET NULL,
    date_transaction TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des avis
CREATE TABLE avis (
    id VARCHAR(50) PRIMARY KEY, -- ID généré par l'application
    chauffeur_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    passager_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    covoiturage_id VARCHAR(50) NOT NULL REFERENCES covoiturages(id) ON DELETE CASCADE,
    note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
    commentaire TEXT,
    signale BOOLEAN NOT NULL DEFAULT FALSE,
    modifie BOOLEAN NOT NULL DEFAULT FALSE,
    modifie_par VARCHAR(50) REFERENCES utilisateurs(id) ON DELETE SET NULL,
    raison_modification TEXT,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des validations et litiges
CREATE TABLE validations (
    id VARCHAR(50) PRIMARY KEY, -- ID généré par l'application
    chauffeur_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    passager_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    covoiturage_id VARCHAR(50) NOT NULL REFERENCES covoiturages(id) ON DELETE CASCADE,
    statut VARCHAR(20) NOT NULL, -- non validé, validé, litige, résolu, remboursé
    raison_litige TEXT,
    decision_par VARCHAR(50) REFERENCES utilisateurs(id) ON DELETE SET NULL,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_resolution TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- TABLES D'HISTORIQUE
-- =============================================

-- Historique des covoiturages
CREATE TABLE historique_covoiturages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    covoiturage_id VARCHAR(50) NOT NULL,
    chauffeur_id VARCHAR(50) NOT NULL,
    passagers_ids TEXT[] NOT NULL,
    depart_ville VARCHAR(100) NOT NULL,
    arrivee_ville VARCHAR(100) NOT NULL,
    date_depart TIMESTAMP WITH TIME ZONE NOT NULL,
    date_arrivee TIMESTAMP WITH TIME ZONE NOT NULL,
    prix INTEGER NOT NULL,
    vehicule_plaque VARCHAR(10) NOT NULL,
    ecologique BOOLEAN NOT NULL DEFAULT FALSE,
    statut VARCHAR(20) NOT NULL,
    date_archivage TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    donnees_source JSONB NOT NULL
);

-- Historique des transactions
CREATE TABLE historique_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id VARCHAR(50) NOT NULL,
    montant INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    covoiturage_id VARCHAR(50),
    date_transaction TIMESTAMP WITH TIME ZONE NOT NULL,
    date_archivage TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historique des litiges
CREATE TABLE historique_litiges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    litige_id VARCHAR(50) NOT NULL,
    covoiturage_id VARCHAR(50) NOT NULL,
    chauffeur_id VARCHAR(50) NOT NULL,
    passager_id VARCHAR(50) NOT NULL,
    raison TEXT NOT NULL,
    resolution VARCHAR(50) NOT NULL,
    employe_id VARCHAR(50),
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL,
    date_resolution TIMESTAMP WITH TIME ZONE,
    date_archivage TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historique des avis
CREATE TABLE historique_avis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avis_id VARCHAR(50) NOT NULL,
    chauffeur_id VARCHAR(50) NOT NULL,
    passager_id VARCHAR(50) NOT NULL,
    note INTEGER NOT NULL,
    commentaire TEXT,
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL,
    date_archivage TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historique des actions sur les litiges
CREATE TABLE historique_actions_litige (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    litige_id VARCHAR(50) NOT NULL,
    employe_id VARCHAR(50) NOT NULL,
    employe_pseudo VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    date_action TIMESTAMP WITH TIME ZONE NOT NULL,
    date_archivage TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des actions administratives
CREATE TABLE administration (
    id SERIAL PRIMARY KEY,
    employe_id VARCHAR(50) NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    date_action TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action VARCHAR(100) NOT NULL,
    utilisateur_cible JSONB,
    details TEXT
);

-- =============================================
-- TABLES SPÉCIALES
-- =============================================

-- Table des crédits système
CREATE TABLE credits_systeme (
    id VARCHAR(20) PRIMARY KEY, -- 'application', 'Attente'
    solde INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    date_creation TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modification TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INSERTION DES DONNÉES INITIALES
-- =============================================

-- Insertion des rôles
INSERT INTO roles (nom, description) VALUES
('user', 'Utilisateur standard de la plateforme'),
('administrateur', 'Administrateur avec tous les droits'),
('employé', 'Employé de la plateforme');

-- Insertion des crédits système
INSERT INTO credits_systeme (id, solde, description) VALUES
('application', 0, 'Crédits détenus par la plateforme'),
('Attente', 0, 'Crédits en attente de validation');

-- =============================================
-- EXEMPLES DE DONNÉES
-- =============================================

-- Exemples d'utilisateurs
INSERT INTO utilisateurs (id, pseudo, adresse_mail, role_id, statut) VALUES
('user1', 'JeanDupont', 'jean.dupont@example.com', (SELECT id FROM roles WHERE nom = 'user'), 'actif'),
('user2', 'MarieLemoine', 'marie.lemoine@example.com', (SELECT id FROM roles WHERE nom = 'user'), 'actif'),
('user3', 'PierreDurand', 'pierre.durand@example.com', (SELECT id FROM roles WHERE nom = 'user'), 'actif'),
('admin1', 'AdminPrincipal', 'admin@ecoride.com', (SELECT id FROM roles WHERE nom = 'administrateur'), 'actif'),
('emp1', 'EmployeSupport', 'support@ecoride.com', (SELECT id FROM roles WHERE nom = 'employé'), 'actif');

-- Exemples de sous-rôles
INSERT INTO utilisateur_roles (utilisateur_id, role) VALUES
('user1', 'chauffeur'),
('user1', 'passager'),
('user2', 'passager'),
('user3', 'chauffeur');

-- Exemples de crédits
INSERT INTO credits (utilisateur_id, solde) VALUES
('user1', 100),
('user2', 50),
('user3', 75),
('admin1', 1000),
('emp1', 500);

-- Exemples de véhicules
INSERT INTO vehicules (plaque, utilisateur_id, marque, modele, couleur, places, electrique, fumeur_accepte, animaux_acceptes, musique_acceptee) VALUES
('AB-123-CD', 'user1', 'Renault', 'Zoe', 'Bleu', 4, TRUE, FALSE, TRUE, TRUE),
('EF-456-GH', 'user3', 'Peugeot', '208', 'Rouge', 5, FALSE, TRUE, FALSE, TRUE);

-- Exemples de covoiturages
INSERT INTO covoiturages (id, chauffeur_id, vehicule_plaque, depart_rue, depart_code_postal, depart_ville, arrivee_rue, arrivee_code_postal, arrivee_ville, date_depart, heure_depart, date_arrivee, heure_arrivee, prix, ecologique, statut) VALUES
('covoit1', 'user1', 'AB-123-CD', '10 Rue de la Liberté', '75001', 'Paris', '5 Place Bellecour', '69002', 'Lyon', '2025-04-15', '08:00:00', '2025-04-15', '14:00:00', 25, TRUE, 'actif'),
('covoit2', 'user3', 'EF-456-GH', '15 Avenue des Champs-Élysées', '75008', 'Paris', '20 Rue du Vieux Port', '13001', 'Marseille', '2025-04-20', '09:30:00', '2025-04-20', '17:30:00', 35, FALSE, 'actif'),
('covoit3', 'user1', 'AB-123-CD', '8 Rue de la République', '69001', 'Lyon', '12 Rue de la Paix', '75002', 'Paris', '2025-04-25', '10:00:00', '2025-04-25', '16:00:00', 30, TRUE, 'actif');

-- Exemples de participations
INSERT INTO participations (covoiturage_id, passager_id, prix_payé) VALUES
('covoit1', 'user2', 27), -- 25 + 2 frais de service
('covoit2', 'user1', 37), -- 35 + 2 frais de service
('covoit3', 'user2', 32); -- 30 + 2 frais de service

-- Exemples de transactions
INSERT INTO transactions (utilisateur_id, montant, type, description, covoiturage_id) VALUES
('user1', 20, 'inscription', 'Crédits offerts à l\'inscription', NULL),
('user2', 20, 'inscription', 'Crédits offerts à l\'inscription', NULL),
('user3', 20, 'inscription', 'Crédits offerts à l\'inscription', NULL),
('user2', -27, 'paiement_trajet', 'Paiement du trajet Paris-Lyon', 'covoit1'),
('user1', -37, 'paiement_trajet', 'Paiement du trajet Paris-Marseille', 'covoit2'),
('user2', -32, 'paiement_trajet', 'Paiement du trajet Lyon-Paris', 'covoit3'),
('user1', 25, 'validation_trajet', 'Validation du trajet Paris-Lyon', 'covoit1'),
('user3', 35, 'validation_trajet', 'Validation du trajet Paris-Marseille', 'covoit2');

-- Exemples d'avis
INSERT INTO avis (id, chauffeur_id, passager_id, covoiturage_id, note, commentaire) VALUES
('avis1', 'user1', 'user2', 'covoit1', 5, 'Excellent conducteur, très ponctuel et sympathique.'),
('avis2', 'user3', 'user1', 'covoit2', 4, 'Bonne expérience, conduite agréable.'),
('avis3', 'user1', 'user2', 'covoit3', 5, 'Toujours aussi agréable, je recommande !');

-- Exemples de validations
INSERT INTO validations (id, chauffeur_id, passager_id, covoiturage_id, statut) VALUES
('valid1', 'user1', 'user2', 'covoit1', 'validé'),
('valid2', 'user3', 'user1', 'covoit2', 'validé'),
('valid3', 'user1', 'user2', 'covoit3', 'non validé');

-- Exemple de litige
INSERT INTO validations (id, chauffeur_id, passager_id, covoiturage_id, statut, raison_litige) VALUES
('litige1', 'user3', 'user2', 'covoit2', 'litige', 'Le chauffeur n\'est jamais venu au point de rendez-vous.');

-- Exemples d'historique de covoiturages
INSERT INTO historique_covoiturages (covoiturage_id, chauffeur_id, passagers_ids, depart_ville, arrivee_ville, date_depart, date_arrivee, prix, vehicule_plaque, ecologique, statut, donnees_source) VALUES
('covoit_old1', 'user1', ARRAY['user2'], 'Nantes', 'Rennes', '2025-03-15 08:00:00+00', '2025-03-15 10:00:00+00', 15, 'AB-123-CD', TRUE, 'terminé', 
 '{"driver_id": "user1", "passagers_id": ["user2"], "depart_ville": "Nantes", "arrivee_ville": "Rennes", "date_depart": "2025-03-15", "heure_depart": "08:00:00", "date_arrivee": "2025-03-15", "heure_arrivee": "10:00:00", "prix": 15, "vehicule_plaque": "AB-123-CD", "ecologique": true, "statut": "terminé"}'::jsonb);

-- Exemples d'historique de transactions
INSERT INTO historique_transactions (utilisateur_id, montant, type, description, covoiturage_id, date_transaction) VALUES
('user1', 15, 'paiement_trajet', 'Paiement validé pour trajet Nantes-Rennes', 'covoit_old1', '2025-03-15 10:30:00+00'),
('user2', -17, 'paiement_trajet', 'Paiement du trajet Nantes-Rennes', 'covoit_old1', '2025-03-14 18:45:00+00');

-- Exemples d'historique de litiges
INSERT INTO historique_litiges (litige_id, covoiturage_id, chauffeur_id, passager_id, raison, resolution, employe_id, date_creation, date_resolution) VALUES
('litige_old1', 'covoit_old1', 'user1', 'user2', 'Retard important', 'Validé', 'emp1', '2025-03-16 09:00:00+00', '2025-03-17 14:30:00+00');

-- Exemples d'historique d'avis
INSERT INTO historique_avis (avis_id, chauffeur_id, passager_id, note, commentaire, date_creation) VALUES
('avis_old1', 'user1', 'user2', 4, 'Bon trajet malgré le retard', '2025-03-17 15:00:00+00');

-- Exemples d'actions administratives
INSERT INTO administration (employe_id, action, utilisateur_cible, details) VALUES
('emp1', 'Résolution d''un litige', '{"pseudo": "JeanDupont", "email": "jean.dupont@example.com"}'::jsonb, 'Litige résolu en faveur du chauffeur'),
('admin1', 'Ajout de crédits', '{"pseudo": "MarieLemoine", "email": "marie.lemoine@example.com"}'::jsonb, 'Ajout de 20 crédits suite à un problème technique');

-- =============================================
-- VUES UTILES
-- =============================================

-- Vue des utilisateurs avec leurs rôles
CREATE OR REPLACE VIEW vue_utilisateurs AS
SELECT 
    u.id, 
    u.pseudo, 
    u.adresse_mail, 
    r.nom AS role_principal,
    ARRAY_AGG(ur.role) AS sous_roles,
    u.photo_url,
    u.statut,
    c.solde AS credits,
    u.date_creation
FROM 
    utilisateurs u
JOIN 
    roles r ON u.role_id = r.id
LEFT JOIN 
    utilisateur_roles ur ON u.id = ur.utilisateur_id
LEFT JOIN 
    credits c ON u.id = c.utilisateur_id
GROUP BY 
    u.id, r.nom, c.solde;

-- Vue des covoiturages actifs avec informations complètes
CREATE OR REPLACE VIEW vue_covoiturages_actifs AS
SELECT 
    c.id,
    c.chauffeur_id,
    u.pseudo AS chauffeur_pseudo,
    u.photo_url AS chauffeur_photo,
    c.vehicule_plaque,
    v.marque AS vehicule_marque,
    v.modele AS vehicule_modele,
    v.couleur AS vehicule_couleur,
    v.places AS vehicule_places,
    v.electrique AS vehicule_electrique,
    c.depart_ville,
    c.arrivee_ville,
    c.date_depart,
    c.heure_depart,
    c.date_arrivee,
    c.heure_arrivee,
    c.prix,
    c.ecologique,
    c.statut,
    (SELECT COUNT(*) FROM participations p WHERE p.covoiturage_id = c.id AND p.statut = 'confirmé') AS places_reservees,
    (v.places - (SELECT COUNT(*) FROM participations p WHERE p.covoiturage_id = c.id AND p.statut = 'confirmé')) AS places_disponibles
FROM 
    covoiturages c
JOIN 
    utilisateurs u ON c.chauffeur_id = u.id
JOIN 
    vehicules v ON c.vehicule_plaque = v.plaque
WHERE 
    c.statut IN ('actif', 'en_cours');

-- Vue des statistiques par utilisateur
CREATE OR REPLACE VIEW vue_statistiques_utilisateurs AS
SELECT 
    u.id,
    u.pseudo,
    COUNT(DISTINCT c.id) AS nombre_trajets_chauffeur,
    COUNT(DISTINCT p.covoiturage_id) AS nombre_trajets_passager,
    COALESCE(AVG(a.note), 0) AS note_moyenne,
    COUNT(DISTINCT a.id) AS nombre_avis,
    cr.solde AS credits_actuels
FROM 
    utilisateurs u
LEFT JOIN 
    covoiturages c ON u.id = c.chauffeur_id
LEFT JOIN 
    participations p ON u.id = p.passager_id
LEFT JOIN 
    avis a ON u.id = a.chauffeur_id
LEFT JOIN 
    credits cr ON u.id = cr.utilisateur_id
GROUP BY 
    u.id, cr.solde;

-- =============================================
-- FONCTIONS ET DÉCLENCHEURS
-- =============================================

-- Fonction pour mettre à jour la date de modification
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_modification = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Déclencheurs pour mettre à jour les dates de modification
CREATE TRIGGER update_utilisateurs_moddate
BEFORE UPDATE ON utilisateurs
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_vehicules_moddate
BEFORE UPDATE ON vehicules
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_covoiturages_moddate
BEFORE UPDATE ON covoiturages
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_credits_moddate
BEFORE UPDATE ON credits
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_credits_systeme_moddate
BEFORE UPDATE ON credits_systeme
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Fonction pour archiver un covoiturage terminé
CREATE OR REPLACE FUNCTION archiver_covoiturage_termine()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statut = 'terminé' AND OLD.statut != 'terminé' THEN
        INSERT INTO historique_covoiturages (
            covoiturage_id, chauffeur_id, passagers_ids, depart_ville, arrivee_ville, 
            date_depart, date_arrivee, prix, vehicule_plaque, ecologique, statut, donnees_source
        )
        SELECT 
            c.id, 
            c.chauffeur_id, 
            ARRAY(SELECT passager_id FROM participations WHERE covoiturage_id = c.id),
            c.depart_ville, 
            c.arrivee_ville, 
            c.date_depart::timestamp with time zone, 
            c.date_arrivee::timestamp with time zone, 
            c.prix, 
            c.vehicule_plaque, 
            c.ecologique, 
            c.statut,
            row_to_json(c)::jsonb
        FROM 
            covoiturages c
        WHERE 
            c.id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archiver_covoiturage
AFTER UPDATE ON covoiturages
FOR EACH ROW EXECUTE FUNCTION archiver_covoiturage_termine();

-- Fonction pour archiver une transaction
CREATE OR REPLACE FUNCTION archiver_transaction()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historique_transactions (
        utilisateur_id, montant, type, description, covoiturage_id, date_transaction
    ) VALUES (
        NEW.utilisateur_id, NEW.montant, NEW.type, NEW.description, NEW.covoiturage_id, NEW.date_transaction
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archiver_transaction
AFTER INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION archiver_transaction();

-- Fonction pour archiver un litige résolu
CREATE OR REPLACE FUNCTION archiver_litige_resolu()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statut IN ('résolu', 'remboursé') AND OLD.statut = 'litige' THEN
        INSERT INTO historique_litiges (
            litige_id, covoiturage_id, chauffeur_id, passager_id, raison, resolution, 
            employe_id, date_creation, date_resolution
        ) VALUES (
            NEW.id, NEW.covoiturage_id, NEW.chauffeur_id, NEW.passager_id, NEW.raison_litige,
            CASE WHEN NEW.statut = 'résolu' THEN 'Validé' ELSE 'Remboursé' END,
            NEW.decision_par, NEW.date_creation, NEW.date_resolution
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archiver_litige
AFTER UPDATE ON validations
FOR EACH ROW EXECUTE FUNCTION archiver_litige_resolu();

-- Fonction pour archiver un avis
CREATE OR REPLACE FUNCTION archiver_avis()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO historique_avis (
        avis_id, chauffeur_id, passager_id, note, commentaire, date_creation
    ) VALUES (
        NEW.id, NEW.chauffeur_id, NEW.passager_id, NEW.note, NEW.commentaire, NEW.date_creation
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archiver_avis
AFTER INSERT ON avis
FOR EACH ROW EXECUTE FUNCTION archiver_avis();

-- =============================================
-- INDEX POUR OPTIMISATION DES PERFORMANCES
-- =============================================

-- Index sur les utilisateurs
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role_id);
CREATE INDEX idx_utilisateurs_statut ON utilisateurs(statut);

-- Index sur les covoiturages
CREATE INDEX idx_covoiturages_chauffeur ON covoiturages(chauffeur_id);
CREATE INDEX idx_covoiturages_statut ON covoiturages(statut);
CREATE INDEX idx_covoiturages_dates ON covoiturages(date_depart, date_arrivee);
CREATE INDEX idx_covoiturages_villes ON covoiturages(depart_ville, arrivee_ville);

-- Index sur les participations
CREATE INDEX idx_participations_passager ON participations(passager_id);
CREATE INDEX idx_participations_statut ON participations(statut);

-- Index sur les validations
CREATE INDEX idx_validations_chauffeur ON validations(chauffeur_id);
CREATE INDEX idx_validations_passager ON validations(passager_id);
CREATE INDEX idx_validations_statut ON validations(statut);

-- Index sur les avis
CREATE INDEX idx_avis_chauffeur ON avis(chauffeur_id);
CREATE INDEX idx_avis_passager ON avis(passager_id);
CREATE INDEX idx_avis_signale ON avis(signale);

-- Index sur les historiques
CREATE INDEX idx_historique_covoiturages_chauffeur ON historique_covoiturages(chauffeur_id);
CREATE INDEX idx_historique_transactions_utilisateur ON historique_transactions(utilisateur_id);
CREATE INDEX idx_historique_litiges_chauffeur ON historique_litiges(chauffeur_id);
CREATE INDEX idx_historique_litiges_passager ON historique_litiges(passager_id);
CREATE INDEX idx_historique_avis_chauffeur ON historique_avis(chauffeur_id);
