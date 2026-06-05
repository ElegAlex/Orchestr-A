import { IsArray, IsUUID, ArrayMaxSize } from 'class-validator';

export class ReorderSubtasksDto {
  // PER-026 — prevent unbounded reorder payloads
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  subtaskIds: string[];
}
