import { IsArray, IsUUID } from 'class-validator';

export class ReorderLeaveTypesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
