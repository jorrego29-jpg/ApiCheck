// src/history/history.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista las ejecuciones más recientes. No incluye cuerpo ni headers de la respuesta
   * (pueden ser pesados): para eso está findOne().
   */
  findAll(requestId?: string, limit?: number) {
    const take = Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    return this.prisma.historyLog.findMany({
      where: requestId ? { requestId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        requestId: true,
        executedUrl: true,
        method: true,
        status: true,
        statusText: true,
        durationMs: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const log = await this.prisma.historyLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Registro de historial ${id} no encontrado.`);
    return log;
  }
}
