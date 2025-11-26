import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class UpdatePersonalTodoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Le texte ne peut pas dépasser 200 caractères' })
  text?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
