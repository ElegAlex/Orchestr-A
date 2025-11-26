import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePersonalTodoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200, { message: 'Le texte ne peut pas dépasser 200 caractères' })
  text: string;
}
