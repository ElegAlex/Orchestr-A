import { groupTasks } from "../grouping";
import type { GanttTaskRow } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(
  overrides: Partial<GanttTaskRow> & { id: string },
): GanttTaskRow {
  return {
    name: `Task ${overrides.id}`,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-15"),
    progress: 0,
    status: "TODO" as GanttTaskRow["status"],
    isMilestone: false,
    ...overrides,
  };
}

const d = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------
// by = 'none'
// ---------------------------------------------------------------------------

describe("groupTasks — none", () => {
  it('returns a single group with key "all" and empty label', () => {
    const tasks = [makeTask({ id: "1" }), makeTask({ id: "2" })];
    const groups = groupTasks(tasks, "none");

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("all");
    expect(groups[0].label).toBe("");
    expect(groups[0].isExpanded).toBe(true);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("sorts tasks by startDate ascending", () => {
    const tasks = [
      makeTask({ id: "late", startDate: d("2026-03-01") }),
      makeTask({ id: "early", startDate: d("2026-01-01") }),
      makeTask({ id: "mid", startDate: d("2026-02-01") }),
    ];
    const [group] = groupTasks(tasks, "none");

    expect(group.rows.map((r) => r.id)).toEqual(["early", "mid", "late"]);
  });

  it("returns a single empty group for empty tasks array", () => {
    const groups = groupTasks([], "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("all");
    expect(groups[0].rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// by = 'milestone'
// ---------------------------------------------------------------------------

describe("groupTasks — milestone", () => {
  it("groups tasks by milestoneId", () => {
    const tasks = [
      makeTask({ id: "1", milestoneId: "m1", milestoneName: "Alpha" }),
      makeTask({ id: "2", milestoneId: "m2", milestoneName: "Beta" }),
      makeTask({ id: "3", milestoneId: "m1", milestoneName: "Alpha" }),
    ];
    const groups = groupTasks(tasks, "milestone");

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key === "m1")!.rows).toHaveLength(2);
    expect(groups.find((g) => g.key === "m2")!.rows).toHaveLength(1);
  });

  it("uses milestoneName as label from first task in group", () => {
    const tasks = [
      makeTask({ id: "1", milestoneId: "m1", milestoneName: "Alpha" }),
      makeTask({ id: "2", milestoneId: "m1", milestoneName: "Alpha renamed" }),
    ];
    const groups = groupTasks(tasks, "milestone");

    expect(groups[0].label).toBe("Alpha");
  });

  it('puts tasks without milestoneId in "Sans jalon" group at the end', () => {
    const tasks = [
      makeTask({ id: "1" }),
      makeTask({
        id: "2",
        milestoneId: "m1",
        milestoneName: "Alpha",
        startDate: d("2026-06-01"),
      }),
    ];
    const groups = groupTasks(tasks, "milestone");

    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].key).toBe("ungrouped");
    expect(groups[groups.length - 1].label).toBe("Sans jalon");
  });

  it("sorts named groups by earliest task startDate", () => {
    const tasks = [
      makeTask({
        id: "1",
        milestoneId: "m-late",
        milestoneName: "Late",
        startDate: d("2026-06-01"),
      }),
      makeTask({
        id: "2",
        milestoneId: "m-early",
        milestoneName: "Early",
        startDate: d("2026-01-01"),
      }),
      makeTask({
        id: "3",
        milestoneId: "m-mid",
        milestoneName: "Mid",
        startDate: d("2026-03-01"),
      }),
    ];
    const groups = groupTasks(tasks, "milestone");

    expect(groups.map((g) => g.key)).toEqual(["m-early", "m-mid", "m-late"]);
  });

  it("sorts tasks within each group by startDate ascending", () => {
    const tasks = [
      makeTask({
        id: "b",
        milestoneId: "m1",
        milestoneName: "M1",
        startDate: d("2026-03-01"),
      }),
      makeTask({
        id: "a",
        milestoneId: "m1",
        milestoneName: "M1",
        startDate: d("2026-01-01"),
      }),
      makeTask({
        id: "c",
        milestoneId: "m1",
        milestoneName: "M1",
        startDate: d("2026-02-01"),
      }),
    ];
    const [group] = groupTasks(tasks, "milestone");

    expect(group.rows.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("returns empty array for empty tasks", () => {
    const groups = groupTasks([], "milestone");
    expect(groups).toHaveLength(0);
  });

  it('returns single "Sans jalon" group when all tasks are ungrouped', () => {
    const tasks = [makeTask({ id: "1" }), makeTask({ id: "2" })];
    const groups = groupTasks(tasks, "milestone");

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("ungrouped");
    expect(groups[0].label).toBe("Sans jalon");
    expect(groups[0].rows).toHaveLength(2);
  });

  it("returns single named group when all tasks share the same milestone", () => {
    const tasks = [
      makeTask({ id: "1", milestoneId: "m1", milestoneName: "Only" }),
      makeTask({ id: "2", milestoneId: "m1", milestoneName: "Only" }),
    ];
    const groups = groupTasks(tasks, "milestone");

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("m1");
    expect(groups[0].label).toBe("Only");
  });

  it("handles mixed grouped and ungrouped tasks", () => {
    const tasks = [
      makeTask({
        id: "1",
        milestoneId: "m1",
        milestoneName: "Alpha",
        startDate: d("2026-02-01"),
      }),
      makeTask({ id: "2", startDate: d("2026-01-01") }),
      makeTask({
        id: "3",
        milestoneId: "m2",
        milestoneName: "Beta",
        startDate: d("2026-03-01"),
      }),
      makeTask({ id: "4", startDate: d("2026-04-01") }),
    ];
    const groups = groupTasks(tasks, "milestone");

    expect(groups).toHaveLength(3);
    // Named groups sorted by earliest start
    expect(groups[0].key).toBe("m1");
    expect(groups[1].key).toBe("m2");
    // Ungrouped always last
    expect(groups[2].key).toBe("ungrouped");
    expect(groups[2].rows).toHaveLength(2);
  });

  it("sets isExpanded to true for all groups", () => {
    const tasks = [
      makeTask({ id: "1", milestoneId: "m1", milestoneName: "A" }),
      makeTask({ id: "2" }),
    ];
    const groups = groupTasks(tasks, "milestone");
    groups.forEach((g) => expect(g.isExpanded).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// by = 'epic'
// ---------------------------------------------------------------------------

describe("groupTasks — epic", () => {
  it("groups tasks by epicId", () => {
    const tasks = [
      makeTask({ id: "1", epicId: "e1", epicName: "Epic One" }),
      makeTask({ id: "2", epicId: "e2", epicName: "Epic Two" }),
      makeTask({ id: "3", epicId: "e1", epicName: "Epic One" }),
    ];
    const groups = groupTasks(tasks, "epic");

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key === "e1")!.rows).toHaveLength(2);
    expect(groups.find((g) => g.key === "e2")!.rows).toHaveLength(1);
  });

  it("uses epicName as label", () => {
    const tasks = [makeTask({ id: "1", epicId: "e1", epicName: "Epic One" })];
    const groups = groupTasks(tasks, "epic");
    expect(groups[0].label).toBe("Epic One");
  });

  it('puts tasks without epicId in "Sans épopée" group at the end', () => {
    const tasks = [
      makeTask({ id: "1" }),
      makeTask({
        id: "2",
        epicId: "e1",
        epicName: "Epic",
        startDate: d("2026-06-01"),
      }),
    ];
    const groups = groupTasks(tasks, "epic");

    expect(groups[groups.length - 1].key).toBe("ungrouped");
    expect(groups[groups.length - 1].label).toBe("Sans épopée");
  });

  it("sorts named groups by earliest task startDate", () => {
    const tasks = [
      makeTask({
        id: "1",
        epicId: "e-late",
        epicName: "Late",
        startDate: d("2026-06-01"),
      }),
      makeTask({
        id: "2",
        epicId: "e-early",
        epicName: "Early",
        startDate: d("2026-01-01"),
      }),
    ];
    const groups = groupTasks(tasks, "epic");

    expect(groups.map((g) => g.key)).toEqual(["e-early", "e-late"]);
  });

  it("sorts tasks within each group by startDate ascending", () => {
    const tasks = [
      makeTask({
        id: "z",
        epicId: "e1",
        epicName: "E",
        startDate: d("2026-05-01"),
      }),
      makeTask({
        id: "a",
        epicId: "e1",
        epicName: "E",
        startDate: d("2026-01-01"),
      }),
    ];
    const [group] = groupTasks(tasks, "epic");

    expect(group.rows.map((r) => r.id)).toEqual(["a", "z"]);
  });

  it("returns empty array for empty tasks", () => {
    expect(groupTasks([], "epic")).toHaveLength(0);
  });

  it('returns single "Sans épopée" group when all tasks are ungrouped', () => {
    const tasks = [makeTask({ id: "1" }), makeTask({ id: "2" })];
    const groups = groupTasks(tasks, "epic");

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("ungrouped");
    expect(groups[0].label).toBe("Sans épopée");
  });

  it("returns single named group when all tasks share the same epic", () => {
    const tasks = [
      makeTask({ id: "1", epicId: "e1", epicName: "Shared" }),
      makeTask({ id: "2", epicId: "e1", epicName: "Shared" }),
    ];
    const groups = groupTasks(tasks, "epic");

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("e1");
  });

  it("handles mixed grouped and ungrouped tasks", () => {
    const tasks = [
      makeTask({
        id: "1",
        epicId: "e1",
        epicName: "A",
        startDate: d("2026-02-01"),
      }),
      makeTask({ id: "2", startDate: d("2026-01-01") }),
    ];
    const groups = groupTasks(tasks, "epic");

    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("e1");
    expect(groups[1].key).toBe("ungrouped");
  });

  it("sets isExpanded to true for all groups", () => {
    const tasks = [
      makeTask({ id: "1", epicId: "e1", epicName: "E" }),
      makeTask({ id: "2" }),
    ];
    const groups = groupTasks(tasks, "epic");
    groups.forEach((g) => expect(g.isExpanded).toBe(true));
  });
});
