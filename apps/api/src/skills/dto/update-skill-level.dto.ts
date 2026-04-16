import { IsEnum } from 'class-validator';
import { SkillLevel } from '@prisma/client';

export class UpdateSkillLevelDto {
  @IsEnum(SkillLevel)
  level: SkillLevel;
}
