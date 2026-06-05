import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';

describe('CreateCommentDto validation', () => {
  it('SEC-005 — rejects content exceeding 10000 characters', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'A'.repeat(10001),
      taskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    const contentError = errors.find((e) => e.property === 'content');
    expect(contentError).toBeDefined();
    expect(contentError?.constraints).toHaveProperty('maxLength');
  });

  it('accepts content at exactly 10000 characters', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'A'.repeat(10000),
      taskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a normal comment', async () => {
    const dto = plainToInstance(CreateCommentDto, {
      content: 'Excellent travail sur cette tâche!',
      taskId: '550e8400-e29b-41d4-a716-446655440000',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpdateCommentDto validation', () => {
  it('SEC-005 — rejects content exceeding 10000 characters', async () => {
    const dto = plainToInstance(UpdateCommentDto, {
      content: 'A'.repeat(10001),
    });
    const errors = await validate(dto);
    const contentError = errors.find((e) => e.property === 'content');
    expect(contentError).toBeDefined();
    expect(contentError?.constraints).toHaveProperty('maxLength');
  });

  it('accepts content at exactly 10000 characters', async () => {
    const dto = plainToInstance(UpdateCommentDto, {
      content: 'A'.repeat(10000),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
