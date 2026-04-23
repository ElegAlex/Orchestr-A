"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MainLayout } from "@/components/MainLayout";
import { ClientDeleteConfirmModal } from "@/components/clients/ClientDeleteConfirmModal";
import { ClientModal } from "@/components/clients/ClientModal";
import { usePermissions } from "@/hooks/usePermissions";
import { clientsService } from "@/services/clients.service";
import { Client, CreateClientDto, UpdateClientDto } from "@/types";

export default function ClientsPage() {
  const tc = useTranslations("common");
  const locale = useLocale();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission("clients:create");
  const canUpdate = hasPermission("clients:update");
  const canDelete = hasPermission("clients:delete");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientsService.getAll({
        search: search || undefined,
        isActive: showInactive ? undefined : true,
        limit: 200,
      });
      setClients(res.data);
    } catch (err) {
      console.error("Error loading clients:", err);
      toast.error("Impossible de charger les clients");
    } finally {
      setLoading(false);
    }
  }, [search, showInactive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (data: CreateClientDto | UpdateClientDto) => {
    try {
      if (editing) {
        await clientsService.update(editing.id, data);
        toast.success("Client mis à jour");
      } else {
        await clientsService.create(data as CreateClientDto);
        toast.success("Client créé");
      }
      setEditing(null);
      await fetchData();
    } catch (err) {
      console.error("Error saving client:", err);
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Erreur lors de la sauvegarde";
      toast.error(typeof message === "string" ? message : "Erreur");
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await clientsService.delete(deleting.id);
      toast.success("Client supprimé");
      setDeleting(null);
      await fetchData();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? "Suppression impossible";
      toast.error(typeof message === "string" ? message : "Suppression impossible");
      throw err;
    }
  };

  const handleExport = () => {
    toast("Export disponible prochainement (Wave 4)", { icon: "ℹ️" });
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600 mt-1">
              Commanditaires et collectivités partenaires
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
            >
              Exporter
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Nouveau client
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom…"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4"
              />
              Inclure les clients archivés
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              {tc("actions.loading")}
            </div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun client à afficher.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Projets
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className={!c.isActive ? "bg-gray-50 opacity-70" : ""}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/clients/${c.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {c.name}
                      </Link>
                      {!c.isActive && (
                        <span className="ml-2 text-xs text-gray-500">
                          (archivé)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded ${
                          c.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {c.isActive ? "Actif" : "Archivé"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c._count !== undefined ? (
                        <>{c._count.projects} projet(s)</>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(c);
                            setModalOpen(true);
                          }}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {tc("actions.edit")}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleting(c)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          {tc("actions.delete")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ClientModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        client={editing}
      />

      <ClientDeleteConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        client={deleting}
      />
    </MainLayout>
  );
}
