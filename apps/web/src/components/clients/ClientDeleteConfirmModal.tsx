"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { clientsService } from "@/services/clients.service";
import { Client, ClientDeletionImpact } from "@/types";

interface ClientDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  client: Client | null;
}

export function ClientDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  client,
}: ClientDeleteConfirmModalProps) {
  const t = useTranslations("common");
  const [impact, setImpact] = useState<ClientDeletionImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !client) {
      setImpact(null);
      return;
    }
    setLoading(true);
    clientsService
      .getDeletionImpact(client.id)
      .then(setImpact)
      .catch((err) => {
        console.error("Error fetching deletion impact:", err);
        toast.error("Impossible de calculer l'impact de la suppression");
      })
      .finally(() => setLoading(false));
  }, [isOpen, client]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Error deleting client:", err);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !client) return null;

  const hasProjects = impact && impact.projectsCount > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-red-700">
            Supprimer définitivement ce client ?
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-800">
            Cette action est <strong>irréversible</strong>. Le client{" "}
            <strong>{client.name}</strong> sera supprimé définitivement.
          </p>

          {loading ? (
            <p className="text-gray-500 italic">
              Calcul de l&apos;impact en cours…
            </p>
          ) : impact ? (
            <ul className="bg-red-50 border border-red-200 rounded-md p-4 text-sm space-y-1">
              <li>
                <span className="font-semibold">{impact.projectsCount}</span>{" "}
                projet(s) rattaché(s)
              </li>
            </ul>
          ) : null}

          {hasProjects && (
            <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-md p-3">
              Ce client est encore rattaché à des projets. Vous devez détacher
              le client de tous ses projets avant de pouvoir le supprimer.
            </p>
          )}
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
            disabled={deleting || loading || !!hasProjects}
            className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Suppression…" : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
