import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mot de passe actuel',
    example: 'oldPassword123',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (minimum 6 caractères)',
    example: 'newPassword123',
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
