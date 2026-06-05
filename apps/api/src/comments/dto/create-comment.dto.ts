import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire',
    example: 'Excellent travail sur cette tâche!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiProperty({ description: 'ID de la tâche', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;
}
