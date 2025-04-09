import React from 'react';

export function MentionsLegales() {
  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-[#333333] mb-8">
            Mentions légales
          </h1>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Éditeur du site
            </h2>
            <div className="space-y-2">
              <p className="font-bold">EcoRide SAS</p>
              <p>Capital social : 12 000€</p>
              <p>Adresse du siège social : 27 Rue Verte, 44000 Nantes, France</p>
              <p>Téléphone : +33 2 40 12 34 56</p>
              <p>E-mail : contact@ecoride.fr</p>
              <p>Immatriculation au RCS : 852 963 741 RCS Nantes</p>
              <p>N° TVA intracommunautaire : FR 29 852963741</p>
            </div>

            <div className="mt-4">
              <p className="font-bold">Responsable de publication :</p>
              <p>José MARTIN, Directeur technique</p>
              <p>E-mail : jose.martin@ecoride.fr</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Hébergement
            </h2>
            <div className="space-y-2">
              <p className="font-bold">Netlify, Inc.</p>
              <p>Adresse : 2325 3rd Street, Suite 215, San Francisco, CA 94107, USA</p>
              <p>E-mail : support@netlify.com</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Propriété intellectuelle
            </h2>
            <p className="text-gray-600">
              Tous les contenus (textes, images, logo, graphiques, icônes, etc.) présents sur le site EcoRide sont protégés par les lois françaises et internationales relatives au droit d'auteur et à la propriété intellectuelle. Toute reproduction totale ou partielle du contenu du site sans autorisation préalable expresse d'EcoRide est strictement interdite.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Protection des données personnelles (RGPD)
            </h2>
            <p className="text-gray-600 mb-4">
              EcoRide s'engage à respecter la réglementation en vigueur concernant le traitement des données à caractère personnel, notamment le RGPD (Règlement Général sur la Protection des Données). Les informations collectées via les formulaires du site sont uniquement utilisées à des fins de gestion interne et de bon fonctionnement du service de covoiturage. Ces données ne seront jamais revendues ni transmises à des tiers sans votre consentement explicite.
            </p>
            <p className="text-gray-600">
              Vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition concernant vos données personnelles, que vous pouvez exercer en envoyant un mail à : rgpd@ecoride.fr ou par courrier à : EcoRide SAS, DPO, 27 Rue Verte, 44000 Nantes, France.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Cookies
            </h2>
            <p className="text-gray-600">
              Le site EcoRide utilise des cookies nécessaires à son fonctionnement, ainsi que des cookies analytiques pour améliorer la qualité de nos services. Vous avez la possibilité d'accepter ou de refuser ces cookies lors de votre première connexion au site via notre bandeau dédié.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#333333] mb-4">
              Conditions générales d'utilisation (CGU)
            </h2>
            <p className="text-gray-600 mb-4">
              En utilisant le site EcoRide, vous acceptez les présentes conditions d'utilisation. EcoRide met en relation les utilisateurs pour du covoiturage, mais n'est en aucun cas responsable des litiges ou incidents survenus entre utilisateurs durant les trajets. Chaque utilisateur reste responsable de ses actes et de la véracité des informations fournies lors de l'inscription et de l'utilisation du service.
            </p>
            <p className="text-gray-600">
              EcoRide se réserve le droit de suspendre ou supprimer tout compte utilisateur ne respectant pas les présentes CGU ou adoptant un comportement contraire aux bonnes pratiques du covoiturage.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}