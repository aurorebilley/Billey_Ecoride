import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building2 } from 'lucide-react';

export function UserManagement() {
  const navigate = useNavigate();

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#333333] mb-8">
          Gestion des utilisateurs et employés
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* User Management Card */}
          <div 
            onClick={() => navigate('/user')}
            className="bg-white rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-[#A7DE65]/20 rounded-lg">
                <Users className="w-8 h-8 text-[#3E920B]" />
              </div>
              <h2 className="text-2xl font-semibold text-[#333333]">
                Gestion des utilisateurs
              </h2>
            </div>
            <p className="text-gray-600">
              Gérez les comptes utilisateurs, leurs accès et leurs statuts. Consultez et modifiez les informations des utilisateurs de la plateforme.
            </p>
          </div>

          {/* Employee Management Card */}
          <div 
            onClick={() => navigate('/employer')}
            className="bg-white rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-[#A7DE65]/20 rounded-lg">
                <Building2 className="w-8 h-8 text-[#3E920B]" />
              </div>
              <h2 className="text-2xl font-semibold text-[#333333]">
                Gestion des employés
              </h2>
            </div>
            <p className="text-gray-600">
              Gérez les employés de l'entreprise, leurs rôles et leurs permissions. Suivez les performances et les activités des employés.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}