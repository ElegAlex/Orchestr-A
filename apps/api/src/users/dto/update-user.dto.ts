import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/validators/password-policy';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description:
      'Nouveau mot de passe (minimum 8 caractères, avec majuscule, chiffre et caractère spécial)',
    required: false,
    minLength: 8,
  })
  @IsOptional()
  @IsStrongPassword()
  password?: string;

  // SEC-011 — isActive is declared HERE (not inherited from CreateUserDto, which
  // no longer carries it) so the admin activate/deactivate PATCH keeps working.
  // The true→false / false→true transitions on this field are what
  // users.service.update() audits as USER_DEACTIVATED / USER_REACTIVATED.
  @ApiProperty({
    description: 'Compte actif',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
