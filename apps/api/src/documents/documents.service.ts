import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createDocumentDto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        ...createDocumentDto,
        uploadedBy: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(page = 1, limit = 10, projectId?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (projectId) where.projectId = projectId;

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });
    if (!document) throw new NotFoundException('Document introuvable');
    return document;
  }

  async update(id: string, updateDocumentDto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({
      where: { id },
      data: updateDocumentDto,
      include: {
        project: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document supprimé avec succès' };
  }
}
