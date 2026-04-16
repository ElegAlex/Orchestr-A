import { IsString, MaxLength } from 'class-validator';

export class ImportIcsDto {
  @IsString()
  @MaxLength(5 * 1024 * 1024)
  icsContent: string;
}
