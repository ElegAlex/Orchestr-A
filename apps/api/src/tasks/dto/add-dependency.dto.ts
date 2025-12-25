import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddDependencyDto {
  @ApiProperty({
    description: 'ID de la tâche dépendante',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  dependsOnId: string;
}
