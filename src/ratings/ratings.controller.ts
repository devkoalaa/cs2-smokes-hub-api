import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RateSmokeDto } from '../common/dto/rate-smoke.dto';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) { }

  /**
   * GET /ratings/user
   * Get all ratings by the authenticated user
   * Protected endpoint - requires JWT authentication
   */
  @Get('ratings/user')
  @UseGuards(JwtAuthGuard)
  async getUserRatings(
    @Request() req: { user: JwtPayload },
  ): Promise<{ [smokeId: number]: number }> {
    const userId = req.user.sub;

    const ratings = await this.ratingsService.getUserRatings(userId);

    return ratings;
  }

  /**
   * POST /smokes/:smokeId/rate
   * Rate a smoke strategy (upvote or downvote)
   * Protected endpoint - requires JWT authentication
   */
  @Post('smokes/:smokeId/rate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async rateSmoke(
    @Param('smokeId', ParseIntPipe) smokeId: number,
    @Body() rateSmokeDto: RateSmokeDto,
    @Request() req: { user: JwtPayload },
  ): Promise<{ message: string }> {
    const userId = req.user.sub;

    await this.ratingsService.upsertRating(userId, smokeId, rateSmokeDto);

    return { message: 'Rating submitted successfully' };
  }

  /**
   * DELETE /smokes/:smokeId/rate
   * Remove rating for a smoke strategy
   * Protected endpoint - requires JWT authentication
   */
  @Delete('smokes/:smokeId/rate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async removeRating(
    @Param('smokeId', ParseIntPipe) smokeId: number,
    @Request() req: { user: JwtPayload },
  ): Promise<{ message: string }> {
    const userId = req.user.sub;

    await this.ratingsService.removeRating(userId, smokeId);

    return { message: 'Rating removed successfully' };
  }
}