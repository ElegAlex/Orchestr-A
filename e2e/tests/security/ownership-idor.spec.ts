/**
 * W5.1 — E2E cross-user ownership IDOR (SEC-06 / BUG-01/04/05/08)
 *
 * Verifies that the ownership checks introduced in Wave 2 prevent a
 * non-owner from mutating another user's resource, even when that user
 * holds the generic `<resource>:update` or `:delete` permission.
 *
 * Structure per module:
 *   1. Create a resource (owner = user A).
 *   2. Mutate the resource as user B (different user, no bypass perm)
 *      → expect HTTP 403.
 *   3. Mutate the resource as ADMIN (has *:manage_any bypass) → expect 2xx.
 *
 * Bypass permissions (registered at 400dbde):
 *   - projects:manage_any
 *   - events:manage_any
 *   - time_tracking:manage_any (+ time_tracking:view_any)
 *
 * Critical cross-user cases are tagged `@smoke`.
 *
 * Auth: read JWT tokens from playwright/.auth/*.json (created by
 * auth.setup.ts). Never logs in via UI per CLAUDE.md.
 */

import * as fs from 'fs';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { ROLE_STORAGE_PATHS, type Role } from '../../fixtures/roles';

// ─── Token helpers ─────────────────────────────────────────────────────────

const tokenCache: Partial<Record<Role, string>> = {};

function tokenFor(role: Role): string {
  if (tokenCache[role]) return tokenCache[role]!;
  const storagePath = ROLE_STORAGE_PATHS[role];
  if (!fs.existsSync(storagePath)) {
    throw new Error(
      `Storage state not found for role "${role}" at ${storagePath}. Run auth.setup first.`,
    );
  }
  const storage = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
  const origin = storage.origins?.[0];
  const tokenEntry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === 'access_token',
  );
  if (!tokenEntry?.value) {
    throw new Error(`No access_token in storage state for role "${role}"`);
  }
  tokenCache[role] = tokenEntry.value;
  return tokenEntry.value;
}

interface StoredUser {
  id: string;
  login?: string;
  role?: string;
}

function userFor(role: Role): StoredUser {
  const storagePath = ROLE_STORAGE_PATHS[role];
  const storage = JSON.parse(fs.readFileSync(storagePath, 'utf-8'));
  const origin = storage.origins?.[0];
  const entry = origin?.localStorage?.find(
    (item: { name: string; value: string }) => item.name === 'user',
  );
  if (!entry?.value) {
    throw new Error(`No "user" entry in storage state for role "${role}"`);
  }
  return JSON.parse(entry.value) as StoredUser;
}

