'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { usersService, ImportUserData, ImportUsersResult } from '@/services/users.service';
import { departmentsService } from '@/services/departments.service';
import { servicesService } from '@/services/services.service';
import { User, Role, Department, Service } from '@/types';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [importResult, setImportResult] = useState<ImportUsersResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ImportUserData[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    login: '',
    password: '',
    firstName: '',
    lastName: '',
    role: Role.CONTRIBUTEUR,
    departmentId: '',
    serviceIds: [] as string[],
  });

  // Check permissions
  const canManageUsers = currentUser?.role === Role.ADMIN || currentUser?.role === Role.RESPONSABLE;
  const canEditUsers = currentUser?.role === Role.ADMIN || currentUser?.role === Role.RESPONSABLE || currentUser?.role === Role.MANAGER;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersService.getAll();
      const usersList = Array.isArray(response) ? response : response.data;
      setUsers(usersList);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des utilisateurs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentsAndServices = async () => {
    try {
      const [deptResponse, servResponse] = await Promise.all([
        departmentsService.getAll(),
        servicesService.getAll(),
      ]);
      const depts = Array.isArray(deptResponse) ? deptResponse : (deptResponse as any).data || [];
      const servs = Array.isArray(servResponse) ? servResponse : (servResponse as any).data || [];
      setDepartments(depts);
      setServices(servs);
    } catch (error: any) {
      console.error('Erreur lors du chargement des départements/services:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartmentsAndServices();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createData: any = {
        ...formData,
        departmentId: formData.departmentId || undefined,
        serviceIds: formData.serviceIds.length > 0 ? formData.serviceIds : undefined,
      };
      await usersService.create(createData);
      toast.success('Utilisateur créé avec succès');
      setShowCreateModal(false);
      setFormData({
        email: '',
        login: '',
        password: '',
        firstName: '',
        lastName: '',
        role: Role.CONTRIBUTEUR,
        departmentId: '',
        serviceIds: [],
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Erreur lors de la création'
      );
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      login: user.login,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      departmentId: user.departmentId || '',
      serviceIds: user.userServices?.map((us) => us.service.id) || [],
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData: any = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        serviceIds: formData.serviceIds.length > 0 ? formData.serviceIds : [],
      };

      // Ajouter departmentId seulement s'il est renseigné (UUID valide)
      // Ne pas inclure du tout si vide pour éviter la validation UUID
      if (formData.departmentId && formData.departmentId.trim() !== '') {
        updateData.departmentId = formData.departmentId;
      }
      // Si pas de departmentId, on ne l'inclut pas dans la requête

      // Ajouter le mot de passe seulement s'il est renseigné
      if (formData.password && formData.password.trim() !== '') {
        updateData.password = formData.password;
      }

      await usersService.update(editingUser.id, updateData);
      toast.success('Utilisateur modifié avec succès');
      setShowEditModal(false);
      setEditingUser(null);
      setFormData({
        email: '',
        login: '',
        password: '',
        firstName: '',
        lastName: '',
        role: Role.CONTRIBUTEUR,
        departmentId: '',
        serviceIds: [],
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Erreur lors de la modification'
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver cet utilisateur ?'))
      return;

    try {
      await usersService.delete(id);
      toast.success('Utilisateur désactivé');
      fetchUsers();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Erreur lors de la suppression'
      );
    }
  };

  const toggleService = (serviceId: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }));
  };

  const getRoleBadgeColor = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
        return 'bg-red-100 text-red-800';
      case Role.RESPONSABLE:
        return 'bg-purple-100 text-purple-800';
      case Role.MANAGER:
        return 'bg-blue-100 text-blue-800';
      case Role.REFERENT_TECHNIQUE:
        return 'bg-green-100 text-green-800';
      case Role.CONTRIBUTEUR:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
        return 'Admin';
      case Role.RESPONSABLE:
        return 'Responsable';
      case Role.MANAGER:
        return 'Manager';
      case Role.REFERENT_TECHNIQUE:
        return 'Référent Technique';
      case Role.CONTRIBUTEUR:
        return 'Contributeur';
      case Role.OBSERVATEUR:
        return 'Observateur';
      default:
        return role;
    }
  };

  const parseCSV = (text: string): ImportUserData[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
    const users: ImportUserData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';').map(v => v.trim());
      if (values.length < 6) continue;

      const user: ImportUserData = {
        email: values[headers.indexOf('email')] || '',
        login: values[headers.indexOf('login')] || '',
        password: values[headers.indexOf('password')] || '',
        firstName: values[headers.indexOf('firstname')] || '',
        lastName: values[headers.indexOf('lastname')] || '',
        role: values[headers.indexOf('role')] || 'CONTRIBUTEUR',
        departmentName: values[headers.indexOf('departmentname')] || undefined,
        serviceNames: values[headers.indexOf('servicenames')] || undefined,
      };

      if (user.email && user.login && user.password && user.firstName && user.lastName) {
        users.push(user);
      }
    }

    return users;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const users = parseCSV(text);
      setCsvPreview(users);
      setImportResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (csvPreview.length === 0) {
      toast.error('Aucun utilisateur valide à importer');
      return;
    }

    try {
      setImporting(true);
      const result = await usersService.importUsers(csvPreview);
      setImportResult(result);

      if (result.created > 0) {
        toast.success(`${result.created} utilisateur(s) créé(s) avec succès`);
        fetchUsers();
      }
      if (result.skipped > 0) {
        toast(`${result.skipped} utilisateur(s) ignoré(s) (existants)`, { icon: 'i' });
      }
      if (result.errors > 0) {
        toast.error(`${result.errors} erreur(s) lors de l'import`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'email;login;password;firstName;lastName;role;departmentName;serviceNames\nmarie.martin@example.com;marie.martin;password123;Marie;Martin;CONTRIBUTEUR;Direction Générale;Service Comptabilité';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_import_utilisateurs.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setCsvPreview([]);
    setImportResult(null);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
            <p className="text-gray-600 mt-1">{users.length} utilisateurs</p>
          </div>
          {canManageUsers && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Importer CSV
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Créer un utilisateur
              </button>
            </div>
          )}
        </div>

        {/* Users table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email / Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Département / Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold">
                        {user.firstName[0]}
                        {user.lastName[0]}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-500">@{user.login}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {user.department?.name || '-'}
                    </div>
                    {user.userServices && user.userServices.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {user.userServices.map((us) => (
                          <span
                            key={us.service.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {us.service.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      {canEditUsers && (
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Modifier
                        </button>
                      )}
                      {canManageUsers && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={user.id === currentUser?.id}
                          title={user.id === currentUser?.id ? 'Vous ne pouvez pas vous désactiver vous-même' : ''}
                        >
                          Désactiver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Créer un utilisateur
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login
                </label>
                <input
                  type="text"
                  required
                  value={formData.login}
                  onChange={(e) =>
                    setFormData({ ...formData, login: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as Role })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={Role.CONTRIBUTEUR}>Contributeur</option>
                  <option value={Role.OBSERVATEUR}>Observateur</option>
                  <option value={Role.REFERENT_TECHNIQUE}>
                    Référent Technique
                  </option>
                  <option value={Role.MANAGER}>Manager</option>
                  <option value={Role.RESPONSABLE}>Responsable</option>
                  <option value={Role.ADMIN}>Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Département
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentId: e.target.value, serviceIds: [] })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Aucun département</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {!formData.departmentId ? (
                    <p className="text-sm text-gray-500">Sélectionnez d'abord un département</p>
                  ) : services.filter((service) => service.departmentId === formData.departmentId).length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun service disponible</p>
                  ) : (
                    services
                      .filter((service) => service.departmentId === formData.departmentId)
                      .map((service) => (
                        <label key={service.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={formData.serviceIds.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900">{service.name}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Importer des utilisateurs depuis CSV
            </h2>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Format du fichier CSV</h3>
                <p className="text-sm text-blue-700 mb-2">
                  Le fichier doit contenir les colonnes suivantes (séparées par des points-virgules) :
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>email</strong> - Email de l'utilisateur (requis)</li>
                  <li><strong>login</strong> - Login unique (requis)</li>
                  <li><strong>password</strong> - Mot de passe initial (requis, min 6 caractères)</li>
                  <li><strong>firstName</strong> - Prénom (requis)</li>
                  <li><strong>lastName</strong> - Nom (requis)</li>
                  <li><strong>role</strong> - Rôle (ADMIN, RESPONSABLE, MANAGER, REFERENT_TECHNIQUE, CONTRIBUTEUR, OBSERVATEUR)</li>
                  <li><strong>departmentName</strong> - Nom du département (optionnel)</li>
                  <li><strong>serviceNames</strong> - Noms des services séparés par virgules (optionnel)</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Télécharger le template CSV
                </button>
              </div>

              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner un fichier CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Aperçu ({csvPreview.length} utilisateur(s) détecté(s))
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-60">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Login</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nom</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rôle</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Département</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {csvPreview.slice(0, 10).map((user, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-900">{user.email}</td>
                            <td className="px-3 py-2 text-gray-900">{user.login}</td>
                            <td className="px-3 py-2 text-gray-900">{user.firstName} {user.lastName}</td>
                            <td className="px-3 py-2 text-gray-900">{user.role}</td>
                            <td className="px-3 py-2 text-gray-500">{user.departmentName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 10 && (
                      <p className="text-center text-sm text-gray-500 py-2">
                        ... et {csvPreview.length - 10} autre(s)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className={`rounded-lg p-4 ${importResult.errors > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                  <h3 className={`font-medium mb-2 ${importResult.errors > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
                    Résultat de l'import
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700 font-semibold">{importResult.created}</span>
                      <span className="text-gray-600 ml-1">créé(s)</span>
                    </div>
                    <div>
                      <span className="text-gray-700 font-semibold">{importResult.skipped}</span>
                      <span className="text-gray-600 ml-1">ignoré(s)</span>
                    </div>
                    <div>
                      <span className="text-red-700 font-semibold">{importResult.errors}</span>
                      <span className="text-gray-600 ml-1">erreur(s)</span>
                    </div>
                  </div>
                  {importResult.errorDetails.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Détails :</p>
                      <ul className="text-sm text-gray-600 list-disc list-inside max-h-32 overflow-y-auto">
                        {importResult.errorDetails.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Fermer
                </button>
                <button
                  onClick={handleImport}
                  disabled={csvPreview.length === 0 || importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Import en cours...' : `Importer ${csvPreview.length} utilisateur(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Modifier l'utilisateur
            </h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Login
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.login}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-gray-100 cursor-not-allowed"
                  title="Le login ne peut pas être modifié"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nouveau mot de passe (optionnel)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Laisser vide pour ne pas changer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Laissez vide si vous ne souhaitez pas modifier le mot de passe
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as Role })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={Role.CONTRIBUTEUR}>Contributeur</option>
                  <option value={Role.OBSERVATEUR}>Observateur</option>
                  <option value={Role.REFERENT_TECHNIQUE}>
                    Référent Technique
                  </option>
                  <option value={Role.MANAGER}>Manager</option>
                  <option value={Role.RESPONSABLE}>Responsable</option>
                  <option value={Role.ADMIN}>Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Département
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, departmentId: e.target.value, serviceIds: [] })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Aucun département</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Services
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {!formData.departmentId ? (
                    <p className="text-sm text-gray-500">Sélectionnez d'abord un département</p>
                  ) : services.filter((service) => service.departmentId === formData.departmentId).length === 0 ? (
                    <p className="text-sm text-gray-500">Aucun service disponible</p>
                  ) : (
                    services
                      .filter((service) => service.departmentId === formData.departmentId)
                      .map((service) => (
                        <label key={service.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={formData.serviceIds.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900">{service.name}</span>
                        </label>
                      ))
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
