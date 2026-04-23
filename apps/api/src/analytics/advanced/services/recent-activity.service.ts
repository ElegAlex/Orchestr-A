import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  RecentActivityQueryDto,
  RecentActivityResponseDto,
} from '../dto/recent-activity.dto';

@Injectable()
export class RecentActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentActivity(
    _query: RecentActivityQueryDto,
  ): Promise<RecentActivityResponseDto> {
    throw new NotImplementedException('W2.2 — pending');
  }
}
