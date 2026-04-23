"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { thirdPartiesService } from "@/services/third-parties.service";
import { ThirdParty, ThirdPartyDeletionImpact } from "@/types";

interface ThirdPartyDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  thirdParty: ThirdParty | null;
}

export function ThirdPartyDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  thirdParty,
}: ThirdPartyDeleteConfirmModalProps) {
  const t = useTranslations("common");
  const [impact, setImpact] = useState<ThirdPartyDeletionImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !thirdParty) {
      setImpact(null);
      return;
    }
    setLoading(true);
    thirdPartiesService
      .getDeletionImpact(thirdParty.id)
      .then(setImpact)
      .catch((err) => {
        console.error("Error fetching deletion impact:", err);
        toast.error("Impossible de calculer l'impact de la suppression");
      })
      .finally(() => setLoading(false));
  }, [isOpen, thirdParty]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Error deleting third party:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !thirdParty) return null;

  const total = impact
    ? impact.timeEntriesCount +
      impact.taskAssignmentsCount +
      impact.projectMembershipsCount
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-red-700">
            Supprimer définitivement ce tiers ?
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-800">
            Cette action est <strong>irréversible</strong>. Le tiers{" "}
            <strong>{thirdParty.organizationName}</strong> et toutes ses données
            liées seront supprimés :
          </p>

          {loading ? (
            <p className="text-gray-500 italic">
              Calcul de l&apos;impact en cours…
            </p>
          ) : impact ? (
            <ul className="bg-red-50 border border-red-200 rounded-md p-4 text-sm space-y-1">
              <li>
                <span className="font-semibold">{impact.timeEntriesCount}</span>{" "}
                déclaration(s) de temps
              </li>
              <li>
                <span className="font-semibold">
                  {impact.taskAssignmentsCount}
                </span>{" "}
                assignation(s) à des tâches
              </li>
              <li>
                <span className="font-semibold">
                  {impact.projectMembershipsCount}
                </span>{" "}
                rattachement(s) à des projets
              </li>
              <li className="pt-2 border-t border-red-200 mt-2">
                <span className="font-semibold">Total :</span> {total}{" "}
                élément(s) supprimé(s) en cascade
              </li>
            </ul>
          ) : null}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {t("actions.cancel")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || loading}
            className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
