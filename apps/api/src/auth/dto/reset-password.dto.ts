import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-policy';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de réinitialisation reçu par lien',
    example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description:
      'Nouveau mot de passe (minimum 8 caractères, avec majuscule, chiffre et caractère spécial)',
    example: 'NouveauMotDePasse1!',
  })
  @IsStrongPassword()
  newPassword: string;
}
