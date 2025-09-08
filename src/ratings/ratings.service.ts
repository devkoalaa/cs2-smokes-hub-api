import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RateSmokeDto } from '../common/dto/rate-smoke.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) { }

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

    // Verify the smoke exists and is not deleted
    const smokeExists = await this.prisma.smoke.findUnique({
      where: { id: smokeId },
      select: { id: true, deletedAt: true },
    });

    if (!smokeExists || smokeExists.deletedAt) {
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

  /**
   * Get all ratings by a specific user
   * Returns a map of smokeId -> rating value
   */
  async getUserRatings(userId: number): Promise<{ [smokeId: number]: number }> {
    const ratings = await this.prisma.rating.findMany({
      where: { userId },
      select: {
        smokeId: true,
        value: true,
      },
    });

    // Convert array to object map
    const ratingsMap: { [smokeId: number]: number } = {};
    ratings.forEach(rating => {
      ratingsMap[rating.smokeId] = rating.value;
    });

    return ratingsMap;
  }

  /**
   * Remove a rating by a specific user for a specific smoke
   */
  async removeRating(userId: number, smokeId: number): Promise<void> {
    // Verify the smoke exists and is not deleted
    const smokeExists = await this.prisma.smoke.findUnique({
      where: { id: smokeId },
      select: { id: true, deletedAt: true },
    });

    if (!smokeExists || smokeExists.deletedAt) {
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

    // Delete the rating
    await this.prisma.rating.deleteMany({
      where: {
        userId,
        smokeId,
      },
    });
  }
}