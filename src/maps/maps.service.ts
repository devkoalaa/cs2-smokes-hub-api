import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MapResponseDto } from '../common/dto/map-response.dto';

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<MapResponseDto[]> {
    const maps = await this.prisma.map.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail: true,
        radar: true,
        _count: { select: { smokes: true } },
      },
    });

    return maps.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      thumbnail: m.thumbnail,
      radar: m.radar,
      smokesCount: m._count?.smokes ?? 0,
    }));
  }

  async findById(id: number): Promise<MapResponseDto> {
    const map = await this.prisma.map.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail: true,
        radar: true,
        _count: { select: { smokes: true } },
      },
    });

    if (!map) {
      throw new NotFoundException(`Map with ID ${id} not found`);
    }

    return {
      id: map.id,
      name: map.name,
      description: map.description,
      thumbnail: map.thumbnail,
      radar: map.radar,
      smokesCount: map._count?.smokes ?? 0,
    };
  }
}