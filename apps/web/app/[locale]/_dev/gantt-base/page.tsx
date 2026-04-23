"use client";

import { Gantt } from "@/components/gantt";
import type {
  GanttPortfolioRow,
  GanttTaskRow,
  GanttDependency,
} from "@/components/gantt";
import { TaskStatus } from "@/types";

const today = new Date();
const d = (offset: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + offset);
  return dt;
};

const portfolioRows: GanttPortfolioRow[] = [
  {
    id: "p1",
    name: "Refonte portail usager",
    startDate: d(-90),
    endDate: d(30),
    progress: 65,
    status: "active",
    health: "on-track",
    departmentName: "DSI",
    managerName: "M. Dupont",
    code: "PRJ-001",
  },
  {
    id: "p2",
    name: "Migration SI-RH",
    startDate: d(-60),
    endDate: d(60),
    progress: 30,
    status: "active",
    health: "at-risk",
    departmentName: "DRH",
    managerName: "Mme Martin",
    code: "PRJ-002",
  },
  {
    id: "p3",
    name: "Dématérialisation courrier",
    startDate: d(-120),
    endDate: d(-10),
    progress: 45,
    status: "active",
    health: "late",
    departmentName: "DGA",
    managerName: "M. Bernard",
    code: "PRJ-003",
  },
  {
    id: "p4",
    name: "Modernisation parc informatique",
    startDate: d(10),
    endDate: d(120),
    progress: 0,
    status: "active",
    health: "upcoming",
    departmentName: "DSI",
    managerName: "Mme Petit",
    code: "PRJ-004",
  },
  {
    id: "p5",
    name: "Audit accessibilité",
    startDate: d(-180),
    endDate: d(-30),
    progress: 100,
    status: "completed",
    health: "done",
    departmentName: "DSI",
    managerName: "M. Leroy",
    code: "PRJ-005",
  },
  {
    id: "p6",
    name: "Plateforme open data",
    startDate: d(-45),
    endDate: d(90),
    progress: 25,
    status: "active",
    health: "at-risk",
    departmentName: "DGA",
    managerName: "Mme Moreau",
    code: "PRJ-006",
  },
  {
    id: "p7",
    name: "Réseau fibre optique",
    startDate: d(-30),
    endDate: d(150),
    progress: 10,
    status: "active",
    health: "on-track",
    departmentName: "DSI",
    managerName: "M. Garcia",
    code: "PRJ-007",
  },
  {
    id: "p8",
    name: "Formation agents bureautique",
    startDate: d(-15),
    endDate: d(45),
    progress: 40,
    status: "active",
    health: "on-track",
    departmentName: "DRH",
    managerName: "Mme Thomas",
    code: "PRJ-008",
  },
];

const taskRows: GanttTaskRow[] = [
  // Jalon 1: Conception
  {
    id: "t1",
    name: "Cahier des charges",
    startDate: d(-30),
    endDate: d(-15),
    progress: 100,
    status: TaskStatus.DONE,
    milestoneId: "m1",
    milestoneName: "Conception",
    isMilestone: false,
  },
  {
    id: "t2",
    name: "Maquettes UI",
    startDate: d(-20),
    endDate: d(-5),
    progress: 80,
    status: TaskStatus.IN_REVIEW,
    milestoneId: "m1",
    milestoneName: "Conception",
    isMilestone: false,
  },
  {
    id: "t3",
    name: "Validation conception",
    startDate: d(-5),
    endDate: d(-5),
    progress: 0,
    status: TaskStatus.TODO,
    milestoneId: "m1",
    milestoneName: "Conception",
    isMilestone: true,
  },
  // Jalon 2: Développement
  {
    id: "t4",
    name: "Setup infrastructure",
    startDate: d(-10),
    endDate: d(5),
    progress: 60,
    status: TaskStatus.IN_PROGRESS,
    milestoneId: "m2",
    milestoneName: "Développement",
    isMilestone: false,
  },
  {
    id: "t5",
    name: "API backend",
    startDate: d(0),
    endDate: d(30),
    progress: 20,
    status: TaskStatus.IN_PROGRESS,
    milestoneId: "m2",
    milestoneName: "Développement",
    isMilestone: false,
  },
  {
    id: "t6",
    name: "Frontend React",
    startDate: d(5),
    endDate: d(40),
    progress: 0,
    status: TaskStatus.TODO,
    milestoneId: "m2",
    milestoneName: "Développement",
    isMilestone: false,
  },
  {
    id: "t7",
    name: "Intégration continue",
    startDate: d(10),
    endDate: d(20),
    progress: 0,
    status: TaskStatus.BLOCKED,
    milestoneId: "m2",
    milestoneName: "Développement",
    isMilestone: false,
  },
  // Jalon 3: Recette
  {
    id: "t8",
    name: "Tests fonctionnels",
    startDate: d(30),
    endDate: d(50),
    progress: 0,
    status: TaskStatus.TODO,
    milestoneId: "m3",
    milestoneName: "Recette",
    isMilestone: false,
  },
  {
    id: "t9",
    name: "Tests de performance",
    startDate: d(35),
    endDate: d(50),
    progress: 0,
    status: TaskStatus.TODO,
    milestoneId: "m3",
    milestoneName: "Recette",
    isMilestone: false,
  },
  {
    id: "t10",
    name: "Mise en production",
    startDate: d(50),
    endDate: d(50),
    progress: 0,
    status: TaskStatus.TODO,
    milestoneId: "m3",
    milestoneName: "Recette",
    isMilestone: true,
  },
  // Sans jalon
  {
    id: "t11",
    name: "Réunion de suivi hebdo",
    startDate: d(-30),
    endDate: d(50),
    progress: 50,
    status: TaskStatus.IN_PROGRESS,
    isMilestone: false,
  },
  {
    id: "t12",
    name: "Documentation utilisateur",
    startDate: d(20),
    endDate: d(45),
    progress: 0,
    status: TaskStatus.TODO,
    isMilestone: false,
  },
];

const dependencies: GanttDependency[] = [
  { fromId: "t1", toId: "t2" },
  { fromId: "t2", toId: "t3" },
  { fromId: "t4", toId: "t5" },
  { fromId: "t5", toId: "t6" },
];

export default function GanttDevPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Gantt — Dev Preview</h1>

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Portfolio (scope: portfolio)
        </h2>
        <Gantt scope="portfolio" rows={portfolioRows} view="month" />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          Projet (scope: project)
        </h2>
        <Gantt
          scope="project"
          rows={taskRows}
          view="week"
          dependencies={dependencies}
          groupBy="milestone"
          onRowClick={(row) => console.log("click", row.id)}
          onRowDoubleClick={(row) => console.log("dblclick", row.id)}
        />
      </section>
    </div>
  );
}
