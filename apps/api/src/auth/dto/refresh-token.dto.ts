import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token opaque (48 bytes base64url)',
    required: false,
  })
  @IsOptional()
  @MaxLength(256)
  @IsString()
  refreshToken?: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token à révoquer (optionnel mais recommandé)',
    required: false,
  })
  @IsOptional()
  @MaxLength(256)
  @IsString()
  refreshToken?: string;
}
