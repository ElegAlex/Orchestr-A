import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { RACIRole } from 'database';

export class AssignRACIDto {
  @ApiProperty({
    description: "ID de l'utilisateur à assigner",
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: "Rôle RACI de l'utilisateur",
    enum: RACIRole,
    example: RACIRole.RESPONSIBLE,
  })
  @IsEnum(RACIRole)
  @IsNotEmpty()
  role: RACIRole;
}
