"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clientsService } from "@/services/clients.service";
import { Client } from "@/types";

interface ClientSelectorProps {
  /** Currently selected client IDs */
  value: string[];
  onChange: (clientIds: string[]) => void;
  placeholder?: string;
  /**
   * If provided, restricts the selectable list to clients whose ID
   * is in this set (e.g. already-attached clients for a given project).
   */
  allowedIds?: string[];
  disabled?: boolean;
}

export function ClientSelector({
  value,
  onChange,
  placeholder = "Sélectionner des clients…",
  allowedIds,
  disabled = false,
}: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clientsService
      .getAll({ isActive: true, limit: 500 })
      .then((res) => setClients(res.data))
      .catch((err) => console.error("Error loading clients:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    let list = clients;
    if (allowedIds) {
      const allowed = new Set(allowedIds);
      list = list.filter((c) => allowed.has(c.id));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [clients, search, allowedIds]);

  const selectedClients = useMemo(
    () => clients.filter((c) => value.includes(c.id)),
    [clients, value],
  );

  const toggle = (clientId: string) => {
    if (value.includes(clientId)) {
      onChange(value.filter((id) => id !== clientId));
    } else {
      onChange([...value, clientId]);
    }
  };

  const remove = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((id) => id !== clientId));
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={handleInputClick}
        className={`
          min-h-[42px] w-full px-3 py-2 border rounded-lg
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-text"}
          ${isOpen ? "ring-2 ring-blue-500 border-transparent" : "border-gray-300"}
          flex flex-wrap items-center gap-1
        `}
      >
        {selectedClients.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
          >
            <span className="max-w-[150px] truncate">{c.name}</span>
            {!disabled && (
              <button
                onClick={(e) => remove(c.id, e)}
                className="ml-1 text-blue-600 hover:text-blue-800"
                type="button"
                aria-label={`Retirer ${c.name}`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}

        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedClients.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
            disabled={loading}
          />
        )}

        {disabled && selectedClients.length === 0 && (
          <span className="text-gray-400 text-sm">
            {loading ? "Chargement…" : placeholder}
          </span>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              Aucun client trouvé
            </div>
          ) : (
            filtered.map((c) => {
              const isSelected = value.includes(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`
                    flex items-center gap-3 px-3 py-2 cursor-pointer
                    ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}
                  `}
                >
                  <div
                    className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"}
                    `}
                  >
                    {isSelected && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-900">{c.name}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
