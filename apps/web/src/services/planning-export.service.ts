import { api } from "@/lib/api";

export interface IcsPreviewEvent {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

export const planningExportService = {
  async exportIcs(start?: string, end?: string): Promise<void> {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const query = params.toString();
    const response = await api.get(
      `/planning-export/ics${query ? `?${query}` : ""}`,
      { responseType: "blob" },
    );
    const blob = new Blob([response.data], { type: "text/calendar" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "planning.ics";
    a.click();
    window.URL.revokeObjectURL(url);
  },

  async previewImport(icsContent: string): Promise<IcsPreviewEvent[]> {
    const response = await api.post<IcsPreviewEvent[]>(
      "/planning-export/ics/import/preview",
      { icsContent },
    );
    return response.data;
  },

  async importIcs(
    icsContent: string,
  ): Promise<{ imported: number; skipped: number }> {
    const response = await api.post<{ imported: number; skipped: number }>(
      "/planning-export/ics/import",
      { icsContent },
    );
    return response.data;
  },
};