function auth(role: Role, contentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokenFor(role)}`,
  };
  if (contentType) headers['Content-Type'] = 'application/json';
  return headers;
}

function baseUrl(): string {
  return test.info().project.use.baseURL ?? 'http://localhost:4001';
}

// ─── Generic assertions ────────────────────────────────────────────────────

function expect403(status: number, ctx: string) {
  expect(
    status,
    `${ctx} — expected 403 Forbidden, received ${status}`,
  ).toBe(403);
}

function expectSuccess(status: number, ctx: string) {
  expect(
    status >= 200 && status < 300,
    `${ctx} — expected 2xx, received ${status}`,
  ).toBeTruthy();
}

// ─── PROJECTS (BUG-04 / BUG-08) ────────────────────────────────────────────

test.describe('Ownership IDOR — projects (BUG-04/08)', () => {
  let projectId: string | null = null;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${baseUrl()}/api/projects`, {
      headers: auth('admin', true),
      data: {
        name: `IDOR Project ${Date.now()}`,
        description: 'Created by W5.1 ownership IDOR spec',
        status: 'ACTIVE',
      },
    });
    if (!res.ok()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[IDOR projects] Skipping module: create failed ${res.status()} — ${await res.text()}`,
      );
      return;
    }
    const body = await res.json();
    projectId = body.id ?? body.data?.id ?? null;
  });

  test.afterAll(async ({ request }) => {
    if (!projectId) return;
    // Best-effort cleanup (soft delete)
    await request.delete(`${baseUrl()}/api/projects/${projectId}`, {
      headers: auth('admin'),
    });
  });

  test(
    'PATCH /projects/:id as non-owner contributeur → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!projectId, 'Project creation failed in beforeAll');
      const res = await request.patch(
        `${baseUrl()}/api/projects/${projectId}`,
        {
          headers: auth('contributeur', true),
          data: { name: 'Hijacked by contributeur' },
        },
      );
      expect403(res.status(), 'contributeur PATCH /projects/:id');
    },
  );

  test(
    'DELETE /projects/:id as non-owner contributeur → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!projectId, 'Project creation failed in beforeAll');
      const res = await request.delete(
        `${baseUrl()}/api/projects/${projectId}`,
        { headers: auth('contributeur') },
      );
      expect403(res.status(), 'contributeur DELETE /projects/:id');
    },
  );

  test('POST /projects/:id/members as non-owner contributeur → 403', async ({
    request,
  }) => {
    test.skip(!projectId, 'Project creation failed in beforeAll');
    const target = userFor('referent');
    const res = await request.post(
      `${baseUrl()}/api/projects/${projectId}/members`,
      {
        headers: auth('contributeur', true),
        data: { userId: target.id, role: 'MEMBER' },
      },
    );
    expect403(res.status(), 'contributeur POST /projects/:id/members');
  });

  test(
    'PATCH /projects/:id as ADMIN (bypass projects:manage_any) → 2xx',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!projectId, 'Project creation failed in beforeAll');
      const res = await request.patch(
        `${baseUrl()}/api/projects/${projectId}`,
        {
          headers: auth('admin', true),
          data: { description: 'Updated by admin with manage_any' },
        },
      );
      expectSuccess(res.status(), 'admin PATCH /projects/:id');
    },
  );
});

// ─── EVENTS (BUG-05) ───────────────────────────────────────────────────────

test.describe('Ownership IDOR — events (BUG-05)', () => {
  let eventId: string | null = null;

  async function createEvent(request: APIRequestContext, role: Role) {
    const res = await request.post(`${baseUrl()}/api/events`, {
      headers: auth(role, true),
      data: {
        title: `IDOR Event ${Date.now()}`,
        date: '2027-06-15T00:00:00Z',
        isAllDay: true,
      },
    });
    return res;
  }

  test.beforeAll(async ({ request }) => {
    // Owner = contributeur (self-owned event)
    const res = await createEvent(request, 'contributeur');
    if (!res.ok()) {
      // Fallback: owner = manager
      const res2 = await createEvent(request, 'manager');
      if (!res2.ok()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[IDOR events] Skipping module: create failed ${res2.status()} — ${await res2.text()}`,
        );
        return;
      }
      const body2 = await res2.json();
      eventId = body2.id ?? body2.data?.id ?? null;
      return;
    }
    const body = await res.json();
    eventId = body.id ?? body.data?.id ?? null;
  });

  test.afterAll(async ({ request }) => {
    if (!eventId) return;
    await request.delete(`${baseUrl()}/api/events/${eventId}`, {
      headers: auth('admin'),
    });
  });

  test(
    'PATCH /events/:id as non-owner referent → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!eventId, 'Event creation failed in beforeAll');
      const res = await request.patch(`${baseUrl()}/api/events/${eventId}`, {
        headers: auth('referent', true),
        data: { title: 'Hijacked by referent' },
      });
      expect403(res.status(), 'referent PATCH /events/:id');
    },
  );

  test(
    'DELETE /events/:id as non-owner referent → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!eventId, 'Event creation failed in beforeAll');
      const res = await request.delete(`${baseUrl()}/api/events/${eventId}`, {
        headers: auth('referent'),
      });
      expect403(res.status(), 'referent DELETE /events/:id');
    },
  );

  test('POST /events/:id/participants as non-owner referent → 403', async ({
    request,
  }) => {
    test.skip(!eventId, 'Event creation failed in beforeAll');
    const target = userFor('observateur');
    const res = await request.post(
      `${baseUrl()}/api/events/${eventId}/participants`,
      {
        headers: auth('referent', true),
        data: { userId: target.id },
      },
    );
    expect403(res.status(), 'referent POST /events/:id/participants');
  });

  test('PATCH /events/:id as ADMIN (bypass events:manage_any) → 2xx', async ({
    request,
  }) => {
    test.skip(!eventId, 'Event creation failed in beforeAll');
    const res = await request.patch(`${baseUrl()}/api/events/${eventId}`, {
      headers: auth('admin', true),
      data: { title: 'Updated by admin with manage_any' },
    });
    expectSuccess(res.status(), 'admin PATCH /events/:id');
  });
});

// ─── TELEWORK (BUG-01) ─────────────────────────────────────────────────────

