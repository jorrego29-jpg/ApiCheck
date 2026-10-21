// src/environments/environments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnvironmentDto, CreateVariableDto } from './dto/create-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnvironmentDto) {
    return this.prisma.environment.create({
      data: {
        name: dto.name,
        workspaceId: dto.workspaceId,
        isGlobal: dto.isGlobal || false,
        variables: {
          create: dto.variables || [],
        },
      },
      include: { variables: true },
    });
  }

  async findAllByWorkspace(workspaceId: string) {
    return this.prisma.environment.findMany({
      where: { workspaceId },
      include: { variables: true },
    });
  }

  async findOne(id: string) {
    const env = await this.prisma.environment.findUnique({
      where: { id },
      include: { variables: true },
    });
    if (!env) throw new NotFoundException(`Entorno con ID ${id} no encontrado.`);
    return env;
  }

  /**
   * Obtiene un mapa de variables clave-valor filtrando solo las habilitadas.
   */
  async getActiveVariablesMap(environmentId?: string, workspaceId?: string): Promise<Record<string, string>> {
    const variablesMap: Record<string, string> = {};

    // 1. Cargar variables globales del workspace (si existe)
    if (workspaceId) {
      const globalEnvs = await this.prisma.environment.findMany({
        where: { workspaceId, isGlobal: true },
        include: { variables: { where: { enabled: true } } },
      });
      for (const env of globalEnvs) {
        for (const v of env.variables) {
          variablesMap[v.key] = v.value;
        }
      }
    }

    // 2. Cargar variables del entorno activo (sobrescriben las globales)
    if (environmentId) {
      const activeEnv = await this.prisma.environment.findUnique({
        where: { id: environmentId },
        include: { variables: { where: { enabled: true } } },
      });
      if (activeEnv) {
        for (const v of activeEnv.variables) {
          variablesMap[v.key] = v.value;
        }
      }
    }

    return variablesMap;
  }

  async addVariable(environmentId: string, dto: CreateVariableDto) {
    await this.findOne(environmentId); // Validar existencia
    return this.prisma.variable.create({
      data: {
        key: dto.key,
        value: dto.value,
        enabled: dto.enabled ?? true,
        environmentId,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.environment.delete({ where: { id } });
  }
}