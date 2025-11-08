import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ description: 'Contenu du commentaire' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
