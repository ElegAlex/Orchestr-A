"use client";

import React, { useState, useMemo } from "react";
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  getISOWeek,
} from "date-fns";
import { fr } from "date-fns/locale";

interface Project {
  id: string;
  name: string;
  code?: string;
  status: string;
  progress: number;
  startDate: string;
  dueDate?: string | null;
}

interface PortfolioGanttProps {
  projects: Project[];
}

type TimeScale = "day" | "week" | "month";

export default function PortfolioGantt({ projects }: PortfolioGanttProps) {
  const [timeScale, setTimeScale] = useState<TimeScale>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Filtrer les projets actifs
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) =>
        ["active", "draft", "suspended"].includes(p.status.toLowerCase()),
      )
      .sort((a, b) => {
        const dateA = new Date(a.startDate);
        const dateB = new Date(b.startDate);
        return dateA.getTime() - dateB.getTime();
      });
  }, [projects]);

  // Calculer la période visible selon l'échelle
  const getVisibleRange = () => {
    switch (timeScale) {
      case "day":
        return {
          start: addDays(currentDate, -15),
          end: addDays(currentDate, 15),
        };
      case "week":
        return {
          start: startOfWeek(addWeeks(currentDate, -15), { locale: fr }),
          end: endOfWeek(addWeeks(currentDate, 15), { locale: fr }),
        };
      case "month":
        return {
          start: startOfMonth(addMonths(currentDate, -6)),
          end: endOfMonth(addMonths(currentDate, 5)),
        };
      default:
        return {
          start: addDays(currentDate, -15),
          end: addDays(currentDate, 15),
        };
    }
  };

  const visibleRange = getVisibleRange();

  // Calculer les colonnes de temps
  const getTimeData = (): {
    totalUnits: number;
    columns: Array<{
      date: Date;
      label: string;
      sublabel: string;
      width: number;
    }>;
  } => {
    switch (timeScale) {
      case "day": {
        const totalDays =
          differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentDay = visibleRange.start;

        while (currentDay <= visibleRange.end) {
          columns.push({
            date: currentDay,
            label: format(currentDay, "d", { locale: fr }),
            sublabel: format(currentDay, "EEE", { locale: fr }),
            width: 100 / totalDays,
          });
          currentDay = addDays(currentDay, 1);
        }
        return { totalUnits: totalDays, columns };
      }

      case "week": {
        const columns = [];
        let currentWeek = visibleRange.start;

        while (currentWeek <= visibleRange.end) {
          const weekEnd = endOfWeek(currentWeek, { locale: fr });
          const adjustedEnd =
            weekEnd > visibleRange.end ? visibleRange.end : weekEnd;
          const weekDays = differenceInDays(adjustedEnd, currentWeek) + 1;

          columns.push({
            date: currentWeek,
            label: `S${getISOWeek(currentWeek)}`,
            sublabel: "",
            width:
              (weekDays * 100) /
              (differenceInDays(visibleRange.end, visibleRange.start) + 1),
          });
          currentWeek = addWeeks(currentWeek, 1);
        }
        return {
          totalUnits:
            differenceInDays(visibleRange.end, visibleRange.start) + 1,
          columns,
        };
      }

      case "month": {
        const totalDays =
          differenceInDays(visibleRange.end, visibleRange.start) + 1;
        const columns = [];
        let currentMonth = visibleRange.start;

        while (currentMonth <= visibleRange.end) {
          const monthEnd = endOfMonth(currentMonth);
          const adjustedEnd =
            monthEnd > visibleRange.end ? visibleRange.end : monthEnd;
          const monthDays = differenceInDays(adjustedEnd, currentMonth) + 1;

          columns.push({
            date: currentMonth,
            label: format(currentMonth, "MMM", { locale: fr }),
            sublabel: format(currentMonth, "yyyy"),
            width: (monthDays * 100) / totalDays,
          });
          currentMonth = addMonths(currentMonth, 1);
        }
        return { totalUnits: totalDays, columns };
      }

      default:
        return { totalUnits: 0, columns: [] };
    }
  };

  const timeData = getTimeData();
  const timeColumns = timeData.columns;

  // Calculer la position et largeur d'un élément sur le Gantt
  const getBarPosition = (startDate: string, dueDate?: string | null) => {
    const start = new Date(startDate);
    const end = dueDate ? new Date(dueDate) : new Date();

    if (end < visibleRange.start || start > visibleRange.end) {
      return null;
    }

    const adjustedStart =
      start < visibleRange.start ? visibleRange.start : start;
    const adjustedEnd = end > visibleRange.end ? visibleRange.end : end;

    const startOffset = differenceInDays(adjustedStart, visibleRange.start);
    const duration = differenceInDays(adjustedEnd, adjustedStart) + 1;
    const totalUnits =
      differenceInDays(visibleRange.end, visibleRange.start) + 1;

    return {
      left: (startOffset / totalUnits) * 100,
      width: (duration / totalUnits) * 100,
    };
  };

  // Couleurs par statut de projet
  const getProjectColor = (status: string) => {
    const colors: { [key: string]: string } = {
      active: "#4caf50",
      draft: "#9e9e9e",
      suspended: "#ff9800",
      completed: "#667eea",
      cancelled: "#f44336",
    };
    return colors[status.toLowerCase()] || "#9e9e9e";
  };

  // Navigation temporelle
  const navigateTime = (direction: "prev" | "next") => {
    let amount = 1;
    switch (timeScale) {
      case "day":
        amount = 30;
        break;
      case "week":
        amount = 7;
        break;
      case "month":
        amount = 12;
        break;
    }

    if (timeScale === "day") {
      setCurrentDate(
        direction === "next"
          ? addDays(currentDate, amount)
          : addDays(currentDate, -amount),
      );
    } else if (timeScale === "week") {
      setCurrentDate(
        direction === "next"
          ? addWeeks(currentDate, amount)
          : addWeeks(currentDate, -amount),
      );
    } else {
      setCurrentDate(
        direction === "next"
          ? addMonths(currentDate, amount)
          : addMonths(currentDate, -amount),
      );
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Zoom
  const handleZoom = (direction: "in" | "out") => {
    const scales: TimeScale[] = ["day", "week", "month"];
    const currentIndex = scales.indexOf(timeScale);

    if (direction === "in" && currentIndex > 0) {
      setTimeScale(scales[currentIndex - 1]);
    } else if (direction === "out" && currentIndex < scales.length - 1) {
      setTimeScale(scales[currentIndex + 1]);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 h-full flex flex-col">
      {/* En-tête avec contrôles */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">
          Gantt Portfolio - Vue d&apos;ensemble des Projets
        </h3>

        <div className="flex items-center gap-4">
          {/* Sélecteur d'échelle */}
          <select
            value={timeScale}
            onChange={(e) => setTimeScale(e.target.value as TimeScale)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>

          {/* Navigation temporelle */}
          <div className="flex gap-2">
            <button
              onClick={() => navigateTime("prev")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Précédent"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
              title="Aujourd'hui"
            >
              Aujourd&apos;hui
            </button>
            <button
              onClick={() => navigateTime("next")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Suivant"
            >
              →
            </button>
          </div>

          {/* Zoom */}
          <div className="flex gap-2">
            <button
              onClick={() => handleZoom("in")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Zoom avant"
              disabled={timeScale === "day"}
            >
              🔍+
            </button>
            <button
              onClick={() => handleZoom("out")}
              className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Zoom arrière"
              disabled={timeScale === "month"}
            >
              🔍-
            </button>
          </div>
        </div>
      </div>

      {/* Corps du Gantt */}
      <div className="flex-1 overflow-auto border border-gray-300 rounded">
        {/* En-tête de l'échelle de temps */}
        <div className="flex border-b-2 border-gray-400 bg-gray-50 sticky top-0 z-10">
          <div className="w-64 p-2 border-r border-gray-300 font-semibold text-sm">
            Projets
          </div>
          <div className="flex-1 flex">
            {timeColumns.map((col, index) => (
              <div
                key={index}
                style={{ width: `${col.width}%` }}
                className="p-1 border-r border-gray-300 text-center min-w-[30px]"
              >
                <div className="text-xs font-semibold">{col.label}</div>
                {col.sublabel && (
                  <div className="text-xs text-gray-900">{col.sublabel}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Lignes des projets */}
        {filteredProjects.map((project) => {
          const projectBar = getBarPosition(project.startDate, project.dueDate);

          return (
            <div
              key={project.id}
              className="flex border-b border-gray-200 min-h-[50px]"
            >
              <div className="w-64 p-2 border-r border-gray-300 bg-white">
                <div className="font-semibold text-sm">{project.name}</div>
                <div className="flex gap-2 mt-1 items-center">
                  <span
                    className="text-xs px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: getProjectColor(project.status) }}
                  >
                    {project.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-gray-900">
                    {project.progress}%
                  </span>
                </div>
              </div>

              <div
                className="flex-1 relative"
                style={{
                  backgroundColor:
                    hoveredItem === project.id ? "#f3f4f6" : "transparent",
                }}
              >
                {projectBar && (
                  <div
                    onMouseEnter={() => setHoveredItem(project.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className="absolute top-1/2 -translate-y-1/2 h-8 rounded cursor-pointer border-2 overflow-hidden shadow-md hover:shadow-lg transition-all"
                    style={{
                      left: `${projectBar.left}%`,
                      width: `${projectBar.width}%`,
                      borderColor: getProjectColor(project.status),
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                    }}
                    title={`${project.name}\n${format(new Date(project.startDate), "dd/MM/yyyy")} - ${project.dueDate ? format(new Date(project.dueDate), "dd/MM/yyyy") : "En cours"}\nProgression: ${project.progress}%`}
                  >
                    {/* Barre de progression */}
                    <div
                      className="absolute top-0 left-0 h-full rounded transition-all"
                      style={{
                        width: `${project.progress}%`,
                        backgroundColor: getProjectColor(project.status),
                      }}
                    />
                    {/* Texte */}
                    <div className="relative z-10 flex items-center justify-between px-2 h-full">
                      <span className="text-xs font-semibold text-white truncate">
                        {project.name}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {project.progress}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="p-8 text-center text-gray-900">
            Aucun projet actif à afficher
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="flex gap-4 mt-4 justify-center">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-3 rounded"
            style={{ backgroundColor: "#4caf50" }}
          />
          <span className="text-xs">Actif</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-3 rounded"
            style={{ backgroundColor: "#9e9e9e" }}
          />
          <span className="text-xs">Brouillon</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-3 rounded"
            style={{ backgroundColor: "#ff9800" }}
          />
          <span className="text-xs">Suspendu</span>
        </div>
      </div>
    </div>
  );
}
