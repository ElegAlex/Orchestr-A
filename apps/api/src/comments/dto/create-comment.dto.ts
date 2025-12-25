import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Contenu du commentaire',
    example: 'Excellent travail sur cette tâche!',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'ID de la tâche', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;
}
