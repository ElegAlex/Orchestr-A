/**
 * Test multi-rôle : Déclaration de temps pour compte d'un tiers (Wave 3+4)
 *
 * Scénarios couverts (spec §7.2) :
 *   1. @smoke — MANAGER crée tiers, projet, tâche, rattache tiers au projet,
 *              déclare 4h pour le tiers → apparaît dans le rapport projet en
 *              série ségrégée (totals.userHours / totals.thirdPartyHours).
 *   2. MANAGER assigne tiers à une tâche orpheline (sans projet) et déclare 2h.
 *   3. CONTRIBUTEUR tente de déclarer pour un tiers → 403.
 *   4. Hard delete cascade : 1 tiers avec entries + assignations + rattachements,
 *      deletion-impact donne les bons compteurs, delete efface tout en cascade.
 *   5. Les entries tiers n'apparaissent pas dans les agrégats "user-only"
 *      (loggedHours du projet = 0 car toutes les heures sont tiers).
 */

import * as fs from "fs";
import { test, expect } from "../../fixtures/test-fixtures";
import { ROLE_STORAGE_PATHS, type Role } from "../../fixtures/roles";

function getToken(role: Role): string {
  const storagePath = ROLE_STORAGE_PATHS[role];
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === "access_token",
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  return tokenEntry.value;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function authHeadersNoContentType(token: string) {
  return { Authorization: `Bearer ${token}` };
}

type ApiRequest = import("@playwright/test").APIRequestContext;

async function createThirdParty(
  request: ApiRequest,
  baseURL: string,
  token: string,
  organizationName: string,
) {
  const res = await request.post(`${baseURL}/api/third-parties`, {
    headers: authHeaders(token),
    data: { type: "EXTERNAL_PROVIDER", organizationName },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; organizationName: string };
}

async function createProject(
  request: ApiRequest,
  baseURL: string,
  token: string,
  name: string,
) {
  const res = await request.post(`${baseURL}/api/projects`, {
    headers: authHeaders(token),
    data: {
      name,
      description: "E2E Wave 5 tiers",
      status: "ACTIVE",
      startDate: "2026-04-01T00:00:00Z",
      endDate: "2026-12-31T00:00:00Z",
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; name: string };
}

async function createTask(
  request: ApiRequest,
  baseURL: string,
  token: string,
  title: string,
  projectId?: string,
) {
  const res = await request.post(`${baseURL}/api/tasks`, {
    headers: authHeaders(token),
    data: {
      title,
      status: "TODO",
      priority: "NORMAL",
      ...(projectId ? { projectId } : {}),
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string; title: string };
}

async function deleteThirdParty(
  request: ApiRequest,
  baseURL: string,
  token: string,
  id: string,
) {
  await request.delete(`${baseURL}/api/third-parties/${id}`, {
    headers: authHeadersNoContentType(token),
  });
}

async function deleteProject(
  request: ApiRequest,
  baseURL: string,
  token: string,
  id: string,
) {
  // Soft delete → status CANCELLED
  await request.delete(`${baseURL}/api/projects/${id}`, {
    headers: authHeadersNoContentType(token),
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Time Tracking — declare for third party", () => {
  const baseURL = () =>
    test.info().project.use.baseURL ?? "http://localhost:4001";
  const stamp = Date.now();

  test("@smoke MANAGER déclare 4h pour un tiers sur projet, report ségrégé", async ({
    request,
  }) => {
    const mgr = getToken("manager");
    const url = baseURL();

    // Setup : projet + tiers + rattachement projet + tâche
    const tp = await createThirdParty(request, url, mgr, `Acme ${stamp}-A`);
    const project = await createProject(
      request,
      url,
      mgr,
      `ProjetTiers ${stamp}-A`,
    );
    const task = await createTask(
      request,
      url,
      mgr,
      `Tâche tiers ${stamp}-A`,
      project.id,
    );

    // Rattacher le tiers au projet
    const attachRes = await request.post(
      `${url}/api/projects/${project.id}/third-party-members`,
      {
        headers: authHeaders(mgr),
        data: { thirdPartyId: tp.id, allocation: 50 },
      },
    );
    expect(attachRes.status()).toBe(201);

    // Déclarer 4h pour le tiers
    const timeRes = await request.post(`${url}/api/time-tracking`, {
      headers: authHeaders(mgr),
      data: {
        date: "2026-04-11T00:00:00Z",
        hours: 4,
        activityType: "DEVELOPMENT",
        taskId: task.id,
        projectId: project.id,
        thirdPartyId: tp.id,
      },
    });
    expect(timeRes.status()).toBe(201);
    const entry = await timeRes.json();
    expect(entry.userId).toBeNull();
    expect(entry.thirdPartyId).toBe(tp.id);
    expect(entry.declaredById).toBeDefined();

    // Rapport projet ségrégé
    const reportRes = await request.get(
      `${url}/api/time-tracking/project/${project.id}/report`,
      { headers: authHeadersNoContentType(mgr) },
    );
    expect(reportRes.status()).toBe(200);
    const report = await reportRes.json();
    expect(report.totals).toBeDefined();
    expect(report.totals.userHours).toBe(0);
    expect(report.totals.thirdPartyHours).toBe(4);
    expect(report.userEntries).toHaveLength(0);
    expect(report.thirdPartyEntries).toHaveLength(1);
    expect(report.byThirdParty).toHaveLength(1);
    expect(report.byThirdParty[0].thirdPartyId).toBe(tp.id);

    // Stats projet : loggedHours (user-only) = 0, thirdPartyActual = 4
    const statsRes = await request.get(
      `${url}/api/projects/${project.id}/stats`,
      { headers: authHeadersNoContentType(mgr) },
    );
    expect(statsRes.status()).toBe(200);
    const stats = await statsRes.json();
    expect(stats.hours.actual).toBe(0);
    expect(stats.hours.thirdPartyActual).toBe(4);

    // Cleanup
    await deleteThirdParty(request, url, mgr, tp.id);
    await deleteProject(request, url, mgr, project.id);
  });

  test("MANAGER assigne tiers à tâche orpheline et déclare 2h", async ({
    request,
  }) => {
    const mgr = getToken("manager");
    const url = baseURL();

    const tp = await createThirdParty(request, url, mgr, `Acme ${stamp}-B`);
    // Tâche orpheline (sans projectId)
    const task = await createTask(request, url, mgr, `Orphan ${stamp}-B`);

    // Assigner le tiers directement à la tâche orpheline
    const assignRes = await request.post(
      `${url}/api/tasks/${task.id}/third-party-assignees`,
      {
        headers: authHeaders(mgr),
        data: { thirdPartyId: tp.id },
      },
    );
    expect(assignRes.status()).toBe(201);

    // Déclarer 2h sur la tâche orpheline
    const timeRes = await request.post(`${url}/api/time-tracking`, {
      headers: authHeaders(mgr),
      data: {
        date: "2026-04-11T00:00:00Z",
        hours: 2,
        activityType: "MEETING",
        taskId: task.id,
        thirdPartyId: tp.id,
      },
    });
    expect(timeRes.status()).toBe(201);
    const entry = await timeRes.json();
    expect(entry.thirdPartyId).toBe(tp.id);
    expect(entry.userId).toBeNull();
    expect(entry.hours).toBe(2);

    // Cleanup
    await deleteThirdParty(request, url, mgr, tp.id);
  });

  test("CONTRIBUTEUR ne peut pas déclarer pour un tiers (403)", async ({
    request,
  }) => {
    const mgr = getToken("manager");
    const contrib = getToken("contributeur");
    const url = baseURL();

    // Setup minimal via MANAGER
    const tp = await createThirdParty(request, url, mgr, `Acme ${stamp}-C`);
    const project = await createProject(
      request,
      url,
      mgr,
      `ProjetTiers ${stamp}-C`,
    );
    await request.post(
      `${url}/api/projects/${project.id}/third-party-members`,
      {
        headers: authHeaders(mgr),
        data: { thirdPartyId: tp.id },
      },
    );

    // CONTRIBUTEUR tente de déclarer → 403
    const res = await request.post(`${url}/api/time-tracking`, {
      headers: authHeaders(contrib),
      data: {
        date: "2026-04-11T00:00:00Z",
        hours: 1,
        activityType: "OTHER",
        projectId: project.id,
        thirdPartyId: tp.id,
      },
    });
    expect(res.status()).toBe(403);

    // Cleanup
    await deleteThirdParty(request, url, mgr, tp.id);
    await deleteProject(request, url, mgr, project.id);
  });

  test("Hard delete cascade : time entries + assignments + memberships supprimés", async ({
    request,
  }) => {
    const mgr = getToken("manager");
    const url = baseURL();

    const tp = await createThirdParty(request, url, mgr, `Acme ${stamp}-D`);
    const project = await createProject(
      request,
      url,
      mgr,
      `ProjetTiers ${stamp}-D`,
    );
    const task1 = await createTask(
      request,
      url,
      mgr,
      `Task1 ${stamp}-D`,
      project.id,
    );
    const task2 = await createTask(
      request,
      url,
      mgr,
      `Task2 ${stamp}-D`,
      project.id,
    );

    // 1 rattachement projet + 2 assignations task + 3 time entries
    await request.post(
      `${url}/api/projects/${project.id}/third-party-members`,
      {
        headers: authHeaders(mgr),
        data: { thirdPartyId: tp.id },
      },
    );
    await request.post(`${url}/api/tasks/${task1.id}/third-party-assignees`, {
      headers: authHeaders(mgr),
      data: { thirdPartyId: tp.id },
    });
    await request.post(`${url}/api/tasks/${task2.id}/third-party-assignees`, {
      headers: authHeaders(mgr),
      data: { thirdPartyId: tp.id },
    });

    for (let i = 0; i < 3; i++) {
      const timeRes = await request.post(`${url}/api/time-tracking`, {
        headers: authHeaders(mgr),
        data: {
          date: "2026-04-11T00:00:00Z",
          hours: 1 + i,
          activityType: "DEVELOPMENT",
          taskId: task1.id,
          projectId: project.id,
          thirdPartyId: tp.id,
        },
      });
      expect(timeRes.status()).toBe(201);
    }

    // Vérifier deletion impact
    const impactRes = await request.get(
      `${url}/api/third-parties/${tp.id}/deletion-impact`,
      { headers: authHeadersNoContentType(mgr) },
    );
    expect(impactRes.status()).toBe(200);
    const impact = await impactRes.json();
    expect(impact.timeEntriesCount).toBe(3);
    expect(impact.taskAssignmentsCount).toBe(2);
    expect(impact.projectMembershipsCount).toBe(1);

    // Hard delete
    const delRes = await request.delete(`${url}/api/third-parties/${tp.id}`, {
      headers: authHeadersNoContentType(mgr),
    });
    expect(delRes.status()).toBe(204);

    // Tout a disparu
    const getTp = await request.get(`${url}/api/third-parties/${tp.id}`, {
      headers: authHeadersNoContentType(mgr),
    });
    expect(getTp.status()).toBe(404);

    // Rapport projet recalcule sans erreur (plus de thirdPartyEntries)
    const reportRes = await request.get(
      `${url}/api/time-tracking/project/${project.id}/report`,
      { headers: authHeadersNoContentType(mgr) },
    );
    expect(reportRes.status()).toBe(200);
    const report = await reportRes.json();
    expect(report.totals.thirdPartyHours).toBe(0);
    expect(report.thirdPartyEntries).toHaveLength(0);

    // Cleanup projet
    await deleteProject(request, url, mgr, project.id);
  });

  test("Entries tiers n'apparaissent pas dans les agrégats user-only (ségrégation stricte)", async ({
    request,
  }) => {
    const mgr = getToken("manager");
    const url = baseURL();

    const tp = await createThirdParty(request, url, mgr, `Acme ${stamp}-E`);
    const project = await createProject(
      request,
      url,
      mgr,
      `ProjetTiers ${stamp}-E`,
    );
    const task = await createTask(
      request,
      url,
      mgr,
      `Task ${stamp}-E`,
      project.id,
    );

    await request.post(
      `${url}/api/projects/${project.id}/third-party-members`,
      {
        headers: authHeaders(mgr),
        data: { thirdPartyId: tp.id },
      },
    );

    // MANAGER déclare 3h pour lui-même (user)
    const userRes = await request.post(`${url}/api/time-tracking`, {
      headers: authHeaders(mgr),
      data: {
        date: "2026-04-11T00:00:00Z",
        hours: 3,
        activityType: "DEVELOPMENT",
        taskId: task.id,
        projectId: project.id,
      },
    });
    expect(userRes.status()).toBe(201);
    const userEntry = await userRes.json();
    expect(userEntry.userId).toBeDefined();
    expect(userEntry.thirdPartyId).toBeNull();

    // MANAGER déclare 7h pour le tiers
    const tpRes = await request.post(`${url}/api/time-tracking`, {
      headers: authHeaders(mgr),
      data: {
        date: "2026-04-11T00:00:00Z",
        hours: 7,
        activityType: "DEVELOPMENT",
        taskId: task.id,
        projectId: project.id,
        thirdPartyId: tp.id,
      },
    });
    expect(tpRes.status()).toBe(201);

    // Report projet : 3h user + 7h tiers, strictement séparés
    const reportRes = await request.get(
      `${url}/api/time-tracking/project/${project.id}/report`,
      { headers: authHeadersNoContentType(mgr) },
    );
    const report = await reportRes.json();
    expect(report.totals.userHours).toBe(3);
    expect(report.totals.thirdPartyHours).toBe(7);
    expect(report.userEntries).toHaveLength(1);
    expect(report.thirdPartyEntries).toHaveLength(1);
    expect(report.byUser).toHaveLength(1);
    expect(report.byThirdParty).toHaveLength(1);

    // Stats projet : hours.actual = 3 (user only), hours.thirdPartyActual = 7
    const statsRes = await request.get(
      `${url}/api/projects/${project.id}/stats`,
      { headers: authHeadersNoContentType(mgr) },
    );
    const stats = await statsRes.json();
    expect(stats.hours.actual).toBe(3);
    expect(stats.hours.thirdPartyActual).toBe(7);

    // Cleanup
    await deleteThirdParty(request, url, mgr, tp.id);
    await deleteProject(request, url, mgr, project.id);
  });
});
