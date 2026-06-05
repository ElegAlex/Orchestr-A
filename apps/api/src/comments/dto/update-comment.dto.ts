import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({ description: 'Contenu du commentaire' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;
}
