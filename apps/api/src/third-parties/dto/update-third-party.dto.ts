import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateThirdPartyDto } from './create-third-party.dto';

export class UpdateThirdPartyDto extends PartialType(CreateThirdPartyDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
