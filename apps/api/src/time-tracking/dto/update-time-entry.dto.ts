import { PartialType } from '@nestjs/swagger';
import { CreateTimeEntryDto } from './create-time-entry.dto';

export class UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto) {}