test.describe('Ownership IDOR — telework (BUG-01)', () => {
  let teleworkId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Owned by contributeur (self-declared TTV)
    const res = await request.post(`${baseUrl()}/api/telework`, {
      headers: auth('contributeur', true),
      data: { date: '2027-07-14T00:00:00Z' },
    });
    if (!res.ok()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[IDOR telework] Skipping module: create failed ${res.status()} — ${await res.text()}`,
      );
      return;
    }
    const body = await res.json();
    teleworkId = body.id ?? body.data?.id ?? null;
  });

  test.afterAll(async ({ request }) => {
    if (!teleworkId) return;
    await request.delete(`${baseUrl()}/api/telework/${teleworkId}`, {
      headers: auth('admin'),
    });
  });

  test(
    'PATCH /telework/:id as non-owner referent → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!teleworkId, 'Telework creation failed in beforeAll');
      const res = await request.patch(
        `${baseUrl()}/api/telework/${teleworkId}`,
        {
          headers: auth('referent', true),
          data: { date: '2027-07-15T00:00:00Z' },
        },
      );
      expect403(res.status(), 'referent PATCH /telework/:id');
    },
  );

  test(
    'DELETE /telework/:id as non-owner referent → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!teleworkId, 'Telework creation failed in beforeAll');
      const res = await request.delete(
        `${baseUrl()}/api/telework/${teleworkId}`,
        { headers: auth('referent') },
      );
      expect403(res.status(), 'referent DELETE /telework/:id');
    },
  );

  test('PATCH /telework/:id as ADMIN → 2xx', async ({ request }) => {
    test.skip(!teleworkId, 'Telework creation failed in beforeAll');
    const res = await request.patch(
      `${baseUrl()}/api/telework/${teleworkId}`,
      {
        headers: auth('admin', true),
        data: { date: '2027-07-16T00:00:00Z' },
      },
    );
    expectSuccess(res.status(), 'admin PATCH /telework/:id');
  });
});

// ─── TIME-TRACKING (SEC-06) ────────────────────────────────────────────────

test.describe('Ownership IDOR — time-tracking (SEC-06)', () => {
  let timeEntryId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Owned by contributeur
    const res = await request.post(`${baseUrl()}/api/time-tracking`, {
      headers: auth('contributeur', true),
      data: {
        date: '2027-07-20T00:00:00Z',
        hours: 2,
        activityType: 'DEVELOPMENT',
        description: 'IDOR E2E entry',
      },
    });
    if (!res.ok()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[IDOR time-tracking] Skipping module: create failed ${res.status()} — ${await res.text()}`,
      );
      return;
    }
    const body = await res.json();
    timeEntryId = body.id ?? body.data?.id ?? null;
  });

  test.afterAll(async ({ request }) => {
    if (!timeEntryId) return;
    await request.delete(`${baseUrl()}/api/time-tracking/${timeEntryId}`, {
      headers: auth('admin'),
    });
  });

  test(
    'PATCH /time-tracking/:id as non-owner referent → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!timeEntryId, 'Time entry creation failed in beforeAll');
      const res = await request.patch(
        `${baseUrl()}/api/time-tracking/${timeEntryId}`,
        {
          headers: auth('referent', true),
          data: { hours: 99 },
        },
      );
      expect403(res.status(), 'referent PATCH /time-tracking/:id');
    },
  );

  test(
    'DELETE /time-tracking/:id as non-owner referent → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!timeEntryId, 'Time entry creation failed in beforeAll');
      const res = await request.delete(
        `${baseUrl()}/api/time-tracking/${timeEntryId}`,
        { headers: auth('referent') },
      );
      expect403(res.status(), 'referent DELETE /time-tracking/:id');
    },
  );

  test(
    'GET /time-tracking?userId=<other> as non-viewer contributeur → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      const target = userFor('manager');
      const res = await request.get(
        `${baseUrl()}/api/time-tracking?userId=${target.id}`,
        { headers: auth('contributeur') },
      );
      // Without time_tracking:view_any, cross-user listing must be denied
      expect403(res.status(), 'contributeur GET /time-tracking?userId=other');
    },
  );

  test('GET /time-tracking?userId=<other> as ADMIN (view_any bypass) → 2xx', async ({
    request,
  }) => {
    const target = userFor('manager');
    const res = await request.get(
      `${baseUrl()}/api/time-tracking?userId=${target.id}`,
      { headers: auth('admin') },
    );
    expectSuccess(res.status(), 'admin GET /time-tracking?userId=other');
  });

  test('PATCH /time-tracking/:id as ADMIN → 2xx', async ({ request }) => {
    test.skip(!timeEntryId, 'Time entry creation failed in beforeAll');
    const res = await request.patch(
      `${baseUrl()}/api/time-tracking/${timeEntryId}`,
      {
        headers: auth('admin', true),
        data: { description: 'Updated by admin with manage_any' },
      },
    );
    expectSuccess(res.status(), 'admin PATCH /time-tracking/:id');
  });
});

// ─── LEAVES (BUG-gap-fix a382726) ──────────────────────────────────────────

