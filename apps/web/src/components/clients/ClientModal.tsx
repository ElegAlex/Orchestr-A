"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { Client, CreateClientDto, UpdateClientDto } from "@/types";

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateClientDto | UpdateClientDto) => Promise<void>;
  client?: Client | null;
}

export function ClientModal({
  isOpen,
  onClose,
  onSave,
  client,
}: ClientModalProps) {
  const t = useTranslations("common");

  const [form, setForm] = useState({
    name: "",
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        isActive: client.isActive,
      });
    } else {
      setForm({
        name: "",
        isActive: true,
      });
    }
  }, [client, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nom du client requis");
      return;
    }

    const payload: CreateClientDto | UpdateClientDto = {
      name: form.name.trim(),
    };
    if (client) {
      (payload as UpdateClientDto).isActive = form.isActive;
    }

    setSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error("Error saving client:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {client ? "Modifier le client" : "Créer un client"}
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
              Nom *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              required
              autoFocus
            />
          </div>

          {client && (
            <div className="flex items-center gap-2">
              <input
                id="clientIsActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <label htmlFor="clientIsActive" className="text-sm text-gray-700">
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
