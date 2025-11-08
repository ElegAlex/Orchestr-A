import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur à ajouter',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Rôle du membre dans le projet',
    example: 'Développeur Frontend',
    required: false,
  })
  @IsString()
  @IsOptional()
  role?: string;
}
