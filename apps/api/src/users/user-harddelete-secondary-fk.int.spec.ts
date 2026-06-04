import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from 'database';

/**
 * DAT-008 / DAT-026 — real-DB witness for the *full-erasure* user-deletion
 * semantics (operator decision 2026-06-04: this app is NOT the SIRH of legal
 * record, so there is no retention/anonymisation obligation; a deleted user is
 * fully erased). The invariant under test concerns the SECONDARY references —
 * rows where the deleted user is only an *actor* on someone else's data
 * (`declaredBy` on another user's time entry, `createdBy` on a shared event):
 *
 *   • Deleting the actor must NOT be blocked by their secondary references, and
 *   • must NOT delete the other user's / the shared record — only NULL the link.
 *
 * Two failure modes the original schema exhibited:
 *   1. BLOCKS  — `TimeEntry.declaredBy` was `onDelete: Restrict`, so deleting a
 *      manager who declared a subordinate's time entry raised P2003.
 *   2. ORPHANS — `Event.createdBy` was `onDelete: Cascade`, so deleting the
 *      creator silently destroyed the event AND every participant's row (other
 *      users' data) with it.
 *
 * Both are fixed by flipping these secondary FKs to `SetNull` (+ nullable
 * column). Owned records (the user's OWN leaves/time entries/…) are a separate
 * concern handled by explicit deletes in UsersService.hardDelete.
 *
 * Runs against the ephemeral migrated DB provisioned by vitest.int.global-setup.ts,
 * as the restricted `app_user` role (production parity).
 */

const prisma = new PrismaClient();

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `int-${id}@example.test`,
      login: `int-${id}`,
      passwordHash: 'integration-test-not-a-real-hash',
      firstName: 'Int',
      lastName: 'Test',
    },
  });
  return id;
}

describe("hardDelete secondary-FK semantics: deleting an actor never erases another user's data (real DB)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('declaredBy: deleting the manager who declared a subordinate time entry succeeds and the entry survives with declaredById NULL', async () => {
    const subordinateId = await makeUser(); // owns the time entry
    const managerId = await makeUser(); // only the declarer (secondary ref)

    const entry = await prisma.timeEntry.create({
      data: {
        userId: subordinateId,
        declaredById: managerId,
        date: new Date('2026-01-15'),
        hours: new Prisma.Decimal('7.5'),
        activityType: 'DEVELOPMENT',
      },
    });

    // Full-erasure: the manager (a secondary actor) must be deletable. On the
    // original schema (declaredBy Restrict) this raises P2003.
    let err: unknown;
    try {
      await prisma.user.delete({ where: { id: managerId } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeUndefined();

    // The subordinate's time entry is NOT their manager's data — it survives,
    // only the declaredBy link is nulled.
    const survived = await prisma.timeEntry.findUnique({
      where: { id: entry.id },
    });
    expect(survived).not.toBeNull();
    expect(survived?.declaredById).toBeNull();
    expect(survived?.userId).toBe(subordinateId);

    await prisma.timeEntry.delete({ where: { id: entry.id } });
    await prisma.user.delete({ where: { id: subordinateId } });
  });

  it('Event.createdBy: deleting the creator preserves the shared event and every participant row', async () => {
    const creatorId = await makeUser();
    const participantId = await makeUser();

    const event = await prisma.event.create({
      data: {
        title: 'Shared planning meeting',
        date: new Date('2026-02-01'),
        createdById: creatorId,
        participants: { create: [{ userId: participantId }] },
      },
    });

    // On the original schema (Event.createdBy Cascade) deleting the creator
    // cascade-deletes the event AND the participant row — another user's data.
    await prisma.user.delete({ where: { id: creatorId } });

    const survived = await prisma.event.findUnique({ where: { id: event.id } });
    expect(survived).not.toBeNull();
    expect(survived?.createdById).toBeNull();

    const participation = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: participantId } },
    });
    expect(participation).not.toBeNull();

    await prisma.eventParticipant.deleteMany({ where: { eventId: event.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.user.delete({ where: { id: participantId } });
  });
});
