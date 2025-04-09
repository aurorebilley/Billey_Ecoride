import React from 'react';

export function PolitiqueConfidentialite() {
  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-[#333333] mb-8">
            Politique de Confidentialité d'EcoRide
          </h1>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Données personnelles collectées
            </h2>
            <p className="text-gray-600 mb-4">EcoRide recueille les données personnelles suivantes :</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li><strong>Identité</strong> : Pseudo, adresse e-mail</li>
              <li><strong>Informations relatives aux véhicules</strong> : Marque, modèle, immatriculation, énergie utilisée</li>
              <li><strong>Informations relatives aux trajets</strong> : Adresse de départ et d'arrivée, date et heure, nombre de places disponibles, préférences personnelles du chauffeur (animaux, fumeur, etc.)</li>
              <li><strong>Informations financières</strong> : Crédit utilisateur disponible et historique des transactions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Finalités du traitement des données
            </h2>
            <p className="text-gray-600 mb-4">Les données personnelles collectées ont pour but :</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>De permettre la mise en relation efficace et sécurisée entre chauffeurs et passagers</li>
              <li>De gérer les comptes utilisateurs et leurs crédits</li>
              <li>D'améliorer la qualité et la sécurité des services proposés</li>
              <li>De résoudre les litiges éventuels entre utilisateurs</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Destinataires des données
            </h2>
            <p className="text-gray-600">
              Les données personnelles collectées sont exclusivement réservées à l'usage interne de la société EcoRide. Elles ne sont ni vendues ni transmises à des tiers à des fins commerciales ou publicitaires.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Durée de conservation
            </h2>
            <p className="text-gray-600">
              Les données personnelles sont conservées durant toute la durée d'activité du compte utilisateur, puis pour une durée supplémentaire de 3 ans après la clôture du compte, conformément aux obligations légales.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Droits des utilisateurs
            </h2>
            <p className="text-gray-600 mb-4">Conformément au RGPD, chaque utilisateur dispose des droits suivants :</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Accès aux données personnelles</li>
              <li>Rectification des données inexactes ou incomplètes</li>
              <li>Suppression (« droit à l'oubli ») des données personnelles</li>
              <li>Limitation et opposition au traitement des données</li>
              <li>Portabilité des données personnelles fournies</li>
            </ul>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600">Pour exercer ces droits, l'utilisateur peut contacter le Délégué à la Protection des Données (DPO) d'EcoRide à l'adresse suivante :</p>
              <div className="mt-2">
                <p className="font-bold">EcoRide SAS – DPO</p>
                <p>27 Rue Verte, 44000 Nantes, France</p>
                <p>Email : rgpd@ecoride.fr</p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Sécurité des données
            </h2>
            <p className="text-gray-600 mb-4">
              EcoRide met en œuvre toutes les mesures techniques et organisationnelles nécessaires pour garantir la sécurité et la confidentialité des données personnelles traitées, incluant notamment :
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Le chiffrement des données stockées</li>
              <li>L'accès limité aux données par le personnel autorisé uniquement</li>
              <li>La sécurisation des accès par mots de passe sécurisés et protocoles HTTPS</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Gestion des cookies
            </h2>
            <p className="text-gray-600">
              Le site EcoRide utilise des cookies nécessaires au fonctionnement du service et des cookies analytiques afin d'améliorer continuellement l'expérience utilisateur. L'utilisateur a la possibilité de configurer son consentement à l'utilisation de ces cookies lors de sa première connexion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Réclamations auprès de la CNIL
            </h2>
            <p className="text-gray-600">
              En cas de litige concernant la gestion de vos données personnelles, vous avez la possibilité de déposer une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL) : <a href="https://www.cnil.fr" className="text-[#3E920B] hover:text-[#A7DE65]" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}