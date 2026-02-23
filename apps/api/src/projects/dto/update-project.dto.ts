import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';
import { IsOptional, IsArray, IsEnum, IsString } from 'class-validator';
import { TaskStatus } from 'database';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiProperty({
    description:
      'Statuts de tâches masqués dans la vue Kanban de ce projet (TODO et DONE ne peuvent pas être masqués)',
    enum: TaskStatus,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  hiddenStatuses?: TaskStatus[];

  @ApiProperty({
    description:
      'Statuts de tâches visibles dans la vue Kanban de ce projet (vide = tous visibles)',
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleStatuses?: string[];
}
