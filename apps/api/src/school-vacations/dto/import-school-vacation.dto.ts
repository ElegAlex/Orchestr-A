import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class ImportSchoolVacationDto {
  @ApiProperty({
    description: "Année scolaire de début pour l'import",
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}
