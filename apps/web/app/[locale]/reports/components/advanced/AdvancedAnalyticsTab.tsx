"use client";

import { WorkloadChart } from "./WorkloadChart";
import MilestonesCompletion from "./MilestonesCompletion";
import { RecentActivity } from "./RecentActivity";

export default function AdvancedAnalyticsTab() {
  return (
    <div className="space-y-6">
      <RecentActivity />
      <WorkloadChart />
      <MilestonesCompletion />
    </div>
  );
}
