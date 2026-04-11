"use client";

import { useEffect, useMemo, useState } from "react";
import { thirdPartiesService } from "@/services/third-parties.service";
import { ThirdParty, ThirdPartyType } from "@/types";

interface ThirdPartySelectorProps {
  value?: string | null;
  onChange: (thirdPartyId: string | null) => void;
  placeholder?: string;
  /**
   * If provided, filters the list client-side to third parties whose id
   * belongs to this allowed set. Used e.g. to only show third parties that
   * are attached to a given task/project.
   */
  allowedIds?: string[];
  disabled?: boolean;
}

const TYPE_LABEL: Record<ThirdPartyType, string> = {
  [ThirdPartyType.EXTERNAL_PROVIDER]: "Prestataire",
  [ThirdPartyType.INTERNAL_NON_USER]: "Agent interne",
  [ThirdPartyType.LEGAL_ENTITY]: "Personne morale",
};

export function ThirdPartySelector({
  value,
  onChange,
  placeholder = "Sélectionner un tiers…",
  allowedIds,
  disabled = false,
}: ThirdPartySelectorProps) {
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    thirdPartiesService
      .getAll({ isActive: true, limit: 200 })
      .then((res) => setThirdParties(res.data))
      .catch((err) => console.error("Error loading third parties:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = thirdParties;
    if (allowedIds) {
      const allowed = new Set(allowedIds);
      list = list.filter((tp) => allowed.has(tp.id));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((tp) =>
        tp.organizationName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [thirdParties, search, allowedIds]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un tiers…"
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
      />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
      >
        <option value="">{loading ? "Chargement…" : placeholder}</option>
        {filtered.map((tp) => (
          <option key={tp.id} value={tp.id}>
            {TYPE_LABEL[tp.type]} — {tp.organizationName}
          </option>
        ))}
      </select>
      {!loading && filtered.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          Aucun tiers disponible{allowedIds ? " sur ce contexte" : ""}.
        </p>
      )}
    </div>
  );
}
