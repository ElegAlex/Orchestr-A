import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProjectHealthRowDto } from '../dto/project-health.dto';

@Injectable()
export class ProjectHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectHealth(): Promise<ProjectHealthRowDto[]> {
    throw new NotImplementedException('W2.2 — pending');
  }
}
