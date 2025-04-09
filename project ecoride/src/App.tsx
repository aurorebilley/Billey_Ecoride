import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Covoiturage } from './pages/Covoiturage';
import { CovoiturageDetails } from './pages/CovoiturageDetails';
import { Connexion } from './pages/Connexion';
import { Inscription } from './pages/Inscription';
import { FicheDeRenseignement } from './pages/FicheDeRenseignement';
import { ModifierVehicule } from './pages/ModifierVehicule';
import { AjouterVehicule } from './pages/AjouterVehicule';
import { Historique } from './pages/Historique';
import { CreerVoyage } from './pages/CreerVoyage';
import { ModifierProfil } from './pages/ModifierProfil';
import { MonEspace } from './pages/MonEspace';
import { Demarrer } from './pages/Demarrer';
import { Validation } from './pages/Validation';
import { ValidationDetails } from './pages/ValidationDetails';
import { Terminer } from './pages/Terminer';
import { Credit } from './pages/Credit';
import { UserManagement } from './pages/UserManagement';
import { User } from './pages/user';
import { Employer } from './pages/employer';
import { Litige } from './pages/Litige';
import { CovoiturageStat } from './pages/CovoiturageStat';
import { VoyageDetails } from './pages/VoyageDetails';
import { Avis } from './pages/avis';
import { Tableaux } from './pages/tableaux';
import { UserDetails } from './pages/UserDetails';
import { MentionsLegales } from './pages/MentionsLegales';
import { PolitiqueConfidentialite } from './pages/PolitiqueConfidentialite';
import { Contact } from './pages/Contact';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/covoiturage" element={<Covoiturage />} />
          <Route path="/covoiturage/:id" element={<CovoiturageDetails />} />
          <Route path="/connexion" element={<Connexion />} />
          <Route path="/inscription" element={<Inscription />} />
          <Route path="/fiche-renseignement" element={<FicheDeRenseignement />} />
          <Route path="/modifier-vehicule/:id" element={<ModifierVehicule />} />
          <Route path="/ajouter-vehicule" element={<AjouterVehicule />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/creer-voyage" element={<CreerVoyage />} />
          <Route path="/modifier-profil" element={<ModifierProfil />} />
          <Route path="/monespace" element={<MonEspace />} />
          <Route path="/demarrer/:id" element={<Demarrer />} />
          <Route path="/terminer/:id" element={<Terminer />} />
          <Route path="/validation" element={<Validation />} />
          <Route path="/validation/:id" element={<ValidationDetails />} />
          <Route path="/credit" element={<Credit />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/user" element={<User />} />
          <Route path="/user/:id" element={<UserDetails />} />
          <Route path="/employer" element={<Employer />} />
          <Route path="/litige" element={<Litige />} />
          <Route path="/stats" element={<CovoiturageStat />} />
          <Route path="/avis" element={<Avis />} />
          <Route path="/tableaux" element={<Tableaux />} />
          <Route path="/voyage/:id" element={<VoyageDetails />} />
          <Route path="/mentions-legales" element={<MentionsLegales />} />
          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;