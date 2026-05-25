# Manage Approved Leaves (Delete & Edit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow management roles (ADMIN, RESPONSABLE, MANAGER) to directly delete and edit approved leaves, while keeping the existing cancellation-request workflow for standard users.

**Architecture:** Extend the existing `remove()` and `update()` methods in `LeavesService` to accept APPROVED status when the caller has a management role. Update frontend `renderLeaveCard` to show edit/delete icons on APPROVED leaves for management users. No schema migration needed.

**Tech Stack:** NestJS (backend service), Next.js/React (frontend), Vitest (tests)

---

### Task 1: Backend — Allow management roles to delete APPROVED leaves

**Files:**

- Modify: `apps/api/src/leaves/leaves.service.ts:909-943` (remove method)
- Test: `apps/api/src/leaves/leaves.service.spec.ts:950-987` (remove tests)

- [ ] **Step 1: Update the existing test that expects deletion of APPROVED leaves to throw**

The test at line 979 (`should throw BadRequestException when leave is approved`) must be changed — ADMIN deleting an APPROVED leave should now succeed.

In `apps/api/src/leaves/leaves.service.spec.ts`, replace the test:

```typescript
it("should throw BadRequestException when leave is approved", async () => {
  const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

  await expect(
    service.remove("leave-1", "admin-user-id", "ADMIN"),
  ).rejects.toThrow(BadRequestException);
});
```

With:

```typescript
it("should allow management roles to delete an approved leave", async () => {
  const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
  mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);

  const result = await service.remove("leave-1", "admin-user-id", "ADMIN");
  expect(result.message).toBe("Demande de congé supprimée avec succès");
});

it("should allow RESPONSABLE to delete an approved leave", async () => {
  const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
  mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);

  const result = await service.remove("leave-1", "resp-user-id", "RESPONSABLE");
  expect(result.message).toBe("Demande de congé supprimée avec succès");
});

it("should allow MANAGER to delete an approved leave", async () => {
  const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
  mockPrismaService.leave.delete.mockResolvedValue(approvedLeave);

  const result = await service.remove("leave-1", "mgr-user-id", "MANAGER");
  expect(result.message).toBe("Demande de congé supprimée avec succès");
});

it("should throw BadRequestException when non-management role deletes approved leave", async () => {
  const approvedLeave = { ...mockLeave, status: LeaveStatus.APPROVED };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

  await expect(
    service.remove("leave-1", "contrib-user-id", "CONTRIBUTEUR"),
  ).rejects.toThrow(BadRequestException);
});

it("should still allow any role to delete PENDING leaves", async () => {
  const pendingLeave = {
    ...mockLeave,
    status: LeaveStatus.PENDING,
    userId: "contrib-user-id",
  };
  mockPrismaService.leave.findUnique.mockResolvedValue(pendingLeave);
  mockPrismaService.leave.delete.mockResolvedValue(pendingLeave);

  const result = await service.remove(
    "leave-1",
    "contrib-user-id",
    "CONTRIBUTEUR",
  );
  expect(result.message).toBe("Demande de congé supprimée avec succès");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx vitest run src/leaves/leaves.service.spec.ts -t "remove"`
Expected: 3 new tests FAIL (service still rejects APPROVED deletion for management roles)

- [ ] **Step 3: Update `remove()` method in service**

In `apps/api/src/leaves/leaves.service.ts`, replace lines 929-937:

```typescript
// Seules les demandes en attente ou refusées peuvent être supprimées
if (
  leave.status !== LeaveStatus.PENDING &&
  leave.status !== LeaveStatus.REJECTED
) {
  throw new BadRequestException(
    "Seules les demandes en attente ou refusées peuvent être supprimées",
  );
}
```

With:

