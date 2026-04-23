"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { WorkloadChart } from "./WorkloadChart";
import MilestonesCompletion from "./MilestonesCompletion";
import { RecentActivity } from "./RecentActivity";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function TabContent() {
  const tFilters = useTranslations("admin.reports");
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics", "advanced"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          data-testid="advanced-refresh-btn"
        >
          <RefreshCw className="h-4 w-4" />
          {tFilters("filters.refresh")}
        </button>
      </div>

      <RecentActivity />
      <WorkloadChart />
      <MilestonesCompletion />
    </div>
  );
}

export default function AdvancedAnalyticsTab() {
  return (
    <QueryClientProvider client={queryClient}>
      <TabContent />
    </QueryClientProvider>
  );
}
