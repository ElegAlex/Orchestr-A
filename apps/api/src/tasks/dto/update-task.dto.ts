import { OmitType, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

// UpdateTaskDto is intentionally NOT subject to the COR-035 orphan-task
// cross-field check inherited from CreateTaskDto. On a partial update the
// caller may legitimately send only one of {projectId, epicId, milestoneId}
// while the DB row already holds the rest; the DTO has no view into DB state
// and would 400 a valid update. The DB CHECK `tasks_parent_requires_project_ck`
// (DAT-017) still catches a genuine orphan if a service path constructs one.
// CreateTaskDto catches the common entry point at 400.
//
// We `OmitType` the three fields from PartialType and redeclare them without
// the @Validate(ProjectRequiredWhenParentedConstraint) decorator so the
// update path stays unconstrained.
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['projectId', 'epicId', 'milestoneId'] as const),
) {
  @ValidateIf(
    (o: UpdateTaskDto) =>
      o.projectId !== null && o.projectId !== undefined && o.projectId !== '',
  )
  @IsUUID()
  @IsOptional()
  projectId?: string | null;

  @IsUUID()
  @IsOptional()
  epicId?: string;

  @IsUUID()
  @IsOptional()
  milestoneId?: string;
}