```typescript
// Management roles can also delete APPROVED and CANCELLATION_REQUESTED leaves
const canDeleteAnyStatus =
  currentUserRole && this.isManagementRole(currentUserRole);

if (!canDeleteAnyStatus) {
  // Non-management: only PENDING or REJECTED
  if (
    leave.status !== LeaveStatus.PENDING &&
    leave.status !== LeaveStatus.REJECTED
  ) {
    throw new BadRequestException(
      "Seules les demandes en attente ou refusées peuvent être supprimées",
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/leaves/leaves.service.spec.ts -t "remove"`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/leaves/leaves.service.ts apps/api/src/leaves/leaves.service.spec.ts
git commit -m "feat(leaves): allow management roles to delete approved leaves"
```

---

### Task 2: Backend — Allow management roles to update APPROVED leaves

**Files:**

- Modify: `apps/api/src/leaves/leaves.service.ts:781-811` (update method)
- Test: `apps/api/src/leaves/leaves.service.spec.ts:813-907` (update tests)

- [ ] **Step 1: Add new tests for updating APPROVED leaves**

In `apps/api/src/leaves/leaves.service.spec.ts`, add these tests inside the `describe('update', ...)` block, after the existing tests:

```typescript
it("should allow ADMIN to update an approved leave", async () => {
  const approvedLeave = {
    ...mockLeave,
    status: LeaveStatus.APPROVED,
    leaveTypeId: "type-1",
  };
  const updatedLeave = { ...approvedLeave, comment: "Updated by admin" };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
  mockPrismaService.leave.findMany.mockResolvedValue([]); // No overlap
  mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

  const result = await service.update(
    "leave-1",
    { reason: "Updated by admin" },
    "admin-user-id",
    "ADMIN",
  );

  expect(result).toEqual(updatedLeave);
});

it("should allow RESPONSABLE to update an approved leave", async () => {
  const approvedLeave = {
    ...mockLeave,
    status: LeaveStatus.APPROVED,
    leaveTypeId: "type-1",
  };
  const updatedLeave = { ...approvedLeave, comment: "Updated by resp" };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);
  mockPrismaService.leave.findMany.mockResolvedValue([]);
  mockPrismaService.leave.update.mockResolvedValue(updatedLeave);

  const result = await service.update(
    "leave-1",
    { reason: "Updated by resp" },
    "resp-user-id",
    "RESPONSABLE",
  );

  expect(result).toEqual(updatedLeave);
});

