import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Calendar, MapPin, Search, Euro, Zap } from 'lucide-react';

interface SearchFilters {
  departVille: string;
  arriveeVille: string;
  dateDepart: string;
  ecologique: boolean;
  prixMax: number;
  dureeMax: number;
  noteMin: number;
}

export function Home() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SearchFilters>({
    departVille: '',
    arriveeVille: '',
    dateDepart: '',
    ecologique: false,
    prixMax: 1000,
    dureeMax: 24,
    noteMin: 0,
  });

  const handleSearch = () => {
    const searchParams = new URLSearchParams();
    if (filters.departVille) searchParams.append('depart', filters.departVille);
    if (filters.arriveeVille) searchParams.append('arrivee', filters.arriveeVille);
    if (filters.dateDepart) searchParams.append('date', filters.dateDepart);
    if (filters.ecologique) searchParams.append('eco', 'true');
    navigate(`/covoiturage?${searchParams.toString()}`);
  };

  return (
    <main className="flex-grow">
      <section className="relative py-20 bg-gradient-to-b from-[#A7DE65]/10 to-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-[#333333] mb-6">
              Voyagez écologique avec EcoRide
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Rejoignez notre communauté de covoiturage engagée pour réduire l'empreinte carbone.
              Ensemble, rendons chaque trajet plus vert !
            </p>
            <img
              src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&auto=format&fit=crop&q=80"
              alt="Route panoramique"
              className="rounded-xl shadow-lg w-full h-64 object-cover mb-12"
            />
          </div>

          {/* Search Section */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-[#3E920B] w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Ville de départ"
                    value={filters.departVille}
                    onChange={(e) => setFilters(prev => ({ ...prev, departVille: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-[#3E920B] w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Ville d'arrivée"
                    value={filters.arriveeVille}
                    onChange={(e) => setFilters(prev => ({ ...prev, arriveeVille: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-[#3E920B] w-5 h-5" />
                  <input
                    type="date"
                    value={filters.dateDepart}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateDepart: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="bg-[#3E920B] text-white px-6 py-2 rounded-lg hover:bg-[#A7DE65] transition-colors flex items-center justify-center space-x-2"
                >
                  <Search className="w-5 h-5" />
                  <span>Rechercher</span>
                </button>
              </div>

              {/* Filters */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.ecologique}
                    onChange={(e) => setFilters(prev => ({ ...prev, ecologique: e.target.checked }))}
                    className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span className="text-sm">Voyage écologique</span>
                </label>
                <div>
                  <label className="text-sm text-gray-600">Prix maximum</label>
                  <input
                    type="number"
                    placeholder="Prix en crédits"
                    value={filters.prixMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, prixMax: parseInt(e.target.value) }))}
                    min="0"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Durée maximum (heures)</label>
                  <input
                    type="number"
                    value={filters.dureeMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, dureeMax: parseInt(e.target.value) }))}
                    min="1"
                    max="24"
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Note minimale</label>
                  <select
                    value={filters.noteMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, noteMin: parseInt(e.target.value) }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
                  >
                    <option value="0">Toutes les notes</option>
                    <option value="3">3 étoiles et +</option>
                    <option value="4">4 étoiles et +</option>
                    <option value="5">5 étoiles</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}