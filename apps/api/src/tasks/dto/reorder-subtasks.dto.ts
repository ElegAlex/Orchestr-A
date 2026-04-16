import { IsArray, IsUUID } from 'class-validator';

export class ReorderSubtasksDto {
  @IsArray()
  @IsUUID('4', { each: true })
  subtaskIds: string[];
}
