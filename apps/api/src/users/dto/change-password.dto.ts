import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-policy';

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
  @IsStrongPassword()
  newPassword: string;
}
