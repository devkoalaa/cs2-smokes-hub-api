import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RateSmokeDto } from '../common/dto/rate-smoke.dto';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update a rating using Prisma upsert operation
   * Handles rating updates (change existing vote) automatically
   */
  async upsertRating(userId: number, smokeId: number, rateSmokeDto: RateSmokeDto): Promise<void> {
    const { value } = rateSmokeDto;

    // Validate rating value (additional validation beyond DTO)
    if (value !== 1 && value !== -1) {
      throw new BadRequestException('Rating value must be either 1 or -1');
    }

    // Verify the smoke exists
    const smokeExists = await this.prisma.smoke.findUnique({
      where: { id: smokeId },
      select: { id: true },
    });

    if (!smokeExists) {
      throw new NotFoundException(`Smoke with ID ${smokeId} not found`);
    }

    // Verify the user exists
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Use Prisma upsert to create or update the rating
    // This handles the unique constraint on (userId, smokeId)
    await this.prisma.rating.upsert({
      where: {
        userId_smokeId: {
          userId,
          smokeId,
        },
      },
      update: {
        value,
      },
      create: {
        userId,
        smokeId,
        value,
      },
    });
  }
}