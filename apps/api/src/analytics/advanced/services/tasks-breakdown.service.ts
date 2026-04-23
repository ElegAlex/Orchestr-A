import { Injectable, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  TasksBreakdownQueryDto,
  TasksBreakdownResponseDto,
} from '../dto/tasks-breakdown.dto';

@Injectable()
export class TasksBreakdownService {
  constructor(private readonly prisma: PrismaService) {}

  async getTasksBreakdown(
    _query: TasksBreakdownQueryDto,
  ): Promise<TasksBreakdownResponseDto> {
    throw new NotImplementedException('W2.2 — pending');
  }
}
