import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MilestonesCompletionResponseDto } from '../dto/milestones-completion.dto';

@Injectable()
export class MilestonesCompletionService {
  constructor(private readonly prisma: PrismaService) {}

  async getMilestonesCompletion(): Promise<MilestonesCompletionResponseDto> {
    throw new NotImplementedException('W2.2 — pending');
  }
}
