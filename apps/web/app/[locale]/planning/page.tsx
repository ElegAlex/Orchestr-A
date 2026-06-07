"use client";

import dynamic from "next/dynamic";
import { MainLayout } from "@/components/MainLayout";

const PlanningView = dynamic(
  () =>
    import("@/components/planning/PlanningView").then((m) => m.PlanningView),
  { ssr: false },
);

export default function PlanningPage() {
  return (
    <MainLayout>
      <PlanningView
        showFilters={true}
        showControls={true}
        showGroupHeaders={true}
      />
    </MainLayout>
  );
}
