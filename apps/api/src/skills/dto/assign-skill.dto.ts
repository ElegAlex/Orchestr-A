import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsUUID } from 'class-validator';
import { SkillLevel } from 'database';

export class AssignSkillDto {
  @ApiProperty({
    description: 'ID de la compétence à assigner',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  skillId: string;

  @ApiProperty({
    description: 'Niveau de maîtrise',
    enum: SkillLevel,
    example: SkillLevel.INTERMEDIATE,
  })
  @IsEnum(SkillLevel)
  @IsNotEmpty()
  level: SkillLevel;
}
