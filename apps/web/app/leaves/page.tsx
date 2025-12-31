"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import {
  leavesService,
  LeaveValidationDelegate,
} from "@/services/leaves.service";
import { usersService } from "@/services/users.service";
import {
  leaveTypesService,
  LeaveTypeConfig,
} from "@/services/leave-types.service";
import { LeaveTypesManager } from "@/components/LeaveTypesManager";
import { Leave, LeaveType, LeaveStatus, HalfDay, User, Role } from "@/types";
import toast from "react-hot-toast";

type TabType =
  | "my-leaves"
  | "pending-validation"
  | "all-leaves"
  | "delegations"
  | "leave-types";

export default function LeavesPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("my-leaves");
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([]);
  const [allLeaves, setAllLeaves] = useState<Leave[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [delegations, setDelegations] = useState<{
    given: LeaveValidationDelegate[];
    received: LeaveValidationDelegate[];
  }>({ given: [], received: [] });
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [formData, setFormData] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    halfDay: undefined as HalfDay | undefined,
    reason: "",
  });
  const [delegationForm, setDelegationForm] = useState({
    delegateId: "",
    startDate: "",
    endDate: "",
  });

  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.RESPONSABLE;
  const isManager = user?.role === Role.MANAGER;
  const canValidate = isAdmin || isManager;

  const fetchUsers = async () => {
    try {
      const data = await usersService.getAll();
      if (data && typeof data === "object" && "data" in data) {
        setUsers(Array.isArray(data.data) ? data.data : []);
      } else if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchMyLeaves = async () => {
    try {
      const data = await leavesService.getMyLeaves();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      const axiosError = err as { response?: { status?: number } };
      if (axiosError.response?.status !== 404) {
        console.error(err);
      }
      setLeaves([]);
    }
  };

  const fetchPendingLeaves = async () => {
    if (!canValidate) return;
    try {
      const data = await leavesService.getPendingForValidation();
      setPendingLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPendingLeaves([]);
    }
  };

  const fetchAllLeaves = async () => {
    if (!isAdmin) return;
    try {
      const url = selectedUserId ? selectedUserId : undefined;
      const data = await leavesService.getAll(1, 100, url);
      setAllLeaves(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setAllLeaves([]);
    }
  };

  const fetchDelegations = async () => {
    if (!canValidate) return;
    try {
      const data = await leavesService.getMyDelegations();
      setDelegations(data);
    } catch (err) {
      console.error(err);
      setDelegations({ given: [], received: [] });
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const data = await leaveTypesService.getAll();
      setLeaveTypes(data);
      // Définir le premier type comme valeur par défaut si formData.leaveTypeId est vide
      if (data.length > 0 && !formData.leaveTypeId) {
        setFormData((prev) => ({ ...prev, leaveTypeId: data[0].id }));
      }
    } catch (err) {
      console.error("Error fetching leave types:", err);
      setLeaveTypes([]);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchUsers(),
      fetchMyLeaves(),
      fetchPendingLeaves(),
      fetchAllLeaves(),
      fetchDelegations(),
      fetchLeaveTypes(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "all-leaves") {
      fetchAllLeaves();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leavesService.create(formData);
      toast.success("Demande de congé créée - En attente de validation");
      setShowCreateModal(false);
      resetForm();
      fetchAll();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la création",
      );
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLeave) return;
    try {
      await leavesService.update(editingLeave.id, formData);
      toast.success("Congé modifié avec succès");
      setShowEditModal(false);
      setEditingLeave(null);
      resetForm();
      fetchAll();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la modification",
      );
    }
  };

  const handleDelete = async (leaveId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette demande ?")) return;
    try {
      await leavesService.delete(leaveId);
      toast.success("Demande supprimée");
      fetchAll();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la suppression",
      );
    }
  };

  const handleApprove = async (leaveId: string) => {
    try {
      await leavesService.approve(leaveId);
      toast.success("Demande approuvée");
      fetchAll();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de l'approbation",
      );
    }
  };

  const openRejectModal = (leaveId: string) => {
    setRejectingLeaveId(leaveId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectingLeaveId) return;
    try {
      await leavesService.reject(rejectingLeaveId, rejectReason || undefined);
      toast.success("Demande refusée");
      setShowRejectModal(false);
      setRejectingLeaveId(null);
      setRejectReason("");
      fetchAll();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || "Erreur lors du refus");
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leavesService.createDelegation(
        delegationForm.delegateId,
        delegationForm.startDate,
        delegationForm.endDate,
      );
      toast.success("Délégation créée avec succès");
      setShowDelegationModal(false);
      setDelegationForm({ delegateId: "", startDate: "", endDate: "" });
      fetchDelegations();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message ||
          "Erreur lors de la création de la délégation",
      );
    }
  };

  const handleDeactivateDelegation = async (delegationId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir désactiver cette délégation ?"))
      return;
    try {
      await leavesService.deactivateDelegation(delegationId);
      toast.success("Délégation désactivée");
      fetchDelegations();
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || "Erreur lors de la désactivation",
      );
    }
  };

  const openEditModal = (leave: Leave) => {
    setEditingLeave(leave);
    setFormData({
      leaveTypeId:
        (leave as Leave & { leaveTypeId?: string }).leaveTypeId ||
        leaveTypes.find((t) => t.code === leave.type)?.id ||
        "",
      startDate: new Date(leave.startDate).toISOString().split("T")[0],
      endDate: new Date(leave.endDate).toISOString().split("T")[0],
      halfDay: leave.halfDay || undefined,
      reason: leave.comment || "",
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      leaveTypeId: leaveTypes.length > 0 ? leaveTypes[0].id : "",
      startDate: "",
      endDate: "",
      halfDay: undefined,
      reason: "",
    });
  };

  // Trouver le type de congé pour un leave (utilise leaveType ou type)
  const getLeaveTypeInfo = (leave: Leave): LeaveTypeConfig | undefined => {
    const leaveWithType = leave as Leave & { leaveType?: LeaveTypeConfig };
    if (leaveWithType.leaveType) {
      return leaveWithType.leaveType;
    }
    return leaveTypes.find((t) => t.code === leave.type);
  };

  const getLeaveTypeBadgeColor = (leave: Leave) => {
    const leaveType = getLeaveTypeInfo(leave);
    if (leaveType?.color) {
      return {
        backgroundColor: leaveType.color + "20",
        color: leaveType.color,
      };
    }
    // Fallback pour les anciens types
    switch (leave.type) {
      case LeaveType.CP:
        return { backgroundColor: "#3B82F620", color: "#3B82F6" };
      case LeaveType.RTT:
        return { backgroundColor: "#10B98120", color: "#10B981" };
      case LeaveType.SICK_LEAVE:
        return { backgroundColor: "#EF444420", color: "#EF4444" };
      case LeaveType.UNPAID:
        return { backgroundColor: "#6B728020", color: "#6B7280" };
      case LeaveType.OTHER:
        return { backgroundColor: "#8B5CF620", color: "#8B5CF6" };
      default:
        return { backgroundColor: "#6B728020", color: "#6B7280" };
    }
  };

  const getLeaveTypeLabel = (leave: Leave) => {
    const leaveType = getLeaveTypeInfo(leave);
    if (leaveType) {
      return leaveType.name;
    }
    // Fallback
    switch (leave.type) {
      case LeaveType.CP:
        return "Congés Payés";
      case LeaveType.RTT:
        return "RTT";
      case LeaveType.SICK_LEAVE:
        return "Maladie";
      case LeaveType.UNPAID:
        return "Sans solde";
      case LeaveType.OTHER:
        return "Autre";
      default:
        return leave.type;
    }
  };

  const getLeaveTypeIcon = (leave: Leave) => {
    const leaveType = getLeaveTypeInfo(leave);
    return leaveType?.icon || "🌴";
  };

  const getLeaveStatusBadgeColor = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return "bg-green-100 text-green-800";
      case LeaveStatus.PENDING:
        return "bg-yellow-100 text-yellow-800";
      case LeaveStatus.REJECTED:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getLeaveStatusLabel = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return "Approuvé";
      case LeaveStatus.PENDING:
        return "En attente";
      case LeaveStatus.REJECTED:
        return "Refusé";
      default:
        return status;
    }
  };

  const getHalfDayLabel = (halfDay?: HalfDay) => {
    if (!halfDay) return "";
    return halfDay === HalfDay.MORNING ? "Matin" : "Après-midi";
  };

  const renderLeaveCard = (
    leave: Leave,
    showUser = false,
    showValidationActions = false,
  ) => {
    const typeColors = getLeaveTypeBadgeColor(leave);
    return (
      <div
        key={leave.id}
        className="p-6 hover:bg-gray-50 transition border-b border-gray-200 last:border-b-0"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1"
                style={typeColors}
              >
                <span>{getLeaveTypeIcon(leave)}</span>
                <span>{getLeaveTypeLabel(leave)}</span>
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getLeaveStatusBadgeColor(leave.status)}`}
              >
                {getLeaveStatusLabel(leave.status)}
              </span>
            </div>

            {showUser && leave.user && (
              <p className="text-sm font-semibold text-gray-900 mb-2">
                {leave.user.firstName} {leave.user.lastName}
                {leave.user.department && (
                  <span className="text-gray-500 font-normal">
                    {" "}
                    - {leave.user.department.name}
                  </span>
                )}
              </p>
            )}

            <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Du :</span>{" "}
                {new Date(leave.startDate).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
                {leave.halfDay &&
                  leave.startDate === leave.endDate &&
                  ` (${getHalfDayLabel(leave.halfDay)})`}
              </div>
              <div>
                <span className="font-medium">Au :</span>{" "}
                {new Date(leave.endDate).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div className="font-semibold text-blue-600">
                {leave.days} jour{leave.days > 1 ? "s" : ""}
              </div>
            </div>

            {leave.comment && (
              <p className="text-sm text-gray-600 mt-2 italic">
                &quot;{leave.comment}&quot;
              </p>
            )}

            {/* Validation info */}
            {leave.validator && leave.status === LeaveStatus.PENDING && (
              <p className="text-xs text-gray-500 mt-2">
                Validateur assigné : {leave.validator.firstName}{" "}
                {leave.validator.lastName}
              </p>
            )}
            {leave.validatedBy && leave.status !== LeaveStatus.PENDING && (
              <p className="text-xs text-gray-500 mt-2">
                {leave.status === LeaveStatus.APPROVED ? "Approuvé" : "Refusé"}{" "}
                par {leave.validatedBy.firstName} {leave.validatedBy.lastName}
                {leave.validatedAt &&
                  ` le ${new Date(leave.validatedAt).toLocaleDateString("fr-FR")}`}
              </p>
            )}
            {leave.validationComment &&
              leave.status === LeaveStatus.REJECTED && (
                <p className="text-xs text-red-600 mt-1">
                  Motif : {leave.validationComment}
                </p>
              )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            {showValidationActions && leave.status === LeaveStatus.PENDING && (
              <>
                <button
                  onClick={() => handleApprove(leave.id)}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                >
                  Approuver
                </button>
                <button
                  onClick={() => openRejectModal(leave.id)}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                >
                  Refuser
                </button>
              </>
            )}
            {!showValidationActions && leave.status === LeaveStatus.PENDING && (
              <button
                onClick={() => openEditModal(leave)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Modifier"
              >
                ✏️
              </button>
            )}
            {(leave.status === LeaveStatus.PENDING ||
              leave.status === LeaveStatus.REJECTED) &&
              !showValidationActions && (
                <button
                  onClick={() => handleDelete(leave.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Supprimer"
                >
                  🗑️
                </button>
              )}
          </div>
        </div>
      </div>
    );
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
            <h1 className="text-2xl font-bold text-gray-900">
              Gestion des congés
            </h1>
            {pendingLeaves.length > 0 && canValidate && (
              <p className="text-orange-600 mt-1 font-medium">
                {pendingLeaves.length} demande(s) en attente de validation
              </p>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Nouvelle demande</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("my-leaves")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "my-leaves"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Mes demandes ({leaves.length})
            </button>
            {canValidate && (
              <button
                onClick={() => setActiveTab("pending-validation")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "pending-validation"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                À valider
                {pendingLeaves.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full">
                    {pendingLeaves.length}
                  </span>
                )}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveTab("all-leaves")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "all-leaves"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Toutes les demandes
              </button>
            )}
            {canValidate && (
              <button
                onClick={() => setActiveTab("delegations")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "delegations"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Délégations
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setActiveTab("leave-types")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "leave-types"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Types de congés
              </button>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* My Leaves Tab */}
          {activeTab === "my-leaves" && (
            <>
              {leaves.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏖️</div>
                  <p className="text-gray-500">Aucune demande de congé</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-800"
                  >
                    Créer ma première demande
                  </button>
                </div>
              ) : (
                <div>
                  {leaves.map((leave) => renderLeaveCard(leave, false, false))}
                </div>
              )}
            </>
          )}

          {/* Pending Validation Tab */}
          {activeTab === "pending-validation" && canValidate && (
            <>
              {pendingLeaves.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-gray-500">
                    Aucune demande en attente de validation
                  </p>
                </div>
              ) : (
                <div>
                  {pendingLeaves.map((leave) =>
                    renderLeaveCard(leave, true, true),
                  )}
                </div>
              )}
            </>
          )}

          {/* All Leaves Tab */}
          {activeTab === "all-leaves" && isAdmin && (
            <>
              <div className="p-4 border-b border-gray-200">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les utilisateurs</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.login})
                    </option>
                  ))}
                </select>
              </div>
              {allLeaves.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Aucune demande</p>
                </div>
              ) : (
                <div>
                  {allLeaves.map((leave) =>
                    renderLeaveCard(leave, true, false),
                  )}
                </div>
              )}
            </>
          )}

          {/* Delegations Tab */}
          {activeTab === "delegations" && canValidate && (
            <div className="p-6 space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDelegationModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  + Créer une délégation
                </button>
              </div>

              {/* Given delegations */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Délégations données
                </h3>
                {delegations.given.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Aucune délégation donnée
                  </p>
                ) : (
                  <div className="space-y-3">
                    {delegations.given.map((d) => (
                      <div
                        key={d.id}
                        className={`p-4 rounded-lg border ${d.isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {d.delegate?.firstName} {d.delegate?.lastName}
                            </p>
                            <p className="text-sm text-gray-600">
                              Du{" "}
                              {new Date(d.startDate).toLocaleDateString(
                                "fr-FR",
                              )}{" "}
                              au{" "}
                              {new Date(d.endDate).toLocaleDateString("fr-FR")}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${d.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                            >
                              {d.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          {d.isActive && (
                            <button
                              onClick={() => handleDeactivateDelegation(d.id)}
                              className="px-3 py-1 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
                            >
                              Désactiver
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Received delegations */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Délégations reçues
                </h3>
                {delegations.received.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Aucune délégation reçue
                  </p>
                ) : (
                  <div className="space-y-3">
                    {delegations.received.map((d) => (
                      <div
                        key={d.id}
                        className={`p-4 rounded-lg border ${d.isActive ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}
                      >
                        <p className="font-medium text-gray-900">
                          De : {d.delegator?.firstName} {d.delegator?.lastName}
                        </p>
                        <p className="text-sm text-gray-600">
                          Du {new Date(d.startDate).toLocaleDateString("fr-FR")}{" "}
                          au {new Date(d.endDate).toLocaleDateString("fr-FR")}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${d.isActive ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                        >
                          {d.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Leave Types Tab */}
          {activeTab === "leave-types" && isAdmin && (
            <div className="p-6">
              <LeaveTypesManager onTypeChange={fetchAll} />
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Nouvelle demande de congé
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de congé *
                </label>
                <select
                  required
                  value={formData.leaveTypeId}
                  onChange={(e) =>
                    setFormData({ ...formData, leaveTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name}
                      {type.maxDaysPerYear && ` (${type.maxDaysPerYear}j/an)`}
                      {!type.isPaid && " - Non rémunéré"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.startDate === formData.endDate &&
                formData.startDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Demi-journée (optionnel)
                    </label>
                    <select
                      value={formData.halfDay || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          halfDay: e.target.value
                            ? (e.target.value as HalfDay)
                            : undefined,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Journée complète</option>
                      <option value={HalfDay.MORNING}>Matin</option>
                      <option value={HalfDay.AFTERNOON}>Après-midi</option>
                    </select>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif (optionnel)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Précisez le motif si nécessaire..."
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Votre demande sera soumise à validation par votre responsable.
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Soumettre la demande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingLeave && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Modifier la demande
            </h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de congé *
                </label>
                <select
                  required
                  value={formData.leaveTypeId}
                  onChange={(e) =>
                    setFormData({ ...formData, leaveTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.icon} {type.name}
                      {type.maxDaysPerYear && ` (${type.maxDaysPerYear}j/an)`}
                      {!type.isPaid && " - Non rémunéré"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.startDate === formData.endDate &&
                formData.startDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Demi-journée (optionnel)
                    </label>
                    <select
                      value={formData.halfDay || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          halfDay: e.target.value
                            ? (e.target.value as HalfDay)
                            : undefined,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Journée complète</option>
                      <option value={HalfDay.MORNING}>Matin</option>
                      <option value={HalfDay.AFTERNOON}>Après-midi</option>
                    </select>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif (optionnel)
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingLeave(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Refuser la demande
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motif du refus (optionnel)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Expliquez la raison du refus..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectingLeaveId(null);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleReject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Confirmer le refus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delegation Modal */}
      {showDelegationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Créer une délégation
            </h2>
            <form onSubmit={handleCreateDelegation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Déléguer à *
                </label>
                <select
                  required
                  value={delegationForm.delegateId}
                  onChange={(e) =>
                    setDelegationForm({
                      ...delegationForm,
                      delegateId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un utilisateur</option>
                  {users
                    .filter((u) => u.id !== user?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Du *
                  </label>
                  <input
                    type="date"
                    required
                    value={delegationForm.startDate}
                    onChange={(e) =>
                      setDelegationForm({
                        ...delegationForm,
                        startDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Au *
                  </label>
                  <input
                    type="date"
                    required
                    value={delegationForm.endDate}
                    onChange={(e) =>
                      setDelegationForm({
                        ...delegationForm,
                        endDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Durant cette période, l&apos;utilisateur sélectionné pourra
                  valider les demandes de congé à votre place.
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowDelegationModal(false);
                    setDelegationForm({
                      delegateId: "",
                      startDate: "",
                      endDate: "",
                    });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Créer la délégation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
