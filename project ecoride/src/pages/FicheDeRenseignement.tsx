import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AlertCircle, Plus, X, Upload, Camera } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { uploadImage } from '../lib/cloudinary';

interface Vehicle {
  plaque: string;
  dateImmatriculation: string;
  marque: string;
  modele: string;
  couleur: string;
  places: number;
  electrique: boolean;
  preferences: {
    fumeur: boolean;
    animaux: boolean;
    musique: boolean;
  };
}

export function FicheDeRenseignement() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('La photo ne doit pas dépasser 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Le fichier doit être une image');
        return;
      }
      
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validation des plaques d'immatriculation (format français)
  const validatePlaque = (plaque: string) => {
    const regex = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;
    return regex.test(plaque);
  };

  const handleRoleChange = (role: string) => {
    setRoles(prev => {
      // If trying to uncheck the last role, prevent it
      if (prev.includes(role) && prev.length === 1) {
        return prev;
      }
      // Otherwise, toggle the role as usual
      return prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role];
    });
  };

  const addVehicle = () => {
    setVehicles(prev => [...prev, {
      plaque: '',
      dateImmatriculation: '',
      marque: '',
      modele: '',
      couleur: '',
      electrique: false,
      places: 4,
      preferences: {
        fumeur: false,
        animaux: false,
        musique: false
      }
    }]);
  };

  const removeVehicle = (index: number) => {
    setVehicles(prev => prev.filter((_, i) => i !== index));
  };

  const updateVehicle = (index: number, field: string, value: any) => {
    setVehicles(prev => prev.map((vehicle, i) => 
      i === index
        ? { ...vehicle, [field]: value }
        : vehicle
    ));
  };

  const updateVehiclePreference = (index: number, pref: string, value: boolean) => {
    setVehicles(prev => prev.map((vehicle, i) => 
      i === index
        ? {
            ...vehicle,
            preferences: { ...vehicle.preferences, [pref]: value }
          }
        : vehicle
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Utilisateur non connecté');

      // Validation
      if (roles.length === 0) {
        throw new Error('Veuillez sélectionner au moins un rôle');
      }

      let photoUrl = '';
      try {
        if (photoFile) {
          photoUrl = await uploadImage(photoFile);
        }
      } catch (uploadError) {
        console.error('Erreur lors du téléchargement de la photo:', uploadError);
        throw new Error('Erreur lors du téléchargement de la photo');
      }

      // Si l'utilisateur est chauffeur, il doit avoir au moins un véhicule
      if (roles.includes('chauffeur') && vehicles.length === 0) {
        throw new Error('En tant que chauffeur, vous devez ajouter au moins un véhicule');
      }

      // Validate vehicles
      for (const vehicle of vehicles) {
        if (!validatePlaque(vehicle.plaque)) {
          throw new Error('Format de plaque invalide (ex: AB-123-CD)');
        }
        if (!vehicle.marque || !vehicle.modele || !vehicle.couleur) {
          throw new Error('Tous les champs du véhicule sont obligatoires');
        }
      }

      // Update user roles
      await updateDoc(doc(db, 'users', user.uid), {
        roles,
        photo_url: photoUrl || null,
        date_modification: serverTimestamp()
      });

      // Create vehicle documents
      for (const vehicle of vehicles) {
        await setDoc(doc(db, 'vehicules', vehicle.plaque), {
          ...vehicle,
          user_id: user.uid,
          date_creation: serverTimestamp(),
          date_modification: serverTimestamp()
        });
      }

      navigate('/monespace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold text-[#333333] mb-6">
            Complétez votre profil
          </h2>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="ml-3 text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Photo Profile Section */}
            <div>
              <h3 className="text-xl font-semibold text-[#333333] mb-4">
                Photo de profil
              </h3>
              <div className="flex items-center space-x-6">
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center space-x-2 px-4 py-2 border border-[#3E920B] text-[#3E920B] rounded-lg hover:bg-[#3E920B] hover:text-white transition-colors cursor-pointer">
                    <Upload className="w-5 h-5" />
                    <span>Choisir une photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-2 text-sm text-gray-500">
                    JPG, PNG • 5MB max
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-[#333333] mb-4">
                Vos rôles
              </h3>
              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={roles.includes('chauffeur')}
                    onChange={() => handleRoleChange('chauffeur')}
                    className="h-5 w-5 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span>Je suis chauffeur</span>
                  {roles.includes('chauffeur') && (
                    <span className="text-sm font-normal text-red-600 ml-2">
                      (Au moins un véhicule requis)
                    </span>
                  )}
                </label>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={roles.includes('passager')}
                    onChange={() => handleRoleChange('passager')}
                    className="h-5 w-5 text-[#3E920B] rounded focus:ring-[#3E920B]"
                  />
                  <span>Je suis passager</span>
                </label>
              </div>
            </div>

            {roles.includes('chauffeur') && (
              <div>
                <h3 className="text-xl font-semibold text-[#333333] mb-4">
                  Vos véhicules
                </h3>
                <div className="space-y-6">
                  {vehicles.map((vehicle, index) => (
                    <div key={index} className="bg-gray-50 p-6 rounded-lg relative">
                      <button
                        type="button"
                        onClick={() => removeVehicle(index)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Plaque d'immatriculation
                          </label>
                          <input
                            type="text"
                            value={vehicle.plaque}
                            onChange={(e) => updateVehicle(index, 'plaque', e.target.value.toUpperCase())}
                            placeholder="AB-123-CD"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date de première immatriculation
                          </label>
                          <input
                            type="date"
                            value={vehicle.dateImmatriculation}
                            onChange={(e) => updateVehicle(index, 'dateImmatriculation', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Marque
                          </label>
                          <input
                            type="text"
                            value={vehicle.marque}
                            onChange={(e) => updateVehicle(index, 'marque', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Modèle
                          </label>
                          <input
                            type="text"
                            value={vehicle.modele}
                            onChange={(e) => updateVehicle(index, 'modele', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Couleur
                          </label>
                          <input
                            type="text"
                            value={vehicle.couleur}
                            onChange={(e) => updateVehicle(index, 'couleur', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nombre de places
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="9"
                            value={vehicle.places}
                            onChange={(e) => updateVehicle(index, 'places', parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                          />
                        </div>
                        <div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={vehicle.electrique}
                              onChange={(e) => updateVehicle(index, 'electrique', e.target.checked)}
                              className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                            />
                            <span className="text-sm font-medium text-gray-700">Véhicule électrique</span>
                          </label>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Préférences
                        </label>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={vehicle.preferences.fumeur}
                              onChange={(e) => updateVehiclePreference(index, 'fumeur', e.target.checked)}
                              className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                            />
                            <span className="text-sm">Fumeur accepté</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={vehicle.preferences.animaux}
                              onChange={(e) => updateVehiclePreference(index, 'animaux', e.target.checked)}
                              className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                            />
                            <span className="text-sm">Animaux acceptés</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={vehicle.preferences.musique}
                              onChange={(e) => updateVehiclePreference(index, 'musique', e.target.checked)}
                              className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                            />
                            <span className="text-sm">Musique pendant le trajet</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addVehicle}
                    className="flex items-center space-x-2 text-[#3E920B] hover:text-[#A7DE65] transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Ajouter un véhicule</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enregistrement...' : 'Valider mon profil'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}