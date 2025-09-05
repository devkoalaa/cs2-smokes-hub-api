import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RatingsService } from './ratings.service';
import { RateSmokeDto } from '../common/dto/rate-smoke.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('ratings')
@Controller()
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

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
}