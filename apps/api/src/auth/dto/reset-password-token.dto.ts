import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ResetPasswordTokenDto {
  @ApiProperty({
    description:
      "Identifiant de l'utilisateur pour lequel générer un token de réinitialisation",
    example: 'uuid-de-l-utilisateur',
  })
  @IsUUID()
  userId: string;
}
