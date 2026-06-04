import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { IsStrongPassword } from '../../common/validators/password-policy';

// SEC-008: reject control characters (Cc = control, Cn = unassigned) while allowing
// unicode letters, accented chars, spaces, hyphens, apostrophes (French names).
const NO_CONTROL_CHARS = /^[^\p{Cc}\p{Cn}]+$/u;

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
  @MaxLength(50)
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
  @MaxLength(50)
  @Matches(NO_CONTROL_CHARS, {
    message: 'firstName must not contain control characters',
  })
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Dupont',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(NO_CONTROL_CHARS, {
    message: 'lastName must not contain control characters',
  })
  lastName: string;
}
