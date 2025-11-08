import { PartialType } from '@nestjs/swagger';
import { CreateTeleworkDto } from './create-telework.dto';

export class UpdateTeleworkDto extends PartialType(CreateTeleworkDto) {}
