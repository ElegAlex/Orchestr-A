import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional } from 'class-validator';
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
}
