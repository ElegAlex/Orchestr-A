"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkloadChart } from "./WorkloadChart";
import MilestonesCompletion from "./MilestonesCompletion";
import { RecentActivity } from "./RecentActivity";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function TabContent() {
  return (
    <div className="space-y-6">
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
