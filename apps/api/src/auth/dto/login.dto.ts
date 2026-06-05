import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: "Login de l'utilisateur (format: prenom.nom)",
    example: 'admin',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  login: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'admin123',
  })
  @IsString()
  @MinLength(6)
  // SEC-003: cap at 1024 chars — bcrypt is CPU-intensive; without an upper
  // bound an attacker can exhaust server CPU with a 1 MB password even under
  // the per-IP rate throttle.
  @MaxLength(1024)
  password: string;
}
