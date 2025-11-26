'use client';

import { MainLayout } from '@/components/MainLayout';
import { PlanningView } from '@/components/planning/PlanningView';

export default function PlanningPage() {
  return (
    <MainLayout>
      <PlanningView
        showFilters={true}
        showControls={true}
        showGroupHeaders={true}
        showLegend={true}
      />
    </MainLayout>
  );
}
