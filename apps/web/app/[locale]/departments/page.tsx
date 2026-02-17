"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { departmentsService } from "@/services/departments.service";
import { servicesService } from "@/services/services.service";
import { usersService } from "@/services/users.service";
import {
  Department,
  Service,
  Role,
  CreateDepartmentDto,
  CreateServiceDto,
  User,
} from "@/types";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export default function DepartmentsPage() {
  const t = useTranslations("admin.departments");
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null,
  );

  const [departmentForm, setDepartmentForm] = useState<CreateDepartmentDto>({
    name: "",
    description: "",
    managerId: "",
  });

  const [serviceForm, setServiceForm] = useState<CreateServiceDto>({
    name: "",
    description: "",
    departmentId: "",
    managerId: "",
  });

  // Check if user is admin or responsable
  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE;

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch departments
      const depsData = await departmentsService.getAll();
      setDepartments(Array.isArray(depsData) ? depsData : []);

      // Fetch all services
      const servicesData = await servicesService.getAll();
      setServices(Array.isArray(servicesData) ? servicesData : []);

      // Fetch all users for manager selection
      const usersData = await usersService.getAll();
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      setDepartments([]);
      setServices([]);
      setUsers([]);
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status !== 404) {
        toast.error(t("messages.loadError"));
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDepartment) {
        await departmentsService.update(editingDepartment.id, departmentForm);
        toast.success(t("messages.updateDeptSuccess"));
      } else {
        await departmentsService.create(departmentForm);
        toast.success(t("messages.createDeptSuccess"));
      }
      setShowDepartmentModal(false);
      resetDepartmentForm();
      fetchData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ||
          `${t("messages.saveError")} ${editingDepartment ? t("messages.modification") : t("messages.creation")}`,
      );
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        await servicesService.update(editingService.id, serviceForm);
        toast.success(t("messages.updateServiceSuccess"));
      } else {
        await servicesService.create(serviceForm);
        toast.success(t("messages.createServiceSuccess"));
      }
      setShowServiceModal(false);
      resetServiceForm();
      fetchData();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ||
          `${t("messages.saveError")} ${editingService ? t("messages.modification") : t("messages.creation")}`,
      );
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (
      !confirm(
        t("messages.deleteDeptConfirm"),
      )
    )
      return;

    try {
      await departmentsService.delete(id);
      toast.success(t("messages.deleteDeptSuccess"));
      fetchData();
    } catch {
      toast.error(t("messages.deleteError"));
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm(t("messages.deleteServiceConfirm"))) return;

    try {
      await servicesService.delete(id);
      toast.success(t("messages.deleteServiceSuccess"));
      fetchData();
    } catch {
      toast.error(t("messages.deleteError"));
    }
  };

  const openEditDepartment = (dept: Department) => {
    setEditingDepartment(dept);
    setDepartmentForm({
      name: dept.name,
      description: dept.description || "",
      managerId: dept.manager?.id || "",
    });
    setShowDepartmentModal(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || "",
      departmentId: service.departmentId,
      managerId: service.manager?.id || "",
    });
    setShowServiceModal(true);
  };

  const resetDepartmentForm = () => {
    setDepartmentForm({
      name: "",
      description: "",
      managerId: "",
    });
    setEditingDepartment(null);
  };

  const resetServiceForm = () => {
    setServiceForm({
      name: "",
      description: "",
      departmentId: "",
      managerId: "",
    });
    setEditingService(null);
  };

  const getServicesForDepartment = (departmentId: string) => {
    return services.filter((s) => s.departmentId === departmentId);
  };

  const getDepartmentStats = (departmentId: string) => {
    const deptServices = getServicesForDepartment(departmentId);
    const totalMembers = deptServices.reduce(
      (sum, service) => sum + (service.members?.length || 0),
      0,
    );
    return {
      servicesCount: deptServices.length,
      membersCount: totalMembers,
    };
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-6xl mb-4">{t("accessRestricted.icon")}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t("accessRestricted.title")}
            </h2>
            <p className="text-gray-600">
              {t("accessRestricted.message")}
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900">
              {t("title")}
            </h1>
            <p className="text-gray-600 mt-1">
              {departments.length} {t("count")} - {services.length} {t("servicesCount")}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                resetServiceForm();
                setShowServiceModal(true);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
            >
              <span>+</span>
              <span>{t("newService")}</span>
            </button>
            <button
              onClick={() => {
                resetDepartmentForm();
                setShowDepartmentModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <span>+</span>
              <span>{t("newDepartment")}</span>
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-900">
                {t("infoTitle")}
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                {t("infoText")}
              </p>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">
              {t("filterLabel")}
            </label>
            <select
              value={selectedDepartment || "ALL"}
              onChange={(e) =>
                setSelectedDepartment(
                  e.target.value === "ALL" ? null : e.target.value,
                )
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">{t("allDepartments")}</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Departments List */}
        {departments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <p className="text-gray-500">{t("noDepartment")}</p>
            <button
              onClick={() => {
                resetDepartmentForm();
                setShowDepartmentModal(true);
              }}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              {t("createFirst")}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {departments
              .filter(
                (dept) => !selectedDepartment || dept.id === selectedDepartment,
              )
              .map((department) => {
                const stats = getDepartmentStats(department.id);
                const deptServices = getServicesForDepartment(department.id);

                return (
                  <div
                    key={department.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                  >
                    {/* Department Header */}
                    <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h2 className="text-xl font-bold text-gray-900">
                              {department.name}
                            </h2>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {stats.servicesCount} {t("services")}
                            </span>
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              {stats.membersCount} {t("members")}
                            </span>
                          </div>

                          {department.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {department.description}
                            </p>
                          )}

                          {department.manager && (
                            <div className="flex items-center space-x-2 text-sm text-gray-700">
                              <span className="font-medium">{t("manager")}</span>
                              <span>
                                {department.manager.firstName}{" "}
                                {department.manager.lastName}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => openEditDepartment(department)}
                            className="px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                          >
                            {t("modify")}
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteDepartment(department.id)
                            }
                            className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                          >
                            {t("delete")}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Services List */}
                    {deptServices.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <p className="text-gray-500 mb-3">
                          {t("noServiceInDept")}
                        </p>
                        <button
                          onClick={() => {
                            resetServiceForm();
                            setServiceForm((prev) => ({
                              ...prev,
                              departmentId: department.id,
                            }));
                            setShowServiceModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {t("addService")}
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {deptServices.map((service) => (
                          <div
                            key={service.id}
                            className="px-6 py-4 hover:bg-gray-50 transition"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {service.name}
                                  </h3>
                                  {service.members && (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                      {service.members.length} {t("members")}
                                    </span>
                                  )}
                                </div>

                                {service.description && (
                                  <p className="text-sm text-gray-600 mb-2">
                                    {service.description}
                                  </p>
                                )}

                                {service.manager && (
                                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <span className="font-medium">
                                      {t("manager")}
                                    </span>
                                    <span>
                                      {service.manager.firstName}{" "}
                                      {service.manager.lastName}
                                    </span>
                                  </div>
                                )}

                                <p className="text-xs text-gray-500 mt-2">
                                  {t("createdOn")}{" "}
                                  {new Date(
                                    service.createdAt,
                                  ).toLocaleDateString("fr-FR")}
                                </p>
                              </div>

                              <div className="flex items-center space-x-2 ml-4">
                                <button
                                  onClick={() => openEditService(service)}
                                  className="px-3 py-1 text-sm text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                                >
                                  {t("modify")}
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteService(service.id)
                                  }
                                  className="px-3 py-1 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                                >
                                  {t("delete")}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Department Modal */}
      {showDepartmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingDepartment
                ? t("departmentModal.titleEdit")
                : t("departmentModal.titleCreate")}
            </h2>
            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("departmentModal.name")}
                </label>
                <input
                  type="text"
                  required
                  value={departmentForm.name}
                  onChange={(e) =>
                    setDepartmentForm({
                      ...departmentForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("departmentModal.namePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("departmentModal.description")}
                </label>
                <textarea
                  value={departmentForm.description}
                  onChange={(e) =>
                    setDepartmentForm({
                      ...departmentForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("departmentModal.descriptionPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("departmentModal.manager")}
                </label>
                <select
                  value={departmentForm.managerId}
                  onChange={(e) =>
                    setDepartmentForm({
                      ...departmentForm,
                      managerId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("departmentModal.noManager")}</option>
                  {users
                    .filter(
                      (u) =>
                        u.role === Role.ADMIN ||
                        u.role === Role.RESPONSABLE ||
                        u.role === Role.MANAGER,
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowDepartmentModal(false);
                    resetDepartmentForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {t("departmentModal.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingDepartment ? t("departmentModal.edit") : t("departmentModal.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingService ? t("serviceModal.titleEdit") : t("serviceModal.titleCreate")}
            </h2>
            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("serviceModal.department")}
                </label>
                <select
                  required
                  value={serviceForm.departmentId}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      departmentId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t("serviceModal.selectDepartment")}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("serviceModal.name")}
                </label>
                <input
                  type="text"
                  required
                  value={serviceForm.name}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("serviceModal.namePlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("serviceModal.description")}
                </label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t("serviceModal.descriptionPlaceholder")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("serviceModal.manager")}
                </label>
                <select
                  value={serviceForm.managerId}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      managerId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">{t("serviceModal.noManager")}</option>
                  {users
                    .filter(
                      (u) =>
                        u.role === Role.ADMIN ||
                        u.role === Role.RESPONSABLE ||
                        u.role === Role.MANAGER,
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowServiceModal(false);
                    resetServiceForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {t("serviceModal.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  {editingService ? t("serviceModal.edit") : t("serviceModal.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
