// src/workspaces/workspaces.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({ data: { name: dto.name } });
  }

  findAll() {
    return this.prisma.workspace.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { collections: true, environments: true } },
      },
    });
  }

  async findOne(id: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: { select: { collections: true, environments: true } },
      },
    });
    if (!workspace) throw new NotFoundException(`Workspace ${id} no encontrado.`);
    return workspace;
  }
}