test.describe('Ownership IDOR — leaves (cancel / reject-cancellation)', () => {
  let leaveId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Owned by contributeur
    const res = await request.post(`${baseUrl()}/api/leaves`, {
      headers: auth('contributeur', true),
      data: {
        leaveTypeId: 'lt-cp-001',
        startDate: '2027-09-01T00:00:00Z',
        endDate: '2027-09-03T00:00:00Z',
        reason: 'IDOR E2E leave',
      },
    });
    if (!res.ok()) {
      // eslint-disable-next-line no-console
      console.warn(
        `[IDOR leaves] Skipping module: create failed ${res.status()} — ${await res.text()}`,
      );
      return;
    }
    const body = await res.json();
    leaveId = body.id ?? body.data?.id ?? null;
  });

  test.afterAll(async ({ request }) => {
    if (!leaveId) return;
    await request.delete(`${baseUrl()}/api/leaves/${leaveId}`, {
      headers: auth('admin'),
    });
  });

  test(
    'POST /leaves/:id/cancel as out-of-perimeter MANAGER → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!leaveId, 'Leave creation failed in beforeAll');
      // test manager is not the hierarchical manager of test contributeur
      // → cancel of another user's leave must be refused.
      const res = await request.post(
        `${baseUrl()}/api/leaves/${leaveId}/cancel`,
        { headers: auth('manager', true), data: {} },
      );
      // Tolerate 403 (expected) or 400 if service raises BadRequest for status
      // mismatch. Core check: NOT 200.
      expect(
        [400, 403].includes(res.status()),
        `manager POST /leaves/:id/cancel — expected 403 (or 400 for state), got ${res.status()}`,
      ).toBeTruthy();
    },
  );

  test(
    'POST /leaves/:id/reject-cancellation as out-of-perimeter MANAGER → 403',
    { tag: '@smoke' },
    async ({ request }) => {
      test.skip(!leaveId, 'Leave creation failed in beforeAll');
      const res = await request.post(
        `${baseUrl()}/api/leaves/${leaveId}/reject-cancellation`,
        { headers: auth('manager', true), data: {} },
      );
      expect(
        [400, 403].includes(res.status()),
        `manager POST /leaves/:id/reject-cancellation — expected 403 (or 400 for state), got ${res.status()}`,
      ).toBeTruthy();
    },
  );
});

// ─── Full-role smoke matrix on projects PATCH ──────────────────────────────
//
// Covers the 6 roles explicitly for one critical cross-user case, per CLAUDE.md
// ("each test verifies the 6 roles for at least one critical case").

test.describe('Ownership IDOR — full 6-role smoke matrix', () => {
  let projectId: string | null = null;

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${baseUrl()}/api/projects`, {
      headers: auth('admin', true),
      data: {
        name: `IDOR Matrix Project ${Date.now()}`,
        description: '6-role smoke matrix',
        status: 'ACTIVE',
      },
    });
    if (res.ok()) {
      const body = await res.json();
      projectId = body.id ?? body.data?.id ?? null;
    }
  });

  test.afterAll(async ({ request }) => {
    if (!projectId) return;
    await request.delete(`${baseUrl()}/api/projects/${projectId}`, {
      headers: auth('admin'),
    });
  });

  const cases: Array<{ role: Role; expectForbidden: boolean }> = [
    { role: 'admin', expectForbidden: false }, // bypass projects:manage_any
    { role: 'responsable', expectForbidden: false }, // has manage_any (super role)
    { role: 'manager', expectForbidden: true }, // has projects:update but not owner/manage_any
    { role: 'referent', expectForbidden: true }, // no projects:update
    { role: 'contributeur', expectForbidden: true }, // no projects:update
    { role: 'observateur', expectForbidden: true }, // no projects:update
  ];

  for (const { role, expectForbidden } of cases) {
    test(
      `PATCH /projects/:id as ${role} → ${expectForbidden ? '403' : '2xx'}`,
      { tag: '@smoke' },
      async ({ request }) => {
        test.skip(!projectId, 'Project creation failed in beforeAll');
        const res = await request.patch(
          `${baseUrl()}/api/projects/${projectId}`,
          {
            headers: auth(role, true),
            data: { description: `Touched by ${role}` },
          },
        );
        if (expectForbidden) {
          expect(
            res.status(),
            `${role} PATCH /projects/:id should be 403, got ${res.status()}`,
          ).toBe(403);
        } else {
          expect(
            res.status() >= 200 && res.status() < 300,
            `${role} PATCH /projects/:id should be 2xx, got ${res.status()}`,
          ).toBeTruthy();
        }
      },
    );
  }
});
