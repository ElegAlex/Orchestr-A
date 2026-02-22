"use client";

import { useState, useRef, useEffect } from "react";
import { Service } from "@/types";

interface ServiceMultiSelectProps {
  services: Service[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  memberCounts?: Record<string, number>;
}

export function ServiceMultiSelect({
  services,
  selectedIds,
  onChange,
  label,
  placeholder = "Sélectionner des services",
  disabled = false,
  memberCounts = {},
}: ServiceMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const filteredServices = services.filter((service) => {
    const name = service.name.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query);
  });

  const selectedServices = services.filter((s) => selectedIds.includes(s.id));

  const toggleService = (serviceId: string) => {
    if (selectedIds.includes(serviceId)) {
      onChange(selectedIds.filter((id) => id !== serviceId));
    } else {
      onChange([...selectedIds, serviceId]);
    }
  };

  const removeService = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== serviceId));
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

      <div
        onClick={handleInputClick}
        className={`
          min-h-[42px] w-full px-3 py-2 border rounded-lg
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-text"}
          ${isOpen ? "ring-2 ring-purple-500 border-transparent" : "border-gray-300"}
          flex flex-wrap items-center gap-1
        `}
      >
        {selectedServices.map((service) => (
          <span
            key={service.id}
            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-sm"
          >
            {service.color && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: service.color }}
              />
            )}
            <span className="max-w-[150px] truncate">
              {service.name}
            </span>
            {memberCounts[service.id] !== undefined && (
              <span className="text-purple-600 text-xs">
                ({memberCounts[service.id]})
              </span>
            )}
            {!disabled && (
              <button
                onClick={(e) => removeService(service.id, e)}
                className="ml-1 text-purple-600 hover:text-purple-800"
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

        {!disabled && (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedServices.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[100px] outline-none bg-transparent text-sm"
          />
        )}

        {disabled && selectedServices.length === 0 && (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        )}
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredServices.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              Aucun service trouvé
            </div>
          ) : (
            filteredServices.map((service) => {
              const isSelected = selectedIds.includes(service.id);
              const count = memberCounts[service.id];
              return (
                <div
                  key={service.id}
                  onClick={() => toggleService(service.id)}
                  className={`
                    flex items-center gap-3 px-3 py-2 cursor-pointer
                    ${isSelected ? "bg-purple-50" : "hover:bg-gray-50"}
                  `}
                >
                  <div
                    className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                      ${isSelected ? "bg-purple-600 border-purple-600" : "border-gray-300"}
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

                  {service.color && (
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: service.color }}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {service.name}
                    </div>
                    {count !== undefined && (
                      <div className="text-xs text-gray-500">
                        {count} membre{count !== 1 ? "s" : ""}
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
