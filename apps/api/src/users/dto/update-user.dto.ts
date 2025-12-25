import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Nouveau mot de passe (optionnel)',
    required: false,
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  password?: string;
}
