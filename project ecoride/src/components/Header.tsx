import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, CheckCircle2, LogOut, AlertTriangle } from 'lucide-react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { LogoMobile } from './LogoMobile';

export function Header() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUser, setIsUser] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPassenger, setIsPassenger] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasValidations, setHasValidations] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        setIsUser(userDoc.exists() && userData.role === 'user');
        setIsAdmin(userDoc.exists() && userData.role === 'administrateur');
        setIsEmployee(userDoc.exists() && userData.role === 'employé');
        setIsPassenger(userDoc.exists() && userDoc.data().roles?.includes('passager'));

        // Check for pending validations if user is a passenger
        if (userDoc.exists() && userDoc.data().roles?.includes('passager')) {
          const validationsQuery = query(
            collection(db, 'validations'),
            where('passager_id', '==', user.uid),
            where('statut', '==', 'non validé')
          );
          const validationsSnapshot = await getDocs(validationsQuery);
          setHasValidations(!validationsSnapshot.empty);
        }
      } else {
        setIsUser(false);
        setIsPassenger(false);
        setHasValidations(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuth = async () => {
    setIsSidebarOpen(false);
    if (isAuthenticated) {
      setShowLogoutModal(true);
    } else {
      navigate('/connexion');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      navigate('/');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="hidden md:block">
            <Link to="/">
              <LogoMobile />
            </Link>
          </div>
          <div className="md:hidden">
            <Link to="/">
              <LogoMobile />
            </Link>
          </div>
        </div>
        <button
          className="md:hidden text-[#333333] hover:text-[#3E920B]"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden md:flex items-center space-x-8">
          {isAdmin ? (
            <>
              <Link to="/credit" className="text-[#333333] hover:text-[#3E920B]">Crédit</Link>
              <Link to="/users" className="text-[#333333] hover:text-[#3E920B]">Gestion des utilisateurs</Link>
              <Link to="/stats" className="text-[#333333] hover:text-[#3E920B]">Covoiturage stats</Link>
            </>
          ) : (
            isEmployee ? (
              <>
                <Link to="/litige" className="text-[#333333] hover:text-[#3E920B]">Litige</Link>
                <Link to="/avis" className="text-[#333333] hover:text-[#3E920B]">Avis</Link>
                <Link to="/tableaux" className="text-[#333333] hover:text-[#3E920B]">Tableaux de bord</Link>
              </>
            ) : (
              <>
                <Link to="/covoiturage" className="text-[#333333] hover:text-[#3E920B]">Covoiturages</Link>
                <Link to="/contact" className="text-[#333333] hover:text-[#3E920B]">Contact</Link>
                {isPassenger && (
                  <Link to="/validation" className="text-[#333333] hover:text-[#3E920B] relative">
                    <span>Validation</span>
                    {hasValidations && (
                      <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </Link>
                )}
                {isUser && (
                  <Link to="/monespace" className="text-[#333333] hover:text-[#3E920B]">
                    Mon espace
                  </Link>
                )}
              </>
            )
          )}
          <button
            onClick={handleAuth}
            className={`${
              isAuthenticated
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#3E920B] hover:bg-[#A7DE65]'
            } text-white px-6 py-2 rounded-full transition-colors`}
          >
            {isAuthenticated ? 'Déconnexion' : 'Connexion'}
          </button>
        </div>

        {/* Mobile Sidebar */}
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-opacity ${
            isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div
          className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform md:hidden ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-4">
            <button
              className="absolute top-4 right-4 text-[#333333] hover:text-[#3E920B]"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="mt-8 flex flex-col space-y-6">
              {isAdmin ? (
                <>
                  <Link
                    to="/credit"
                    className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Crédit
                  </Link>
                  <Link
                    to="/users"
                    className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Gestion des utilisateurs
                  </Link>
                  <Link
                    to="/stats"
                    className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Covoiturage stats
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/covoiturage"
                    className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Covoiturages
                  </Link>
                  <Link
                    to="/contact"
                    className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    Contact
                  </Link>
                  {isPassenger && (
                    <Link 
                      to="/validation" 
                      className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold relative"
                      onClick={() => setIsSidebarOpen(false)}>
                      <span>Validation</span>
                      {hasValidations && (
                        <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </Link>
                  )}
                  {isUser && (
                    <Link
                      to="/monespace"
                      className="text-[#333333] hover:text-[#3E920B] text-lg font-semibold"
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      Mon espace
                    </Link>
                  )}
                </>
              )}
              <button
                className={`${
                  isAuthenticated
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#3E920B] hover:bg-[#A7DE65]'
                } text-white px-6 py-2 rounded-full transition-colors text-lg font-semibold`}
                onClick={handleAuth}
              >
                {isAuthenticated ? 'Déconnexion' : 'Connexion'}
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <LogOut className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Confirmation de déconnexion
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir vous déconnecter ?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}