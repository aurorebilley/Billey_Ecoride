import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  AlertCircle,
  Plus,
  X,
  UserCog,
  Trash2,
  Lock,
  AlertTriangle,
  Upload,
  Camera,
} from 'lucide-react';
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

interface User {
  pseudo: string;
  roles: string[];
  photo_url?: string;
}

export function ModifierProfil() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [roles, setRoles] = useState<string[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');

  // Validation des plaques d'immatriculation (format français)
  const validatePlaque = (plaque: string) => {
    const regex = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;
    return regex.test(plaque);
  };
  
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

  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        navigate('/connexion');
        return;
      }

      try {
        // Get user data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userDoc.exists()) {
          setError('Profil utilisateur non trouvé');
          return;
        }

        const userData = userDoc.data() as User;
        setUser(userData);
        setPhotoPreview(userData.photo_url || '');
        setRoles(userData.roles || []);

        // Get vehicles if user is a driver
        if (userData.roles?.includes('chauffeur')) {
          const vehiclesQuery = query(
            collection(db, 'vehicules'),
            where('user_id', '==', currentUser.uid)
          );
          const vehiclesSnapshot = await getDocs(vehiclesQuery);
          const vehiclesList: Vehicle[] = [];
          vehiclesSnapshot.forEach((doc) => {
            vehiclesList.push(doc.data() as Vehicle);
          });
          setVehicles(vehiclesList);
        }
      } catch (err) {
        setError('Erreur lors du chargement des données');
        console.error(err);
      }
    };

    loadUserData();
  }, [navigate]);

  const handleRoleChange = (role: string) => {
    setRoles((prev) => {
      // If trying to uncheck the last role, prevent it
      if (prev.includes(role) && prev.length === 1) {
        return prev;
      }
      // Otherwise, toggle the role as usual
      return prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
    });
  };

  const addVehicle = () => {
    setVehicles((prev) => [
      ...prev,
      {
        plaque: '',
        dateImmatriculation: '',
        marque: '',
        modele: '',
        couleur: '',
        places: 4,
        electrique: false,
        preferences: {
          fumeur: false,
          animaux: false,
          musique: false,
        },
      },
    ]);
  };

  const removeVehicle = (index: number) => {
    setVehicles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVehicle = (index: number, field: string, value: any) => {
    setVehicles((prev) =>
      prev.map((vehicle, i) =>
        i === index ? { ...vehicle, [field]: value } : vehicle
      )
    );
  };

  const updateVehiclePreference = (index: number, pref: string, value: boolean) => {
    setVehicles((prev) =>
      prev.map((vehicle, i) =>
        i === index
          ? {
              ...vehicle,
              preferences: { ...vehicle.preferences, [pref]: value },
            }
          : vehicle
      )
    );
  };

  const handleUpdateRoles = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Validation
      if (roles.length === 0) {
        throw new Error('Veuillez sélectionner au moins un rôle');
      }
      
      let photoUrl = user?.photo_url || '';
      if (photoFile) {
        photoUrl = await uploadImage(photoFile);
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

      // If user removes driver role, delete all vehicles
      if (!roles.includes('chauffeur')) {
        const vehiclesQuery = query(
          collection(db, 'vehicules'),
          where('user_id', '==', currentUser.uid)
        );
        const vehiclesSnapshot = await getDocs(vehiclesQuery);
        const deletePromises = vehiclesSnapshot.docs.map((doc) =>
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);
        setVehicles([]);
      } else {
        // Get current vehicles to compare with new ones
        const vehiclesQuery = query(
          collection(db, 'vehicules'),
          where('user_id', '==', currentUser.uid)
        );
        const vehiclesSnapshot = await getDocs(vehiclesQuery);
        const existingVehicles = new Set(vehiclesSnapshot.docs.map(doc => doc.id));

        for (const vehicle of vehicles) {
          const vehicleRef = doc(db, 'vehicules', vehicle.plaque);
          const vehicleData = {
            ...vehicle,
            user_id: currentUser.uid,
            date_modification: serverTimestamp(),
          };

          if (existingVehicles.has(vehicle.plaque)) {
            // Update existing vehicle
            await updateDoc(vehicleRef, vehicleData);
          } else {
            // Create new vehicle
            await setDoc(vehicleRef, {
              ...vehicleData,
              date_creation: serverTimestamp(),
            });
          }
        }
      }

      // Update user roles
      await updateDoc(doc(db, 'users', currentUser.uid), {
        roles,
        photo_url: photoUrl,
        date_modification: serverTimestamp(),
      });

      setSuccess('Rôles et véhicules mis à jour avec succès');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.email) throw new Error('Utilisateur non connecté');

      // Validate password complexity
      if (newPassword.length < 8) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères');
      }
      if (!/[A-Z]/.test(newPassword)) {
        throw new Error('Le nouveau mot de passe doit contenir au moins une majuscule');
      }
      if (!/[!@#$%^&*]/.test(newPassword)) {
        throw new Error('Le nouveau mot de passe doit contenir au moins un caractère spécial');
      }

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Update password
      await updatePassword(currentUser, newPassword);

      setSuccess('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      let message = 'Une erreur est survenue';
      if (err.code === 'auth/wrong-password') {
        message = 'Mot de passe actuel incorrect';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setError('');
    setIsLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser?.email) throw new Error('Utilisateur non connecté');

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        deleteConfirmPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Delete all user's vehicles
      const vehiclesQuery = query(
        collection(db, 'vehicules'),
        where('user_id', '==', currentUser.uid)
      );
      const vehiclesSnapshot = await getDocs(vehiclesQuery);
      await Promise.all(
        vehiclesSnapshot.docs.map((doc) => deleteDoc(doc.ref))
      );

      // Delete user document
      await deleteDoc(doc(db, 'users', currentUser.uid));

      // Delete credit document
      await deleteDoc(doc(db, 'credit', currentUser.uid));

      // Delete user account
      await deleteUser(currentUser);

      // Redirect to home
      navigate('/');
    } catch (err: any) {
      let message = 'Une erreur est survenue';
      if (err.code === 'auth/wrong-password') {
        message = 'Mot de passe incorrect';
      }
      setError(message);
    } finally {
      setIsLoading(false);
      setDeleteModal(false);
    }
  };

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <UserCog className="h-6 w-6 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Modifier mon profil
              </h1>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="ml-3 text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
        </div>

        {/* Photo Profile Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            Photo de profil
          </h2>
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
                <span>Changer la photo</span>
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
        {/* Roles Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            Mes rôles
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Sélectionnez au moins un rôle. En tant que chauffeur, vous devez avoir au moins un véhicule.
          </p>
          <div className="space-y-4 mb-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={roles.includes('chauffeur')}
                onChange={() => handleRoleChange('chauffeur')}
                className="h-5 w-5 text-[#3E920B] rounded focus:ring-[#3E920B]"
              />
              <span>Je suis chauffeur</span>
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

          {/* Vehicles Section */}
          {roles.includes('chauffeur') && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-[#333333] mb-4">
                Mes véhicules
                <span className="text-sm font-normal text-red-600 ml-2">
                  (Au moins un véhicule requis)
                </span>
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
                          onChange={(e) =>
                            updateVehicle(index, 'plaque', e.target.value.toUpperCase())
                          }
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
                          onChange={(e) =>
                            updateVehicle(index, 'dateImmatriculation', e.target.value)
                          }
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
                          onChange={(e) =>
                            updateVehicle(index, 'marque', e.target.value)
                          }
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
                          onChange={(e) =>
                            updateVehicle(index, 'modele', e.target.value)
                          }
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
                          onChange={(e) =>
                            updateVehicle(index, 'couleur', e.target.value)
                          }
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
                          onChange={(e) =>
                            updateVehicle(index, 'places', parseInt(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                        />
                      </div>
                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={vehicle.electrique}
                            onChange={(e) =>
                              updateVehicle(index, 'electrique', e.target.checked)
                            }
                            className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Véhicule électrique
                          </span>
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
                            onChange={(e) =>
                              updateVehiclePreference(index, 'fumeur', e.target.checked)
                            }
                            className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                          />
                          <span className="text-sm">Fumeur accepté</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={vehicle.preferences.animaux}
                            onChange={(e) =>
                              updateVehiclePreference(index, 'animaux', e.target.checked)
                            }
                            className="h-4 w-4 text-[#3E920B] rounded focus:ring-[#3E920B]"
                          />
                          <span className="text-sm">Animaux acceptés</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={vehicle.preferences.musique}
                            onChange={(e) =>
                              updateVehiclePreference(index, 'musique', e.target.checked)
                            }
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
            onClick={handleUpdateRoles}
            disabled={isLoading}
            className="mt-6 w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>

        {/* Password Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <Lock className="h-5 w-5 text-[#3E920B]" />
            <h2 className="text-xl font-semibold text-[#333333]">
              Modifier mon mot de passe
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
              />
              <p className="mt-1 text-xs text-gray-500">
                Le mot de passe doit contenir au moins 8 caractères, une majuscule
                et un caractère spécial
              </p>
            </div>
            <button
              onClick={handleUpdatePassword}
              disabled={isLoading}
              className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-[#3E920B] hover:bg-[#A7DE65] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E920B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Modification...' : 'Modifier mon mot de passe'}
            </button>
          </div>
        </div>

        {/* Delete Account Section */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center space-x-3 mb-4">
            <Trash2 className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold text-[#333333]">
              Supprimer mon compte
            </h2>
          </div>
          <p className="text-gray-600 mb-4">
            Cette action est irréversible. Toutes vos données seront supprimées
            définitivement.
          </p>
          <button
            onClick={() => setDeleteModal(true)}
            className="w-full py-2 px-4 border border-transparent rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            Supprimer mon compte
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <h3 className="text-xl font-semibold text-[#333333]">
                Confirmer la suppression
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Cette action est irréversible. Pour confirmer la suppression de votre
              compte, veuillez entrer votre mot de passe.
            </p>
            <div className="mb-6">
              <input
                type="password"
                value={deleteConfirmPassword}
                onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setDeleteModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}