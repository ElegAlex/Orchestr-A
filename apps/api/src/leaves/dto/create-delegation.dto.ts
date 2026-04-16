import { IsUUID, IsDateString } from 'class-validator';

export class CreateDelegationDto {
  @IsUUID()
  delegateId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
