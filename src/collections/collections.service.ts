// src/collections/collections.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCollectionDto,
  CreateFolderDto,
  CreateRequestDto,
  UpdateCollectionDto,
  UpdateFolderDto,
  UpdateRequestDto,
} from './dto/create-collection.dto';

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
   * Carga el árbol completo de la colección: carpetas a cualquier profundidad
   * (cada carpeta con `requests` y `children`) y las peticiones de la raíz.
   */
  async getCollectionTree(collectionId: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        // Todas las carpetas en plano; el árbol se arma por parentId.
        folders: {
          include: { requests: { orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        },
        requests: {
          where: { folderId: null }, // Peticiones en la raíz de la colección
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!collection) throw new NotFoundException(`Colección ${collectionId} no encontrada.`);

    const nodes = new Map(collection.folders.map((f) => [f.id, { ...f, children: [] as any[] }]));
    const roots: any[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }

    return { ...collection, folders: roots };
  }

  async findAllByWorkspace(workspaceId: string) {
    if (!workspaceId) throw new BadRequestException('El parámetro workspaceId es obligatorio.');
    return this.prisma.collection.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { requests: true, folders: true } },
      },
    });
  }

  async findCollectionById(id: string) {
    const collection = await this.prisma.collection.findUnique({ where: { id } });
    if (!collection) throw new NotFoundException(`Colección ${id} no encontrada.`);
    return collection;
  }

  async updateCollection(id: string, dto: UpdateCollectionDto) {
    await this.findCollectionById(id);
    return this.prisma.collection.update({ where: { id }, data: dto });
  }

  async deleteCollection(id: string) {
    await this.findCollectionById(id);
    // Carpetas y peticiones se eliminan en cascada (onDelete: Cascade).
    return this.prisma.collection.delete({ where: { id } });
  }

  // --- Carpetas ---
  async createFolder(dto: CreateFolderDto) {
    return this.prisma.folder.create({
      data: dto,
    });
  }

  async findFolderById(id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) throw new NotFoundException(`Carpeta ${id} no encontrada.`);
    return folder;
  }

  async updateFolder(id: string, dto: UpdateFolderDto) {
    const folder = await this.findFolderById(id);

    // Mover la carpeta: el destino debe existir, ser de la misma colección y no ser ella misma ni un descendiente.
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Una carpeta no puede ser su propia carpeta padre.');
      }
      const parent = await this.prisma.folder.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.collectionId !== folder.collectionId) {
        throw new BadRequestException('La carpeta padre no existe en la misma colección.');
      }
      let cursor: string | null = parent.parentId;
      while (cursor) {
        if (cursor === id) {
          throw new BadRequestException('No se puede mover una carpeta dentro de una de sus subcarpetas.');
        }
        const up = await this.prisma.folder.findUnique({
          where: { id: cursor },
          select: { parentId: true },
        });
        cursor = up?.parentId ?? null;
      }
    }

    return this.prisma.folder.update({ where: { id }, data: dto });
  }

  /**
   * Elimina la carpeta, sus subcarpetas y TODAS las peticiones que contienen.
   * (El schema solo pone folderId en null al borrar una carpeta; aquí se borran
   * explícitamente para que no queden peticiones huérfanas en la raíz.)
   */
  async deleteFolder(id: string) {
    const folder = await this.findFolderById(id);

    const all = await this.prisma.folder.findMany({
      where: { collectionId: folder.collectionId },
      select: { id: true, parentId: true },
    });
    const ids = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of all) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
      }
    }

    const [, deleted] = await this.prisma.$transaction([
      this.prisma.request.deleteMany({ where: { folderId: { in: [...ids] } } }),
      this.prisma.folder.delete({ where: { id } }), // las subcarpetas caen en cascada
    ]);
    return deleted;
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

  async updateRequest(id: string, dto: UpdateRequestDto) {
    await this.findRequestById(id);

    const { headers, queryParams, body, auth, ...rest } = dto;
    const data: Prisma.RequestUncheckedUpdateInput = { ...rest };

    // Los campos Json de Prisma no aceptan null directo: se traduce a DbNull.
    const json = { headers, queryParams, body, auth };
    for (const [key, value] of Object.entries(json)) {
      if (value !== undefined) data[key] = value === null ? Prisma.DbNull : value;
    }

    return this.prisma.request.update({ where: { id }, data });
  }

  async deleteRequest(id: string) {
    await this.findRequestById(id);
    return this.prisma.request.delete({ where: { id } });
  }
}
