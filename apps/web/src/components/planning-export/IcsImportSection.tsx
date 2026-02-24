"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";
import {
  planningExportService,
  IcsPreviewEvent,
} from "@/services/planning-export.service";

export function IcsImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<IcsPreviewEvent[]>([]);
  const [icsContent, setIcsContent] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    setIcsContent(content);
    setImportResult(null);

    try {
      setLoadingPreview(true);
      const events = await planningExportService.previewImport(content);
      setPreview(events);
    } catch {
      toast.error("Impossible de lire le fichier ICS");
      setPreview([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!icsContent) return;
    try {
      setLoadingImport(true);
      const result = await planningExportService.importIcs(icsContent);
      setImportResult(result);
      toast.success(
        `Import terminé : ${result.imported} événement(s) importé(s)`,
      );
      setPreview([]);
      setIcsContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error("Erreur lors de l'import");
    } finally {
      setLoadingImport(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Importer un planning</h3>
      <p className="text-sm text-gray-600">
        Importez des événements depuis un fichier ICS (iCalendar).
      </p>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingPreview}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm disabled:opacity-50"
        >
          {loadingPreview ? "Chargement…" : "Sélectionner un fichier .ics"}
        </button>
      </div>

      {preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 font-medium">
            {preview.length} événement(s) détecté(s) :
          </p>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">
                    Titre
                  </th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">
                    Horaire
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((ev, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{ev.title}</td>
                    <td className="px-4 py-2 text-gray-600">{ev.date}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {ev.startTime
                        ? `${ev.startTime}${ev.endTime ? ` → ${ev.endTime}` : ""}`
                        : "Journée entière"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={loadingImport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {loadingImport ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Import en cours…
              </>
            ) : (
              `Confirmer l'import (${preview.length} événement(s))`
            )}
          </button>
        </div>
      )}

      {importResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          Import terminé : <strong>{importResult.imported}</strong> importé(s),{" "}
          <strong>{importResult.skipped}</strong> ignoré(s).
        </div>
      )}
    </div>
  );
}
