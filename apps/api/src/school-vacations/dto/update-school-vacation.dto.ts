import { PartialType } from '@nestjs/swagger';
import { CreateSchoolVacationDto } from './create-school-vacation.dto';

export class UpdateSchoolVacationDto extends PartialType(
  CreateSchoolVacationDto,
) {}
