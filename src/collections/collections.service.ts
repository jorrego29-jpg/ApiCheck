// src/collections/collections.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto, CreateFolderDto, CreateRequestDto } from './dto/create-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Colecciones ---
  async createCollection(dto: CreateCollectionDto) {
    return this.prisma.collection.create({
      data: dto,
    });
  }

  /**
   * Carga todo el árbol jerárquico de la colección (carpetas, subcarpetas y peticiones)
   */
  async getCollectionTree(collectionId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        folders: {
          where: { parentId: null }, // Carpetas raíz
          include: {
            children: {
              include: { requests: true },
            },
            requests: true,
          },
        },
        requests: {
          where: { folderId: null }, // Peticiones en la raíz de la colección
        },
      },
    });

    if (!collection) throw new NotFoundException(`Colección ${collectionId} no encontrada.`);
    return collection;
  }

  async findAllByWorkspace(workspaceId: string) {
    return this.prisma.collection.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { requests: true, folders: true } },
      },
    });
  }

  // --- Carpetas ---
  async createFolder(dto: CreateFolderDto) {
    return this.prisma.folder.create({
      data: dto,
    });
  }

  // --- Peticiones ---
  async createRequest(dto: CreateRequestDto) {
    return this.prisma.request.create({
      data: dto,
    });
  }

  async findRequestById(id: string) {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: { collection: true, folder: true },
    });
    if (!req) throw new NotFoundException(`Petición ${id} no encontrada.`);
    return req;
  }

  async updateRequest(id: string, dto: Partial<CreateRequestDto>) {
    await this.findRequestById(id);
    return this.prisma.request.update({
      where: { id },
      data: dto,
    });
  }

  async deleteRequest(id: string) {
    await this.findRequestById(id);
    return this.prisma.request.delete({ where: { id } });
  }
}