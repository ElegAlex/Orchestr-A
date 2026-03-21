import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mot de passe actuel',
    example: 'oldPassword123',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description:
      'Nouveau mot de passe (minimum 8 caractères, avec majuscule, chiffre et caractère spécial)',
    example: 'N3wP@ssword',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial',
  })
  newPassword: string;
}
