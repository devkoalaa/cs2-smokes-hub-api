import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MapsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.map.findMany({
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
    });
  }

  async findById(id: number) {
    const map = await this.prisma.map.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        imageUrl: true,
      },
    });

    if (!map) {
      throw new NotFoundException(`Map with ID ${id} not found`);
    }

    return map;
  }
}