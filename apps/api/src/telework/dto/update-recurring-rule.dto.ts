import { PartialType } from '@nestjs/swagger';
import { CreateRecurringRuleDto } from './create-recurring-rule.dto';

export class UpdateRecurringRuleDto extends PartialType(
  CreateRecurringRuleDto,
) {}
