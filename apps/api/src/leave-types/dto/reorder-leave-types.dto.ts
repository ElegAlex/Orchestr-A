import { IsArray, IsUUID, ArrayMaxSize } from 'class-validator';

export class ReorderLeaveTypesDto {
  @IsArray()
  @ArrayMaxSize(50) // PER-045: guard against oversized reorder payloads
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
