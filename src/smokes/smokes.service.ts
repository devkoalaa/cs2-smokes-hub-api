import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSmokeDto } from '../common/dto/create-smoke.dto';
import { SmokeResponseDto } from '../common/dto/smoke-response.dto';

@Injectable()
export class SmokesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all smokes for a specific map with calculated rating scores
   * Includes author and map data with proper joins
   */
  async findByMapId(mapId: number): Promise<SmokeResponseDto[]> {
    // First verify the map exists
    const mapExists = await this.prisma.map.findUnique({
      where: { id: mapId },
    });

    if (!mapExists) {
      throw new NotFoundException(`Map with ID ${mapId} not found`);
    }

    // Get smokes with calculated scores using raw query for better performance
    const smokesWithScores = await this.prisma.$queryRaw<
      Array<{
        id: number;
        title: string;
        videoUrl: string;
        timestamp: number;
        x_coord: number;
        y_coord: number;
        createdAt: Date;
        updatedAt: Date;
        authorId: number;
        mapId: number;
        score: bigint;
      }>
    >`
      SELECT 
        s.id,
        s.title,
        s."videoUrl",
        s.timestamp,
        s.x_coord,
        s.y_coord,
        s."createdAt",
        s."updatedAt",
        s."authorId",
        s."mapId",
        COALESCE(SUM(r.value), 0) as score
      FROM smokes s
      LEFT JOIN ratings r ON s.id = r."smokeId"
      WHERE s."mapId" = ${mapId} AND s."deletedAt" IS NULL
      GROUP BY s.id
      ORDER BY score DESC, s."createdAt" DESC
    `;

    // Get author and map data for each smoke
    const smokesWithDetails = await Promise.all(
      smokesWithScores.map(async (smoke) => {
        const [author, map] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: smoke.authorId },
            select: {
              id: true,
              steamId: true,
              username: true,
              avatarUrl: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          this.prisma.map.findUnique({
            where: { id: smoke.mapId },
            select: {
              id: true,
              name: true,
              thumbnail: true,
            },
          }),
        ]);

        return {
          id: smoke.id,
          title: smoke.title,
          videoUrl: smoke.videoUrl,
          timestamp: smoke.timestamp,
          x_coord: smoke.x_coord,
          y_coord: smoke.y_coord,
          score: Number(smoke.score), // Convert BigInt to number
          createdAt: smoke.createdAt,
          updatedAt: smoke.updatedAt,
          author: {
            id: author.id,
            steamId: author.steamId,
            displayName: author.username, // Map username to displayName
            avatarUrl: author.avatarUrl,
            createdAt: author.createdAt,
            updatedAt: author.updatedAt,
          },
          map,
        } as SmokeResponseDto;
      }),
    );

    return smokesWithDetails;
  }

  /**
   * Create a new smoke with authorId assignment from JWT payload
   */
  async create(createSmokeDto: CreateSmokeDto, authorId: number): Promise<SmokeResponseDto> {
    // Verify the map exists
    const mapExists = await this.prisma.map.findUnique({
      where: { id: createSmokeDto.mapId },
    });

    if (!mapExists) {
      throw new NotFoundException(`Map with ID ${createSmokeDto.mapId} not found`);
    }

    // Create the smoke
    const smoke = await this.prisma.smoke.create({
      data: {
        title: createSmokeDto.title,
        videoUrl: createSmokeDto.videoUrl,
        timestamp: createSmokeDto.timestamp,
        x_coord: createSmokeDto.x_coord,
        y_coord: createSmokeDto.y_coord,
        authorId,
        mapId: createSmokeDto.mapId,
      },
      include: {
        author: {
          select: {
            id: true,
            steamId: true,
            username: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        map: {
          select: {
            id: true,
            name: true,
            thumbnail: true,
          },
        },
      },
    });

    return {
      id: smoke.id,
      title: smoke.title,
      videoUrl: smoke.videoUrl,
      timestamp: smoke.timestamp,
      x_coord: smoke.x_coord,
      y_coord: smoke.y_coord,
      score: 0, // New smoke has no ratings yet
      createdAt: smoke.createdAt,
      updatedAt: smoke.updatedAt,
      author: {
        id: smoke.authorId,
        steamId: smoke.author.steamId,
        displayName: smoke.author.username, // Map username to displayName
        avatarUrl: smoke.author.avatarUrl,
        createdAt: smoke.author.createdAt,
        updatedAt: smoke.author.updatedAt,
      },
      map: smoke.map,
    };
  }

  /**
   * Soft delete a smoke with ownership validation
   * User can only delete their own smokes
   */
  async delete(id: number, userId: number): Promise<void> {
    // First check if the smoke exists and get its author
    const smoke = await this.prisma.smoke.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
      },
    });

    if (!smoke) {
      throw new NotFoundException(`Smoke with ID ${id} not found`);
    }

    if (smoke.deletedAt) {
      throw new NotFoundException(`Smoke with ID ${id} already deleted`);
    }

    // Check ownership
    if (smoke.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own smokes');
    }

    // Soft delete the smoke by setting deletedAt
    await this.prisma.smoke.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}