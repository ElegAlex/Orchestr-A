import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-policy';

export class RegisterDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'jean.dupont@orchestr-a.internal',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Login (format: prenom.nom)',
    example: 'jean.dupont',
  })
  @IsString()
  @MinLength(3)
  login: string;

  @ApiProperty({
    description:
      'Mot de passe (minimum 8 caractères, avec majuscule, chiffre et caractère spécial)',
    example: 'P@ssword1',
  })
  @IsStrongPassword()
  password: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Jean',
  })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Dupont',
  })
  @IsString()
  @MinLength(2)
  lastName: string;
}
