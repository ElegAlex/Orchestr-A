import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WorkloadQueryDto, WorkloadUserDto } from '../dto/workload.dto';

@Injectable()
export class WorkloadService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(_query: WorkloadQueryDto): Promise<WorkloadUserDto[]> {
    throw new NotImplementedException('W2.2 — pending');
  }
}