it("should throw BadRequestException when CONTRIBUTEUR updates approved leave", async () => {
  const approvedLeave = {
    ...mockLeave,
    status: LeaveStatus.APPROVED,
    userId: "contrib-user-id",
  };
  mockPrismaService.leave.findUnique.mockResolvedValue(approvedLeave);

  await expect(
    service.update(
      "leave-1",
      { reason: "Want to change" },
      "contrib-user-id",
      "CONTRIBUTEUR",
    ),
  ).rejects.toThrow(BadRequestException);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd apps/api && npx vitest run src/leaves/leaves.service.spec.ts -t "update"`
Expected: 2 new "allow" tests FAIL, the CONTRIBUTEUR test PASSES (already blocked)

- [ ] **Step 3: Update `update()` method in service**

In `apps/api/src/leaves/leaves.service.ts`, replace lines 806-811:

```typescript
// Seules les demandes en attente peuvent être modifiées
if (existingLeave.status !== LeaveStatus.PENDING) {
  throw new BadRequestException(
    "Seules les demandes en attente peuvent être modifiées",
  );
}
```

With:

```typescript
// Management roles can also update APPROVED leaves (change type, dates)
const canUpdateAnyStatus =
  currentUserRole && this.isManagementRole(currentUserRole);

if (!canUpdateAnyStatus && existingLeave.status !== LeaveStatus.PENDING) {
  throw new BadRequestException(
    "Seules les demandes en attente peuvent être modifiées",
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx vitest run src/leaves/leaves.service.spec.ts -t "update"`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/leaves/leaves.service.ts apps/api/src/leaves/leaves.service.spec.ts
git commit -m "feat(leaves): allow management roles to update approved leaves"
```

---

### Task 3: Frontend — Show edit/delete icons on APPROVED leaves for management roles

**Files:**

- Modify: `apps/web/app/[locale]/leaves/page.tsx:747-777` (renderLeaveCard action buttons)

- [ ] **Step 1: Add a management role check variable**

In `apps/web/app/[locale]/leaves/page.tsx`, after line 102 (`const canValidate = ...`), add:

```typescript
const canManageLeaves = hasPermission("leaves:delete");
```

- [ ] **Step 2: Update the edit button condition**

Replace line 747:

```typescript
{!showValidationActions && leave.status === LeaveStatus.PENDING && (
```

With:

```typescript
{!showValidationActions && (leave.status === LeaveStatus.PENDING || (canManageLeaves && leave.status === LeaveStatus.APPROVED)) && (
```

This shows the edit icon on APPROVED leaves only for users with `leaves:delete` permission (ADMIN, RESPONSABLE, MANAGER).

- [ ] **Step 3: Update the delete button condition**

Replace lines 756-758:

```typescript
{(leave.status === LeaveStatus.PENDING ||
  leave.status === LeaveStatus.REJECTED) &&
  !showValidationActions && (
```

With:

```typescript
{((leave.status === LeaveStatus.PENDING ||
  leave.status === LeaveStatus.REJECTED) ||
  (canManageLeaves && (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.CANCELLATION_REQUESTED))) &&
  !showValidationActions && (
```

This shows the trash icon on APPROVED/CANCELLATION_REQUESTED leaves for management roles.

- [ ] **Step 4: Update the "all-leaves" tab to show management actions**

The all-leaves tab (line 1001) calls `renderLeaveCard(leave, true, false)`. Since we're now checking `canManageLeaves` inside the card, no change needed — the icons will automatically appear for management users in this tab too.

- [ ] **Step 5: Verify the build compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/[locale]/leaves/page.tsx
git commit -m "feat(leaves): show edit/delete actions on approved leaves for management roles"
```

---

### Task 4: Frontend — Ensure edit modal works for APPROVED leaves

**Files:**

- Modify: `apps/web/app/[locale]/leaves/page.tsx:280-306` (handleEdit handler)

- [ ] **Step 1: Verify current handleEdit/handleUpdate behavior**

Read `apps/web/app/[locale]/leaves/page.tsx` around the `handleEdit`/`handleUpdate` function (lines 280-306). The `openEditModal` (line 435) already populates the form correctly regardless of status. The `handleUpdate` (line 289) calls `leavesService.update()` which will now work for APPROVED leaves since the backend accepts it. No frontend change needed for the edit submission — the backend handles the authorization.

- [ ] **Step 2: Add a confirmation dialog for editing APPROVED leaves**

In `apps/web/app/[locale]/leaves/page.tsx`, in the `handleUpdate` function, add a confirmation before calling the API when the leave is APPROVED. Replace lines 289-306:

```typescript
const handleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingLeave) return;
  try {
    await leavesService.update(editingLeave.id, formData);
    toast.success(t("messages.updated"));
    setShowEditModal(false);
    setEditingLeave(null);
    resetForm();
    fetchAll();
  } catch (err) {
    const axiosError = err as { response?: { data?: { message?: string } } };
    toast.error(
      axiosError.response?.data?.message || tc("errors.validationError"),
    );
  }
};
```

With:

```typescript
const handleUpdate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editingLeave) return;
  if (
    editingLeave.status === LeaveStatus.APPROVED &&
    !confirm("Ce congé est déjà approuvé. Confirmer la modification ?")
  ) {
    return;
  }
  try {
    await leavesService.update(editingLeave.id, formData);
    toast.success(t("messages.updated"));
    setShowEditModal(false);
    setEditingLeave(null);
    resetForm();
    fetchAll();
  } catch (err) {
    const axiosError = err as { response?: { data?: { message?: string } } };
    toast.error(
      axiosError.response?.data?.message || tc("errors.validationError"),
    );
  }
};
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/[locale]/leaves/page.tsx
git commit -m "feat(leaves): add confirmation dialog when editing approved leaves"
```

---

### Task 5: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run backend tests**

Run: `cd apps/api && npx vitest run src/leaves/`
Expected: All tests PASS

- [ ] **Step 2: Run full build**

Run: `pnpm run build 2>&1 | tail -10`
Expected: Build succeeds for both API and web

- [ ] **Step 3: Final commit (if any fixes needed)**

Only if issues were found in steps 1-2, fix and commit.
