import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SnapshotsQueryDto,
  SnapshotsResponseDto,
} from '../dto/snapshots-query.dto';

@Injectable()
export class SnapshotsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshots(_query: SnapshotsQueryDto): Promise<SnapshotsResponseDto> {
    throw new NotImplementedException('W2.2 — pending');
  }
}
