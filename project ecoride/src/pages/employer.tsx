import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AlertCircle,
  Loader2,
  Building2,
  Users,
  ChevronLeft,
  Mail,
  Phone,
  Calendar,
  BadgeCheck,
  Search,
  UserPlus,
  AlertTriangle,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban
} from 'lucide-react';
import { auth, db } from '../lib/firebase';

interface Employee {
  id: string;
  nom: string;
  prenom: string;
  adresse_mail: string;
  telephone: string;
  poste: string;
  date_creation: string;
  statut: 'actif' | 'inactif';
  photo_url?: string;
}

interface EmployeeFormData {
  nom: string;
  prenom: string;
  adresse_mail: string;
  telephone: string;
  poste: string;
}

export function Employer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    nom: '',
    prenom: '',
    adresse_mail: '',
    telephone: '',
    poste: ''
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/connexion');
        return;
      }

      try {
        // Vérifier si l'utilisateur est administrateur
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'administrateur') {
          navigate('/');
          return;
        }

        // Récupérer tous les utilisateurs avec le rôle "employé"
        const employeesQuery = query(
          collection(db, 'users'),
          where('role', '==', 'employé'),
          orderBy('date_creation', 'desc')
        );
        const employeesSnapshot = await getDocs(employeesQuery); 
        const employeesList: Employee[] = [];

        employeesSnapshot.forEach((doc) => {
          const data = doc.data();
          employeesList.push({
            id: doc.id,
            ...data,
            statut: data.statut || 'actif' // Set default status to 'actif' if not specified
          } as Employee);
        });

        setEmployees(employeesList);
      } catch (err) {
        setError('Erreur lors du chargement des employés');
        console.error(err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleAddEmployee = async () => {
    try {
      const newEmployeeRef = doc(collection(db, 'users'));
      await setDoc(newEmployeeRef, {
        ...formData,
        role: 'employé',
        statut: 'actif',
        date_creation: serverTimestamp(),
        date_modification: serverTimestamp()
      });

      setEmployees(prev => [{
        id: newEmployeeRef.id,
        ...formData,
        statut: 'actif',
        date_creation: new Date().toISOString(),
        photo_url: undefined
      }, ...prev]);

      setShowAddModal(false);
      setFormData({
        nom: '',
        prenom: '',
        adresse_mail: '',
        telephone: '',
        poste: ''
      });
    } catch (err) {
      setError('Erreur lors de l\'ajout de l\'employé');
      console.error(err);
    }
  };

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      await updateDoc(doc(db, 'users', selectedEmployee.id), {
        ...formData,
        date_modification: serverTimestamp()
      });

      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id
          ? { ...emp, ...formData }
          : emp
      ));

      setShowEditModal(false);
      setSelectedEmployee(null);
    } catch (err) {
      setError('Erreur lors de la modification de l\'employé');
      console.error(err);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedEmployee) return;

    try {
      const newStatus = selectedEmployee.statut === 'actif' ? 'inactif' : 'actif';
      await updateDoc(doc(db, 'users', selectedEmployee.id), {
        statut: newStatus,
        date_modification: serverTimestamp()
      });

      setEmployees(prev => prev.map(emp =>
        emp.id === selectedEmployee.id
          ? { ...emp, statut: newStatus }
          : emp
      ));

      setShowStatusModal(false);
      setSelectedEmployee(null);
    } catch (err) {
      setError('Erreur lors de la modification du statut');
      console.error(err);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return;

    try {
      await deleteDoc(doc(db, 'users', selectedEmployee.id));
      setEmployees(prev => prev.filter(emp => emp.id !== selectedEmployee.id));
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    } catch (err) {
      setError('Erreur lors de la suppression de l\'employé');
      console.error(err);
    }
  };

  const filteredEmployees = employees.filter(
    (employee) =>
      (employee.nom || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.prenom || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.adresse_mail || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 text-[#3E920B] animate-spin" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#A7DE65]/10 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:justify-between mb-8">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <button
              onClick={() => navigate('/user-management')}
              className="text-[#3E920B] hover:text-[#A7DE65] transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-[#3E920B]" />
              <h1 className="text-3xl font-bold text-[#333333]">
                Gestion des employés
              </h1>
            </div>
          </div>
          <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center md:space-x-4">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un employé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#A7DE65] focus:border-transparent"
              />
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full md:w-auto flex items-center justify-center space-x-2 bg-[#3E920B] text-white px-4 py-2 rounded-lg hover:bg-[#A7DE65] transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              <span>Ajouter un employé</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employé
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Poste
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date d'embauche
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                            {employee.photo_url ? (
                              <img
                                src={employee.photo_url}
                                alt={`${employee.prenom} ${employee.nom}`}
                                className="h-10 w-10 object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 flex items-center justify-center bg-[#A7DE65] text-[#3E920B] font-bold">
                                {employee.prenom ? employee.prenom.charAt(0).toUpperCase() : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.prenom} {employee.nom}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Mail className="w-4 h-4" />
                          <span>{employee.adresse_mail}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4" />
                          <span>{employee.telephone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <BadgeCheck className="w-5 h-5 text-[#3E920B]" />
                        <span className="text-sm text-gray-900">{employee.poste}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {employee.date_creation?.toDate?.() 
                            ? employee.date_creation.toDate().toLocaleDateString()
                            : new Date(employee.date_creation).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.statut === 'actif'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {employee.statut === 'actif' ? 'Actif' : 'Inactif'}
                      </span>
                      <div className="flex items-center space-x-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(employee);
                            setFormData({
                              nom: employee.nom,
                              prenom: employee.prenom,
                              adresse_mail: employee.adresse_mail,
                              telephone: employee.telephone,
                              poste: employee.poste
                            });
                            setShowEditModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <Pencil className="w-4 h-4 text-[#3E920B]" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(employee);
                            setShowStatusModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          {employee.statut === 'actif' ? (
                            <Ban className="w-4 h-4 text-red-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(employee);
                            setShowDeleteModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
              <h3 className="text-xl font-semibold mb-4">Ajouter un employé</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.adresse_mail}
                    onChange={(e) => setFormData(prev => ({ ...prev, adresse_mail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
                  <input
                    type="text"
                    value={formData.poste}
                    onChange={(e) => setFormData(prev => ({ ...prev, poste: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddEmployee}
                  className="px-4 py-2 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Employee Modal */}
        {showEditModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
              <h3 className="text-xl font-semibold mb-4">Modifier l'employé</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.adresse_mail}
                    onChange={(e) => setFormData(prev => ({ ...prev, adresse_mail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
                  <input
                    type="text"
                    value={formData.poste}
                    onChange={(e) => setFormData(prev => ({ ...prev, poste: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#3E920B] focus:border-[#3E920B]"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEditEmployee}
                  className="px-4 py-2 bg-[#3E920B] text-white rounded-lg hover:bg-[#A7DE65] transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Toggle Modal */}
        {showStatusModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                {selectedEmployee.statut === 'actif' ? (
                  <Ban className="h-6 w-6 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                )}
                <h3 className="text-xl font-semibold text-[#333333]">
                  {selectedEmployee.statut === 'actif' ? 'Suspendre' : 'Réactiver'} l'employé
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir {selectedEmployee.statut === 'actif' ? 'suspendre' : 'réactiver'} cet employé ?
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleToggleStatus}
                  className={`px-4 py-2 text-white rounded-lg transition-colors ${
                    selectedEmployee.statut === 'actif'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && selectedEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
              <div className="flex items-center space-x-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <h3 className="text-xl font-semibold text-[#333333]">
                  Supprimer l'employé
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir supprimer définitivement cet employé ? Cette action est irréversible.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteEmployee}
                  className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
