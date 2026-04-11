"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function ThirdPartyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();
  const tc = useTranslations("common");
  const { hasPermission } = usePermissions();

  const canUpdate = hasPermission("third_parties:update");
  const canDelete = hasPermission("third_parties:delete");

  const [thirdParty, setThirdParty] = useState<ThirdParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tp = await thirdPartiesService.getById(params.id);
      setThirdParty(tp);
    } catch (err) {
      console.error("Error loading third party:", err);
      toast.error("Tiers introuvable");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async (
    data: CreateThirdPartyDto | UpdateThirdPartyDto,
  ) => {
    if (!thirdParty) return;
    try {
      await thirdPartiesService.update(thirdParty.id, data);
      toast.success("Tiers mis à jour");
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
    if (!thirdParty) return;
    try {
      await thirdPartiesService.delete(thirdParty.id);
      toast.success("Tiers supprimé");
      router.push(`/${locale}/third-parties`);
    } catch (err) {
      console.error("Error deleting third party:", err);
      toast.error("Suppression impossible");
      throw err;
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/third-parties`)}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Retour à la liste
        </button>

        {loading ? (
          <div className="p-8 text-center text-gray-500">
            {tc("actions.loading")}
          </div>
        ) : !thirdParty ? (
          <div className="p-8 text-center text-gray-500">
            Tiers introuvable.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {thirdParty.organizationName}
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {TYPE_LABELS[thirdParty.type]}
                    {!thirdParty.isActive && (
                      <span className="ml-2 text-xs px-2 py-1 rounded bg-gray-200">
                        Archivé
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => setEditOpen(true)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      {tc("actions.edit")}
                    </button>
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

              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {(thirdParty.contactFirstName || thirdParty.contactLastName) && (
                  <div>
                    <dt className="text-gray-500">Contact</dt>
                    <dd className="font-medium text-gray-900">
                      {[thirdParty.contactFirstName, thirdParty.contactLastName]
                        .filter(Boolean)
                        .join(" ")}
                    </dd>
                  </div>
                )}
                {thirdParty.contactEmail && (
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd className="font-medium text-gray-900">
                      <a
                        href={`mailto:${thirdParty.contactEmail}`}
                        className="text-blue-600 hover:underline"
                      >
                        {thirdParty.contactEmail}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Créé le</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(thirdParty.createdAt).toLocaleDateString(locale)}
                  </dd>
                </div>
                {thirdParty.createdBy && (
                  <div>
                    <dt className="text-gray-500">Créé par</dt>
                    <dd className="font-medium text-gray-900">
                      {thirdParty.createdBy.firstName}{" "}
                      {thirdParty.createdBy.lastName}
                    </dd>
                  </div>
                )}
              </dl>

              {thirdParty.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <dt className="text-gray-500 text-sm mb-1">Notes</dt>
                  <dd className="text-gray-900 whitespace-pre-wrap">
                    {thirdParty.notes}
                  </dd>
                </div>
              )}
            </div>

            {thirdParty._count && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Activité</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded p-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {thirdParty._count.projectMemberships}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">
                      Projets rattachés
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {thirdParty._count.taskAssignments}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">
                      Tâches assignées
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-4">
                    <div className="text-2xl font-bold text-gray-900">
                      {thirdParty._count.timeEntries}
                    </div>
                    <div className="text-xs text-gray-600 uppercase">
                      Saisies de temps
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ThirdPartyModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
        thirdParty={thirdParty}
      />

      <ThirdPartyDeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        thirdParty={thirdParty}
      />
    </MainLayout>
  );
}
