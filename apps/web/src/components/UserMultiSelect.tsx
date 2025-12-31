"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "@/types";

interface UserMultiSelectProps {
  users: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}

export function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  label,
  placeholder = "Selectionner des utilisateurs",
  disabled = false,
  hint,
}: UserMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fermer le dropdown si on clique à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrer les utilisateurs par la recherche
  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  // Récupérer les utilisateurs sélectionnés
  const selectedUsers = users.filter((u) => selectedIds.includes(u.id));

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== userId));
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-900 mb-2">
          {label}
        </label>
      )}

      {/* Champ de sélection */}
      <div
        onClick={handleInputClick}
        className={`
          min-h-[42px] w-full px-3 py-2 border rounded-lg
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-text"}
          ${isOpen ? "ring-2 ring-blue-500 border-transparent" : "border-gray-300"}
          flex flex-wrap items-center gap-1
        `}
      >
        {/* Tags des utilisateurs sélectionnés */}
        {selectedUsers.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
          >
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-medium">
              {user.firstName[0]}
              {user.lastName[0]}
            </span>
            <span className="max-w-[120px] truncate">
              {user.firstName} {user.lastName}
            </span>
            {!disabled && (
              <button
                onClick={(e) => removeUser(user.id, e)}
                className="ml-1 text-blue-600 hover:text-blue-800"
                type="button"
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

        {/* Input pour la recherche */}
        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedUsers.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
          />
        )}

        {/* Placeholder si désactivé et vide */}
        {disabled && selectedUsers.length === 0 && (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        )}
      </div>

      {/* Hint */}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              Aucun utilisateur trouve
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedIds.includes(user.id);
              return (
                <div
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`
                    flex items-center gap-3 px-3 py-2 cursor-pointer
                    ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}
                  `}
                >
                  {/* Checkbox */}
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

                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {user.firstName[0]}
                    {user.lastName[0]}
                  </div>

                  {/* Nom */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {user.firstName} {user.lastName}
                    </div>
                    {user.email && (
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
