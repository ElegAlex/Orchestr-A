"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { MainLayout } from "@/components/MainLayout";
import { ThirdPartyDeleteConfirmModal } from "@/components/third-parties/ThirdPartyDeleteConfirmModal";
import { ThirdPartyModal } from "@/components/third-parties/ThirdPartyModal";
import { usePermissions } from "@/hooks/usePermissions";
import { thirdPartiesService } from "@/services/third-parties.service";
import {
  CreateThirdPartyDto,
  ThirdParty,
  ThirdPartyType,
  UpdateThirdPartyDto,
} from "@/types";

const TYPE_LABELS: Record<ThirdPartyType, string> = {
  [ThirdPartyType.EXTERNAL_PROVIDER]: "Prestataire externe",
  [ThirdPartyType.INTERNAL_NON_USER]: "Agent interne (non-utilisateur)",
  [ThirdPartyType.LEGAL_ENTITY]: "Personne morale",
};

const TYPE_BADGE: Record<ThirdPartyType, string> = {
  [ThirdPartyType.EXTERNAL_PROVIDER]: "bg-blue-100 text-blue-800",
  [ThirdPartyType.INTERNAL_NON_USER]: "bg-purple-100 text-purple-800",
  [ThirdPartyType.LEGAL_ENTITY]: "bg-gray-100 text-gray-800",
};

export default function ThirdPartiesPage() {
  const tc = useTranslations("common");
  const locale = useLocale();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission("third_parties:create");
  const canUpdate = hasPermission("third_parties:update");
  const canDelete = hasPermission("third_parties:delete");

  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | ThirdPartyType>("");
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ThirdParty | null>(null);
  const [deleting, setDeleting] = useState<ThirdParty | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await thirdPartiesService.getAll({
        search: search || undefined,
        type: typeFilter || undefined,
        isActive: showInactive ? undefined : true,
        limit: 200,
      });
      setThirdParties(res.data);
    } catch (err) {
      console.error("Error loading third parties:", err);
      toast.error("Impossible de charger les tiers");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, showInactive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (
    data: CreateThirdPartyDto | UpdateThirdPartyDto,
  ) => {
    try {
      if (editing) {
        await thirdPartiesService.update(editing.id, data);
        toast.success("Tiers mis à jour");
      } else {
        await thirdPartiesService.create(data as CreateThirdPartyDto);
        toast.success("Tiers créé");
      }
      setEditing(null);
      await fetchData();
    } catch (err) {
      console.error("Error saving third party:", err);
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
      await thirdPartiesService.delete(deleting.id);
      toast.success("Tiers supprimé");
      setDeleting(null);
      await fetchData();
    } catch (err) {
      console.error("Error deleting third party:", err);
      toast.error("Suppression impossible");
      throw err;
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tiers</h1>
            <p className="text-gray-600 mt-1">
              Prestataires, agents internes, personnes morales
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + Nouveau tiers
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom…"
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "" | ThirdPartyType)
              }
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous les types</option>
              {Object.values(ThirdPartyType).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4"
              />
              Inclure les tiers archivés
            </label>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              {tc("actions.loading")}
            </div>
          ) : thirdParties.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucun tiers à afficher.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Organisation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Usage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {thirdParties.map((tp) => (
                  <tr
                    key={tp.id}
                    className={!tp.isActive ? "bg-gray-50 opacity-70" : ""}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/third-parties/${tp.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {tp.organizationName}
                      </Link>
                      {!tp.isActive && (
                        <span className="ml-2 text-xs text-gray-500">
                          (archivé)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded ${TYPE_BADGE[tp.type]}`}
                      >
                        {TYPE_LABELS[tp.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {tp.contactFirstName || tp.contactLastName
                        ? `${tp.contactFirstName ?? ""} ${tp.contactLastName ?? ""}`.trim()
                        : tp.contactEmail || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {tp._count ? (
                        <>
                          {tp._count.projectMemberships} projet(s),{" "}
                          {tp._count.taskAssignments} tâche(s),{" "}
                          {tp._count.timeEntries} saisie(s)
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(tp);
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
                          onClick={() => setDeleting(tp)}
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

      <ThirdPartyModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        thirdParty={editing}
      />

      <ThirdPartyDeleteConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        thirdParty={deleting}
      />
    </MainLayout>
  );
}
