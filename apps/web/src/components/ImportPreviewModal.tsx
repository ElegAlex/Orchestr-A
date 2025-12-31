"use client";

import { useState } from "react";

type PreviewStatus = "valid" | "duplicate" | "error" | "warning";

interface PreviewItem {
  lineNumber: number;
  status: PreviewStatus;
  messages: string[];
  data: Record<string, unknown>;
  resolvedFields?: Record<
    string,
    { id: string; name: string } | { id: string; email: string; name: string }
  >;
}

interface PreviewSummary {
  total: number;
  valid: number;
  duplicates: number;
  errors: number;
  warnings: number;
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  items: {
    valid: PreviewItem[];
    duplicates: PreviewItem[];
    errors: PreviewItem[];
    warnings: PreviewItem[];
  };
  summary: PreviewSummary;
  columns: { key: string; label: string }[];
  isImporting?: boolean;
}

export function ImportPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  items,
  summary,
  columns,
  isImporting = false,
}: ImportPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<
    "all" | "valid" | "warnings" | "duplicates" | "errors"
  >("all");

  if (!isOpen) return null;

  const allItems = [
    ...items.valid,
    ...items.warnings,
    ...items.duplicates,
    ...items.errors,
  ].sort((a, b) => a.lineNumber - b.lineNumber);

  const getFilteredItems = () => {
    switch (activeTab) {
      case "valid":
        return items.valid;
      case "warnings":
        return items.warnings;
      case "duplicates":
        return items.duplicates;
      case "errors":
        return items.errors;
      default:
        return allItems;
    }
  };

  const getStatusBadge = (status: PreviewStatus) => {
    switch (status) {
      case "valid":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
            Valide
          </span>
        );
      case "warning":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
            Avertissement
          </span>
        );
      case "duplicate":
        return (
          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
            Doublon
          </span>
        );
      case "error":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
            Erreur
          </span>
        );
      default:
        return null;
    }
  };

  const canImport = summary.valid > 0 || summary.warnings > 0;
  const importCount = summary.valid + summary.warnings;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {summary.total}
              </p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {summary.valid}
              </p>
              <p className="text-xs text-gray-600">Valides</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {summary.warnings}
              </p>
              <p className="text-xs text-gray-600">Avertissements</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {summary.duplicates}
              </p>
              <p className="text-xs text-gray-600">Doublons</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {summary.errors}
              </p>
              <p className="text-xs text-gray-600">Erreurs</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === "all"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Tous ({summary.total})
            </button>
            <button
              onClick={() => setActiveTab("valid")}
              className={`whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === "valid"
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Valides ({summary.valid})
            </button>
            <button
              onClick={() => setActiveTab("warnings")}
              className={`whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === "warnings"
                  ? "border-yellow-500 text-yellow-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Avertissements ({summary.warnings})
            </button>
            <button
              onClick={() => setActiveTab("duplicates")}
              className={`whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === "duplicates"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Doublons ({summary.duplicates})
            </button>
            <button
              onClick={() => setActiveTab("errors")}
              className={`whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm transition ${
                activeTab === "errors"
                  ? "border-red-500 text-red-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Erreurs ({summary.errors})
            </button>
          </nav>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {getFilteredItems().length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun element dans cette categorie
              </div>
            ) : (
              getFilteredItems().map((item, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    item.status === "valid"
                      ? "border-green-200 bg-green-50"
                      : item.status === "warning"
                        ? "border-yellow-200 bg-yellow-50"
                        : item.status === "duplicate"
                          ? "border-orange-200 bg-orange-50"
                          : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-700">
                        Ligne {item.lineNumber}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>

                  {/* Data display */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm mb-2">
                    {columns.slice(0, 4).map((col) => {
                      const value = item.data[col.key];
                      if (!value) return null;
                      return (
                        <div key={col.key}>
                          <span className="text-gray-500">{col.label}:</span>{" "}
                          <span className="text-gray-900">{String(value)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resolved fields */}
                  {item.resolvedFields &&
                    Object.keys(item.resolvedFields).length > 0 && (
                      <div className="text-sm text-green-700 mb-2">
                        {Object.entries(item.resolvedFields).map(
                          ([key, value]) => (
                            <span key={key} className="mr-3">
                              {key}:{" "}
                              <strong>
                                {(value as { name?: string; email?: string })
                                  .name ||
                                  (value as { name?: string; email?: string })
                                    .email}
                              </strong>
                            </span>
                          ),
                        )}
                      </div>
                    )}

                  {/* Messages */}
                  {item.messages.length > 0 && (
                    <div className="text-sm">
                      {item.messages.map((msg, i) => (
                        <p
                          key={i}
                          className={
                            item.status === "error"
                              ? "text-red-700"
                              : item.status === "warning"
                                ? "text-yellow-700"
                                : item.status === "duplicate"
                                  ? "text-orange-700"
                                  : "text-green-700"
                          }
                        >
                          {msg}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {canImport ? (
              <span>
                <strong>{importCount}</strong> element(s) seront importes
                {summary.duplicates > 0 && (
                  <span className="text-orange-600">
                    {" "}
                    ({summary.duplicates} doublon(s) ignores)
                  </span>
                )}
                {summary.errors > 0 && (
                  <span className="text-red-600">
                    {" "}
                    ({summary.errors} erreur(s) non importees)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-red-600">
                Aucun element valide a importer
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={!canImport || isImporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Import en cours...</span>
                </>
              ) : (
                <span>Confirmer l&apos;import ({importCount})</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
