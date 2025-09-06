import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MapResponseDto } from '../common/dto/map-response.dto';

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<MapResponseDto[]> {
    return this.prisma.map.findMany({
      select: {
        id: true,
        name: true,
        thumbnail: true,
        radar: true,
      },
    });
  }

  async findById(id: number): Promise<MapResponseDto> {
    const map = await this.prisma.map.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        radar: true,
      },
    });

    if (!map) {
      throw new NotFoundException(`Map with ID ${id} not found`);
    }

    return map;
  }
}