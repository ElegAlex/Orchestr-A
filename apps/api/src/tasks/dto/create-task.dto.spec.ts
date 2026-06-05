import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

/**
 * COR-035 — layer-of-rejection partner to DAT-017's DB CHECK.
 * The orphan task combination (epicId or milestoneId set without projectId)
 * must return 400 at the DTO instead of leaking 23514 as a 500.
 *
 * Constraint surfaces under `projectRequiredWhenParented` (the
 * ValidatorConstraint name on `ProjectRequiredWhenParentedConstraint`).
 * Attached to `epicId` and `milestoneId` (not `projectId`) to avoid the
 * `@ValidateIf` short-circuit that would skip the check exactly when
 * projectId is empty — the failure mode the audit cites.
 */

const VALID_TITLE = 'COR-035 witness task';
const UUID_A = '00000000-0000-4000-8000-000000000001';
const UUID_B = '00000000-0000-4000-8000-000000000002';
const UUID_C = '00000000-0000-4000-8000-000000000003';

describe('CreateTaskDto — COR-035 orphan-task cross-field guard', () => {
  it('rejects epicId set with projectId omitted (orphan, the audit failure mode)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      epicId: UUID_A,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('projectRequiredWhenParented');
  });

  it('rejects milestoneId set with projectId omitted (orphan)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      milestoneId: UUID_B,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('projectRequiredWhenParented');
  });

  it('rejects epicId set with projectId explicitly empty/null (orphan)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      epicId: UUID_A,
      projectId: '',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('projectRequiredWhenParented');
  });

  it('accepts all-null transverse (no parent, no project — a free standalone task)', async () => {
    const dto = plainToInstance(CreateTaskDto, { title: VALID_TITLE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts projectId set with epicId set (parented under the right project)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      projectId: UUID_A,
      epicId: UUID_B,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts projectId set with milestoneId set', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      projectId: UUID_A,
      milestoneId: UUID_C,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts projectId alone (no parent set)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      projectId: UUID_A,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CreateTaskDto — SEC-019 tags field array-of-strings validation', () => {
  it('SEC-019 — rejects tags containing non-string elements (numbers)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      tags: [1, 2, 3],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('tags');
  });

  it('SEC-019 — rejects tags containing object elements', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      tags: [{ evil: true }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('tags');
  });

  it('SEC-019 — rejects tags array exceeding 20 elements', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('tags');
  });

  it('SEC-019 — rejects tags with a string exceeding 50 characters', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      tags: ['a'.repeat(51)],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const flat = JSON.stringify(errors);
    expect(flat).toContain('tags');
  });

  it('SEC-019 — accepts valid tags (array of short strings within limit)', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: VALID_TITLE,
      tags: ['backend', 'auth', 'critical'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('SEC-019 — accepts omitted tags (optional field)', async () => {
    const dto = plainToInstance(CreateTaskDto, { title: VALID_TITLE });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateTaskDto — COR-035 cross-field guard is intentionally NOT inherited', () => {
  // Partial update with only epicId in the payload must NOT 400 — the DB row
  // may already hold projectId. UpdateTaskDto OmitType-removes the three
  // fields before PartialType then redeclares them without @Validate.
  it('accepts a partial update with only epicId (DB row may already carry projectId)', async () => {
    const dto = plainToInstance(UpdateTaskDto, { epicId: UUID_A });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update with only milestoneId', async () => {
    const dto = plainToInstance(UpdateTaskDto, { milestoneId: UUID_C });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update with only title', async () => {
    const dto = plainToInstance(UpdateTaskDto, { title: 'renamed' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
