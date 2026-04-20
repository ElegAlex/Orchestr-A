"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ROLE_TEMPLATE_KEYS, ROLE_TEMPLATES, type RoleTemplateKey } from "rbac";
import { rolesService } from "@/services/roles.service";

interface CreateRoleFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Formulaire de création de rôle (modale).
 *
 * Un rôle = un libellé + un pointeur vers un template. Les permissions
 * sont strictement celles du template choisi, zéro personnalisation possible.
 *
 * Champs :
 *   - `code`    : SCREAMING_SNAKE_CASE, 2-64 chars.
 *   - `label`   : libellé affiché (1-120 chars).
 *   - `templateKey` : l'un des 26 templates RBAC.
 *   - `description` : optionnel, ≤ 500 chars.
 *
 * Utilise des inputs HTML natifs (input[name=code], select[name=templateKey])
 * pour compatibilité avec les sélecteurs E2E.
 */
export function CreateRoleForm({
  isOpen,
  onClose,
  onCreated,
}: CreateRoleFormProps) {
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [templateKey, setTemplateKey] = useState<RoleTemplateKey>("BASIC_USER");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Réinitialiser le form quand la modale ouvre/ferme.
  useEffect(() => {
    if (isOpen) {
      setCode("");
      setLabel("");
      setTemplateKey("BASIC_USER");
      setDescription("");
      setSubmitting(false);
    }
  }, [isOpen]);

  // Fermeture clavier Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCode = code.trim();
    const trimmedLabel = label.trim();

    if (!CODE_PATTERN.test(trimmedCode)) {
      toast.error("Le code doit être en SCREAMING_SNAKE_CASE (ex: MON_ROLE).");
      return;
    }
    if (trimmedLabel.length === 0) {
      toast.error("Le libellé est requis.");
      return;
    }

    setSubmitting(true);
    try {
      await rolesService.createRole({
        code: trimmedCode,
        label: trimmedLabel,
        templateKey,
        description: description.trim() || undefined,
      });
      toast.success("Rôle créé avec succès.");
      onCreated();
      onClose();
    } catch (err) {
      const axiosErr = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (axiosErr.response?.status === 409) {
        toast.error(`Le code "${trimmedCode}" est déjà utilisé.`);
      } else {
        toast.error(
          axiosErr.response?.data?.message ?? "Erreur lors de la création.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !submitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-role-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden"
      >
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2
              id="create-role-title"
              className="text-lg font-semibold text-gray-900"
            >
              Créer un rôle
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Associe un libellé à un template RBAC. Les permissions sont
              strictement celles du template choisi, non modifiables.
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label
                htmlFor="create-role-code"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Code <span className="text-red-600">*</span>
              </label>
              <input
                id="create-role-code"
                name="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MON_ROLE"
                maxLength={64}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Identifiant technique en SCREAMING_SNAKE_CASE, unique.
              </p>
            </div>

            <div>
              <label
                htmlFor="create-role-label"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Libellé <span className="text-red-600">*</span>
              </label>
              <input
                id="create-role-label"
                name="label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Chef de projet spécialisé"
                maxLength={120}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="create-role-template"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Template <span className="text-red-600">*</span>
              </label>
              <select
                id="create-role-template"
                name="templateKey"
                value={templateKey}
                onChange={(e) =>
                  setTemplateKey(e.target.value as RoleTemplateKey)
                }
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLE_TEMPLATE_KEYS.map((key) => {
                  const tpl = ROLE_TEMPLATES[key];
                  return (
                    <option key={key} value={key}>
                      {key} — {tpl.defaultLabel}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Détermine les permissions effectives du rôle. Non modifiable
                après création.
              </p>
            </div>

            <div>
              <label
                htmlFor="create-role-description"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description
              </label>
              <textarea
                id="create-role-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Création…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
