"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import {
  usersService,
  ImportUserData,
  ImportUsersResult,
  UsersValidationPreview,
  UserDependenciesResponse,
} from "@/services/users.service";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import { departmentsService } from "@/services/departments.service";
import { servicesService } from "@/services/services.service";
import { User, Role, Department, Service } from "@/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { parseCSV as parseCSVRaw } from "@/lib/csv-parser";

export default function UsersPage() {
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");
  const currentUser = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [importResult, setImportResult] = useState<ImportUsersResult | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ImportUserData[]>([]);
  // Pre-validation states
  const [usersPreview, setUsersPreview] =
    useState<UsersValidationPreview | null>(null);
  const [showUsersPreview, setShowUsersPreview] = useState(false);
  const [pendingUsersImport, setPendingUsersImport] = useState<
    ImportUserData[]
  >([]);

  // Delete user states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [checkingDependencies, setCheckingDependencies] = useState(false);
  const [userDependencies, setUserDependencies] =
    useState<UserDependenciesResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    login: "",
    password: "",
    firstName: "",
    lastName: "",
    role: Role.CONTRIBUTEUR,
    departmentId: "",
    serviceIds: [] as string[],
  });

  // Check permissions
  const canManageUsers =
    currentUser?.role === Role.ADMIN || currentUser?.role === Role.RESPONSABLE;
  const canEditUsers =
    currentUser?.role === Role.ADMIN ||
    currentUser?.role === Role.RESPONSABLE ||
    currentUser?.role === Role.MANAGER;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersService.getAll();
      const usersList = Array.isArray(response) ? response : response.data;
      setUsers(usersList);
    } catch (err) {
      toast.error(t("messages.loadError"));
      console.error(err);
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
      const depts = Array.isArray(deptResponse)
        ? deptResponse
        : (deptResponse as { data?: Department[] }).data || [];
      const servs = Array.isArray(servResponse)
        ? servResponse
        : (servResponse as { data?: Service[] }).data || [];
      setDepartments(depts);
      setServices(servs);
    } catch (err) {
      console.error(
        "Erreur lors du chargement des départements/services:",
        err,
      );
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchDepartmentsAndServices();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createData: {
        email: string;
        login: string;
        password: string;
        firstName: string;
        lastName: string;
        role: Role;
        departmentId?: string;
        serviceIds?: string[];
      } = {
        ...formData,
        departmentId: formData.departmentId || undefined,
        serviceIds:
          formData.serviceIds.length > 0 ? formData.serviceIds : undefined,
      };
      await usersService.create(createData);
      toast.success(t("messages.createSuccess"));
      setShowCreateModal(false);
      setFormData({
        email: "",
        login: "",
        password: "",
        firstName: "",
        lastName: "",
        role: Role.CONTRIBUTEUR,
        departmentId: "",
        serviceIds: [],
      });
      fetchUsers();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.createError"),
      );
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      login: user.login,
      password: "",
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      departmentId: user.departmentId || "",
      serviceIds: user.userServices?.map((us) => us.service.id) || [],
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData: {
        email: string;
        firstName: string;
        lastName: string;
        role: Role;
        serviceIds: string[];
        departmentId?: string;
        password?: string;
      } = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        serviceIds: formData.serviceIds.length > 0 ? formData.serviceIds : [],
      };

      // Ajouter departmentId seulement s'il est renseigné (UUID valide)
      // Ne pas inclure du tout si vide pour éviter la validation UUID
      if (formData.departmentId && formData.departmentId.trim() !== "") {
        updateData.departmentId = formData.departmentId;
      }
      // Si pas de departmentId, on ne l'inclut pas dans la requête

      // Ajouter le mot de passe seulement s'il est renseigné
      if (formData.password && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }

      await usersService.update(editingUser.id, updateData);
      toast.success(t("messages.updateSuccess"));
      setShowEditModal(false);
      setEditingUser(null);
      setFormData({
        email: "",
        login: "",
        password: "",
        firstName: "",
        lastName: "",
        role: Role.CONTRIBUTEUR,
        departmentId: "",
        serviceIds: [],
      });
      fetchUsers();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.updateError"),
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("messages.deactivateConfirm"))) return;

    try {
      await usersService.delete(id);
      toast.success(t("messages.deactivateSuccess"));
      fetchUsers();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.deleteError"),
      );
    }
  };

  // Ouvrir la modal de suppression définitive
  const openDeleteModal = async (user: User) => {
    setUserToDelete(user);
    setUserDependencies(null);
    setShowDeleteModal(true);
    setCheckingDependencies(true);

    try {
      const dependencies = await usersService.checkDependencies(user.id);
      setUserDependencies(dependencies);
    } catch {
      toast.error(t("messages.depsCheckError"));
      setShowDeleteModal(false);
    } finally {
      setCheckingDependencies(false);
    }
  };

  // Confirmer la suppression définitive
  const handleHardDelete = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      await usersService.hardDelete(userToDelete.id);
      toast.success(t("messages.hardDeleteSuccess"));
      setShowDeleteModal(false);
      setUserToDelete(null);
      setUserDependencies(null);
      fetchUsers();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message =
        axiosError.response?.data?.message || t("messages.deleteError");
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // Fermer la modal de suppression
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
    setUserDependencies(null);
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
        return "bg-red-100 text-red-800";
      case Role.RESPONSABLE:
        return "bg-purple-100 text-purple-800";
      case Role.MANAGER:
        return "bg-blue-100 text-blue-800";
      case Role.REFERENT_TECHNIQUE:
        return "bg-green-100 text-green-800";
      case Role.CONTRIBUTEUR:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
        return "Admin";
      case Role.RESPONSABLE:
        return "Responsable";
      case Role.MANAGER:
        return "Manager";
      case Role.REFERENT_TECHNIQUE:
        return "Référent Technique";
      case Role.CONTRIBUTEUR:
        return "Contributeur";
      case Role.OBSERVATEUR:
        return "Observateur";
      default:
        return role;
    }
  };

  const parseCSV = (text: string): ImportUserData[] => {
    const rows = parseCSVRaw(text);
    const users: ImportUserData[] = [];

    for (const row of rows) {
      // Normalize header keys to lowercase for case-insensitive matching
      const normalizedRow: Record<string, string> = {};
      Object.keys(row).forEach((key) => {
        normalizedRow[key.toLowerCase()] = row[key];
      });

      const user: ImportUserData = {
        email: normalizedRow.email || "",
        login: normalizedRow.login || "",
        password: normalizedRow.password || "",
        firstName: normalizedRow.firstname || "",
        lastName: normalizedRow.lastname || "",
        role: normalizedRow.role || "CONTRIBUTEUR",
        departmentName: normalizedRow.departmentname || undefined,
        serviceNames: normalizedRow.servicenames || undefined,
      };

      if (
        user.email &&
        user.login &&
        user.password &&
        user.firstName &&
        user.lastName
      ) {
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
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (csvPreview.length === 0) {
      toast.error(t("import.noValidUsers"));
      return;
    }

    try {
      setImporting(true);
      // Validate first (dry-run)
      const preview = await usersService.validateImport(csvPreview);
      setUsersPreview(preview);
      setPendingUsersImport(csvPreview);
      setShowImportModal(false);
      setShowUsersPreview(true);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ||
          t("messages.importValidationError"),
      );
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmUsersImport = async () => {
    setImporting(true);
    try {
      const result = await usersService.importUsers(pendingUsersImport);
      setImportResult(result);

      if (result.created > 0) {
        toast.success(`${result.created} ${t("messages.importCreated")}`);
        fetchUsers();
      }
      if (result.skipped > 0) {
        toast(`${result.skipped} ${t("messages.importSkipped")}`);
      }
      if (result.errors > 0) {
        toast.error(`${result.errors} ${t("messages.importErrors")}`);
      }

      setShowUsersPreview(false);
      setUsersPreview(null);
      setPendingUsersImport([]);
      setCsvPreview([]);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.importError"),
      );
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Template without fake data - just headers and explanatory comments
    const template =
      "email;login;password;firstName;lastName;role;departmentName;serviceNames\n# email@domaine.com;# prenom.nom;# motdepasse (min 6 car.);# Prenom;# Nom;# ADMIN|RESPONSABLE|MANAGER|CHEF_DE_PROJET|REFERENT_TECHNIQUE|CONTRIBUTEUR|OBSERVATEUR;# Nom departement existant;# Service1, Service2";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_import_utilisateurs.csv";
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
            <p className="mt-4 text-gray-600">{t("loading")}</p>
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
            <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
            <p className="text-gray-600 mt-1">
              {users.length} {t("count")}
            </p>
          </div>
          {canManageUsers && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                {t("importButton")}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + {t("createButton")}
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
                  {t("columns.user")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("columns.emailLogin")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("columns.role")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("columns.departmentServices")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("columns.status")}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("columns.actions")}
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
                        user.role,
                      )}`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {user.department?.name || "-"}
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
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.isActive
                        ? tCommon("status.active")
                        : tCommon("status.inactive")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      {canEditUsers && (
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t("actions.edit")}
                        </button>
                      )}
                      {canManageUsers && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-orange-600 hover:text-orange-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={user.id === currentUser?.id}
                          title={
                            user.id === currentUser?.id
                              ? t("actions.deactivateTooltip")
                              : t("actions.deactivateAction")
                          }
                        >
                          {t("actions.deactivate")}
                        </button>
                      )}
                      {currentUser?.role === Role.ADMIN && (
                        <button
                          onClick={() => openDeleteModal(user)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={user.id === currentUser?.id}
                          title={
                            user.id === currentUser?.id
                              ? t("actions.deleteTooltip")
                              : t("actions.deleteAction")
                          }
                        >
                          {t("actions.delete")}
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
              {t("createModal.title")}
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("createModal.firstName")}
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
                    {t("createModal.lastName")}
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
                  {t("createModal.email")}
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
                  {t("createModal.login")}
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
                  {t("createModal.password")}
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
                  {t("createModal.role")}
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as Role })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={Role.CONTRIBUTEUR}>
                    {tCommon("roles.CONTRIBUTEUR")}
                  </option>
                  <option value={Role.OBSERVATEUR}>
                    {tCommon("roles.OBSERVATEUR")}
                  </option>
                  <option value={Role.REFERENT_TECHNIQUE}>
                    {tCommon("roles.REFERENT_TECHNIQUE")}
                  </option>
                  <option value={Role.CHEF_DE_PROJET}>
                    {tCommon("roles.CHEF_DE_PROJET")}
                  </option>
                  <option value={Role.MANAGER}>
                    {tCommon("roles.MANAGER")}
                  </option>
                  <option value={Role.RESPONSABLE}>
                    {tCommon("roles.RESPONSABLE")}
                  </option>
                  <option value={Role.ADMIN}>{tCommon("roles.ADMIN")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("createModal.department")}
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      departmentId: e.target.value,
                      serviceIds: [],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("createModal.noDepartment")}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("createModal.services")}
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {!formData.departmentId ? (
                    <p className="text-sm text-gray-500">
                      {t("createModal.selectDepartmentFirst")}
                    </p>
                  ) : services.filter(
                      (service) =>
                        service.departmentId === formData.departmentId,
                    ).length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {t("createModal.noServiceAvailable")}
                    </p>
                  ) : (
                    services
                      .filter(
                        (service) =>
                          service.departmentId === formData.departmentId,
                      )
                      .map((service) => (
                        <label
                          key={service.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.serviceIds.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900">
                            {service.name}
                          </span>
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
                  {t("createModal.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t("createModal.create")}
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
              {t("import.title")}
            </h2>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">
                  {t("import.formatTitle")}
                </h3>
                <p className="text-sm text-blue-700 mb-2">
                  {t("import.formatDescription")}
                </p>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                  <li>
                    <strong>email</strong> - {t("import.columns.email")}
                  </li>
                  <li>
                    <strong>login</strong> - {t("import.columns.login")}
                  </li>
                  <li>
                    <strong>password</strong> - {t("import.columns.password")}
                  </li>
                  <li>
                    <strong>firstName</strong> - {t("import.columns.firstName")}
                  </li>
                  <li>
                    <strong>lastName</strong> - {t("import.columns.lastName")}
                  </li>
                  <li>
                    <strong>role</strong> - {t("import.columns.role")}
                  </li>
                  <li>
                    <strong>departmentName</strong> -{" "}
                    {t("import.columns.departmentName")}
                  </li>
                  <li>
                    <strong>serviceNames</strong> -{" "}
                    {t("import.columns.serviceNames")}
                  </li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {t("import.downloadTemplate")}
                </button>
              </div>

              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("import.selectFile")}
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
                    {t("import.preview")} ({csvPreview.length}{" "}
                    {t("import.detected")})
                  </h3>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-60">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                            {t("import.previewColumns.email")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                            {t("import.previewColumns.login")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                            {t("import.previewColumns.name")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                            {t("import.previewColumns.role")}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                            {t("import.previewColumns.department")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {csvPreview.slice(0, 10).map((user, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-gray-900">
                              {user.email}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {user.login}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {user.firstName} {user.lastName}
                            </td>
                            <td className="px-3 py-2 text-gray-900">
                              {user.role}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {user.departmentName || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvPreview.length > 10 && (
                      <p className="text-center text-sm text-gray-500 py-2">
                        {t("import.andMore")} {csvPreview.length - 10}{" "}
                        {t("import.others")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div
                  className={`rounded-lg p-4 ${importResult.errors > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}
                >
                  <h3
                    className={`font-medium mb-2 ${importResult.errors > 0 ? "text-yellow-800" : "text-green-800"}`}
                  >
                    {t("import.resultTitle")}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700 font-semibold">
                        {importResult.created}
                      </span>
                      <span className="text-gray-600 ml-1">
                        {t("import.created")}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-700 font-semibold">
                        {importResult.skipped}
                      </span>
                      <span className="text-gray-600 ml-1">
                        {t("import.skipped")}
                      </span>
                    </div>
                    <div>
                      <span className="text-red-700 font-semibold">
                        {importResult.errors}
                      </span>
                      <span className="text-gray-600 ml-1">
                        {t("import.errors")}
                      </span>
                    </div>
                  </div>
                  {importResult.errorDetails.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {t("import.details")}
                      </p>
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
                  {t("import.close")}
                </button>
                <button
                  onClick={handleImport}
                  disabled={csvPreview.length === 0 || importing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing
                    ? t("import.importing")
                    : `${t("import.import")} ${csvPreview.length} ${t("import.importCount")}`}
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
              {t("editModal.title")}
            </h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("createModal.firstName")}
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
                    {t("createModal.lastName")}
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
                  {t("createModal.email")}
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
                  {t("createModal.login")}
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.login}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-gray-100 cursor-not-allowed"
                  title={t("editModal.loginReadOnly")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("editModal.newPassword")}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("editModal.passwordPlaceholder")}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t("editModal.passwordHint")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("createModal.role")}
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as Role })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={Role.CONTRIBUTEUR}>
                    {tCommon("roles.CONTRIBUTEUR")}
                  </option>
                  <option value={Role.OBSERVATEUR}>
                    {tCommon("roles.OBSERVATEUR")}
                  </option>
                  <option value={Role.REFERENT_TECHNIQUE}>
                    {tCommon("roles.REFERENT_TECHNIQUE")}
                  </option>
                  <option value={Role.CHEF_DE_PROJET}>
                    {tCommon("roles.CHEF_DE_PROJET")}
                  </option>
                  <option value={Role.MANAGER}>
                    {tCommon("roles.MANAGER")}
                  </option>
                  <option value={Role.RESPONSABLE}>
                    {tCommon("roles.RESPONSABLE")}
                  </option>
                  <option value={Role.ADMIN}>{tCommon("roles.ADMIN")}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("createModal.department")}
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      departmentId: e.target.value,
                      serviceIds: [],
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("createModal.noDepartment")}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("createModal.services")}
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
                  {!formData.departmentId ? (
                    <p className="text-sm text-gray-500">
                      {t("createModal.selectDepartmentFirst")}
                    </p>
                  ) : services.filter(
                      (service) =>
                        service.departmentId === formData.departmentId,
                    ).length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {t("createModal.noServiceAvailable")}
                    </p>
                  ) : (
                    services
                      .filter(
                        (service) =>
                          service.departmentId === formData.departmentId,
                      )
                      .map((service) => (
                        <label
                          key={service.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.serviceIds.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900">
                            {service.name}
                          </span>
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
                  {t("createModal.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t("editModal.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Import Preview Modal */}
      {usersPreview && (
        <ImportPreviewModal
          isOpen={showUsersPreview}
          onClose={() => {
            setShowUsersPreview(false);
            setUsersPreview(null);
            setPendingUsersImport([]);
          }}
          onConfirm={handleConfirmUsersImport}
          title="Previsualisation de l'import des utilisateurs"
          items={{
            valid: usersPreview.valid.map((item) => ({
              lineNumber: item.lineNumber,
              status: item.status,
              messages: item.messages,
              data: item.user,
              resolvedFields: {
                ...(item.resolvedDepartment && {
                  Departement: item.resolvedDepartment,
                }),
                ...(item.resolvedServices &&
                  item.resolvedServices.length > 0 && {
                    Services: {
                      id: "",
                      name: item.resolvedServices.map((s) => s.name).join(", "),
                    },
                  }),
              },
            })),
            duplicates: usersPreview.duplicates.map((item) => ({
              lineNumber: item.lineNumber,
              status: item.status,
              messages: item.messages,
              data: item.user,
            })),
            errors: usersPreview.errors.map((item) => ({
              lineNumber: item.lineNumber,
              status: item.status,
              messages: item.messages,
              data: item.user,
            })),
            warnings: usersPreview.warnings.map((item) => ({
              lineNumber: item.lineNumber,
              status: item.status,
              messages: item.messages,
              data: item.user,
              resolvedFields: {
                ...(item.resolvedDepartment && {
                  Departement: item.resolvedDepartment,
                }),
                ...(item.resolvedServices &&
                  item.resolvedServices.length > 0 && {
                    Services: {
                      id: "",
                      name: item.resolvedServices.map((s) => s.name).join(", "),
                    },
                  }),
              },
            })),
          }}
          summary={usersPreview.summary}
          columns={[
            { key: "email", label: "Email" },
            { key: "login", label: "Login" },
            { key: "firstName", label: "Prenom" },
            { key: "lastName", label: "Nom" },
          ]}
          isImporting={importing}
        />
      )}

      {/* Modal de suppression définitive */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {t("deleteModal.title")}
              </h2>
            </div>

            {userToDelete && (
              <p className="text-gray-600 mb-4">
                {t("deleteModal.confirmText")}{" "}
                <strong>
                  {userToDelete.firstName} {userToDelete.lastName}
                </strong>{" "}
                ({userToDelete.email}) ?
              </p>
            )}

            {/* Chargement des dépendances */}
            {checkingDependencies && (
              <div className="flex items-center justify-center py-4">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">
                  {t("deleteModal.checkingDeps")}
                </span>
              </div>
            )}

            {/* Affichage des dépendances */}
            {!checkingDependencies &&
              userDependencies &&
              !userDependencies.canDelete && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-red-800 mb-2">
                    {t("deleteModal.cannotDelete")}
                  </h3>
                  <p className="text-sm text-red-700 mb-2">
                    {t("deleteModal.depsExist")}
                  </p>
                  <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                    {userDependencies.dependencies.map((dep, index) => (
                      <li key={index}>{dep.description}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-red-600 mt-3">
                    {t("deleteModal.pleaseReassign")}
                  </p>
                </div>
              )}

            {/* Message de confirmation si suppression possible */}
            {!checkingDependencies && userDependencies?.canDelete && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>{t("deleteModal.warningTitle")}</strong>{" "}
                  {t("deleteModal.warningText")}
                </p>
              </div>
            )}

            {/* Boutons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                {t("deleteModal.cancel")}
              </button>
              <button
                onClick={handleHardDelete}
                disabled={
                  !userDependencies?.canDelete ||
                  deleting ||
                  checkingDependencies
                }
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t("deleteModal.deleting")}
                  </>
                ) : (
                  t("deleteModal.confirm")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
