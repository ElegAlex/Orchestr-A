import type { GanttGrouping, GanttGroup, GanttTaskRow } from "./types";

/**
 * Sort tasks by startDate ascending.
 */
function sortByStartDate(tasks: GanttTaskRow[]): GanttTaskRow[] {
  return [...tasks].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );
}

/**
 * Get the earliest startDate from a list of tasks.
 * Returns Infinity if the list is empty.
 */
function earliestStart(tasks: GanttTaskRow[]): number {
  if (tasks.length === 0) return Infinity;
  return Math.min(...tasks.map((t) => t.startDate.getTime()));
}

/**
 * Groups tasks by milestone, epic, or not at all.
 *
 * - `'none'`: single group with all tasks sorted by startDate.
 * - `'milestone'`: group by milestoneId; ungrouped tasks go to "Sans jalon" last.
 * - `'epic'`: group by epicId; ungrouped tasks go to "Sans épopée" last.
 */
export function groupTasks(
  tasks: GanttTaskRow[],
  by: GanttGrouping,
): GanttGroup[] {
  if (by === "none") {
    return [
      {
        key: "all",
        label: "",
        rows: sortByStartDate(tasks),
        isExpanded: true,
      },
    ];
  }

  const idField = by === "milestone" ? "milestoneId" : "epicId";
  const nameField = by === "milestone" ? "milestoneName" : "epicName";
  const ungroupedLabel = by === "milestone" ? "Sans jalon" : "Sans épopée";

  const groupMap = new Map<string, GanttGroup>();
  const ungrouped: GanttTaskRow[] = [];

  for (const task of tasks) {
    // Skip milestone diamond rows that duplicate the group header
    if (by === "milestone" && task.isMilestone && task.milestoneId) continue;

    const groupId = task[idField];
    if (!groupId) {
      ungrouped.push(task);
      continue;
    }

    const existing = groupMap.get(groupId);
    if (existing) {
      existing.rows.push(task);
    } else {
      groupMap.set(groupId, {
        key: groupId,
        label: task[nameField] ?? groupId,
        rows: [task],
        isExpanded: true,
      });
    }
  }

  // Sort named groups by earliest startDate of their tasks
  const namedGroups = Array.from(groupMap.values()).sort(
    (a, b) => earliestStart(a.rows) - earliestStart(b.rows),
  );

  // Sort tasks within each named group
  for (const group of namedGroups) {
    group.rows = sortByStartDate(group.rows);
  }

  // Append ungrouped at the end if any
  if (ungrouped.length > 0) {
    namedGroups.push({
      key: "ungrouped",
      label: ungroupedLabel,
      rows: sortByStartDate(ungrouped),
      isExpanded: true,
    });
  }

  return namedGroups;
}
