"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MainLayout } from "@/components/MainLayout";
import { ClientDeleteConfirmModal } from "@/components/clients/ClientDeleteConfirmModal";
import { ClientModal } from "@/components/clients/ClientModal";
import { usePermissions } from "@/hooks/usePermissions";
import { clientsService } from "@/services/clients.service";
import {
  Client,
  ClientProjectsResponse,
  CreateClientDto,
  UpdateClientDto,
} from "@/types";

type Tab = "infos" | "projets";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  ON_HOLD: "En pause",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const PROJECT_STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();
  const tc = useTranslations("common");
  const { hasPermission } = usePermissions();

  const canUpdate = hasPermission("clients:update");
  const canDelete = hasPermission("clients:delete");

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("infos");

  const [projectsData, setProjectsData] =
    useState<ClientProjectsResponse | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const c = await clientsService.getById(params.id);
      setClient(c);
    } catch (err) {
      console.error("Error loading client:", err);
      toast.error("Client introuvable");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await clientsService.getProjectsWithSummary(params.id);
      setProjectsData(data);
    } catch (err) {
      console.error("Error loading client projects:", err);
      toast.error("Impossible de charger les projets du client");
    } finally {
      setProjectsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "projets" && !projectsData) {
      fetchProjects();
    }
  }, [activeTab, projectsData, fetchProjects]);

  const handleSave = async (data: CreateClientDto | UpdateClientDto) => {
    if (!client) return;
    try {
      await clientsService.update(client.id, data);
      toast.success("Client mis à jour");
      await fetchData();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur";
      toast.error(typeof message === "string" ? message : "Erreur");
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    try {
      await clientsService.delete(client.id);
      toast.success("Client supprimé");
      router.push(`/${locale}/clients`);
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Suppression impossible";
      toast.error(
        typeof message === "string" ? message : "Suppression impossible",
      );
      throw err;
    }
  };

  const handleToggleActive = async () => {
    if (!client) return;
    try {
      await clientsService.update(client.id, { isActive: !client.isActive });
      toast.success(client.isActive ? "Client archivé" : "Client réactivé");
      await fetchData();
    } catch (err) {
      console.error("Error toggling client active:", err);
      toast.error("Impossible de modifier le statut du client");
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/clients`)}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Retour à la liste
        </button>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            {tc("actions.loading")}
          </div>
        ) : !client ? (
          <div className="p-8 text-center text-gray-500">
            Client introuvable.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {client.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        client.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {client.isActive ? "Actif" : "Archivé"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canUpdate && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        {tc("actions.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleActive}
                        className={`px-3 py-1 text-sm rounded ${
                          client.isActive
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {client.isActive ? "Archiver" : "Réactiver"}
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                    >
                      {tc("actions.delete")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-4">
              <nav className="-mb-px flex gap-6">
                {(["infos", "projets"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium border-b-2 transition ${
                      activeTab === tab
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {tab === "infos" ? "Informations" : "Projets"}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab: Infos */}
            {activeTab === "infos" && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Nom</dt>
                    <dd className="font-medium text-gray-900">{client.name}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Statut</dt>
                    <dd className="font-medium text-gray-900">
                      {client.isActive ? "Actif" : "Archivé"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Créé le</dt>
                    <dd className="font-medium text-gray-900">
                      {new Date(client.createdAt).toLocaleDateString(locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Mis à jour le</dt>
                    <dd className="font-medium text-gray-900">
                      {new Date(client.updatedAt).toLocaleDateString(locale)}
                    </dd>
                  </div>
                  {client._count !== undefined && (
                    <div>
                      <dt className="text-gray-500">Projets rattachés</dt>
                      <dd className="font-medium text-gray-900">
                        {client._count.projects}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Tab: Projets */}
            {activeTab === "projets" && (
              <>
                {projectsLoading ? (
                  <div className="p-8 text-center text-gray-500">
                    {tc("actions.loading")}
                  </div>
                ) : projectsData ? (
                  <>
                    {/* Summary banner */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {projectsData.summary.projectsActive}
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1">
                          Projets actifs
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {projectsData.summary.projectsTotal}
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1">
                          Total projets
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {projectsData.summary.budgetHoursTotal}h
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1">
                          Budget cumulé
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {projectsData.summary.hoursLoggedTotal}h
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1">
                          Heures saisies
                        </div>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                        <div
                          className={`text-2xl font-bold ${
                            projectsData.summary.varianceHours < 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {projectsData.summary.varianceHours > 0 ? "+" : ""}
                          {projectsData.summary.varianceHours}h
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1">
                          Écart (budget − saisi)
                        </div>
                      </div>
                    </div>

                    {/* Projects table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      {projectsData.projects.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          Aucun projet rattaché à ce client.
                        </div>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Projet
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Statut
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Manager
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Dates
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                Charge saisie
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {projectsData.projects.map((p) => (
                              <tr key={p.id}>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {p.name}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-block text-xs px-2 py-1 rounded ${
                                      PROJECT_STATUS_BADGE[p.status] ??
                                      "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {PROJECT_STATUS_LABELS[p.status] ??
                                      p.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-700">
                                  {p.manager
                                    ? `${p.manager.firstName} ${p.manager.lastName}`
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {p.startDate
                                    ? new Date(p.startDate).toLocaleDateString(
                                        locale,
                                      )
                                    : "—"}
                                  {" → "}
                                  {p.endDate
                                    ? new Date(p.endDate).toLocaleDateString(
                                        locale,
                                      )
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-right text-gray-700">
                                  {p.hoursLogged}h
                                  {p.budgetHours != null && (
                                    <span className="text-gray-400">
                                      {" "}
                                      / {p.budgetHours}h
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      <ClientModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
        client={client}
      />

      <ClientDeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        client={client}
      />
    </MainLayout>
  );
}
