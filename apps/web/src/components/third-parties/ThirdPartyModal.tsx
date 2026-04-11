"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import {
  CreateThirdPartyDto,
  ThirdParty,
  ThirdPartyType,
  UpdateThirdPartyDto,
} from "@/types";

interface ThirdPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateThirdPartyDto | UpdateThirdPartyDto) => Promise<void>;
  thirdParty?: ThirdParty | null;
}

const TYPE_LABELS: Record<ThirdPartyType, string> = {
  [ThirdPartyType.EXTERNAL_PROVIDER]: "Prestataire externe",
  [ThirdPartyType.INTERNAL_NON_USER]: "Agent interne (non-utilisateur)",
  [ThirdPartyType.LEGAL_ENTITY]: "Personne morale",
};

export function ThirdPartyModal({
  isOpen,
  onClose,
  onSave,
  thirdParty,
}: ThirdPartyModalProps) {
  const t = useTranslations("common");

  const [form, setForm] = useState({
    type: ThirdPartyType.EXTERNAL_PROVIDER,
    organizationName: "",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    notes: "",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (thirdParty) {
      setForm({
        type: thirdParty.type,
        organizationName: thirdParty.organizationName,
        contactFirstName: thirdParty.contactFirstName ?? "",
        contactLastName: thirdParty.contactLastName ?? "",
        contactEmail: thirdParty.contactEmail ?? "",
        notes: thirdParty.notes ?? "",
        isActive: thirdParty.isActive,
      });
    } else {
      setForm({
        type: ThirdPartyType.EXTERNAL_PROVIDER,
        organizationName: "",
        contactFirstName: "",
        contactLastName: "",
        contactEmail: "",
        notes: "",
        isActive: true,
      });
    }
  }, [thirdParty, isOpen]);

  const isLegalEntity = form.type === ThirdPartyType.LEGAL_ENTITY;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.organizationName.trim()) {
      toast.error("Nom de l'organisation requis");
      return;
    }
    if (isLegalEntity && (form.contactFirstName || form.contactLastName)) {
      toast.error(
        "Une personne morale ne peut pas avoir de contact nommé (prénom/nom).",
      );
      return;
    }

    const payload: CreateThirdPartyDto | UpdateThirdPartyDto = {
      type: form.type,
      organizationName: form.organizationName.trim(),
      contactFirstName: form.contactFirstName.trim() || undefined,
      contactLastName: form.contactLastName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (thirdParty) {
      (payload as UpdateThirdPartyDto).isActive = form.isActive;
    }

    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error("Error saving third party:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {thirdParty ? "Modifier le tiers" : "Créer un tiers"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label={t("actions.close")}
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as ThirdPartyType,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.values(ThirdPartyType).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l&apos;organisation *
            </label>
            <input
              type="text"
              value={form.organizationName}
              onChange={(e) =>
                setForm((f) => ({ ...f, organizationName: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              required
            />
          </div>

          {!isLegalEntity && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom du contact
                </label>
                <input
                  type="text"
                  value={form.contactFirstName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      contactFirstName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du contact
                </label>
                <input
                  type="text"
                  value={form.contactLastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactLastName: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={100}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email de contact
            </label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, contactEmail: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {thirdParty && (
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Actif
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? t("actions.loading") : t("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
