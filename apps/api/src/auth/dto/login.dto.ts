import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Login de l\'utilisateur (format: prenom.nom)',
    example: 'admin',
  })
  @IsString()
  @MinLength(3)
  login: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'admin123',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
