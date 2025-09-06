import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SmokesService } from './smokes.service';
import { CreateSmokeDto } from '../common/dto/create-smoke.dto';
import { SmokeResponseDto } from '../common/dto/smoke-response.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('smokes')
@Controller()
export class SmokesController {
  constructor(private readonly smokesService: SmokesService) {}

  /**
   * GET /maps/:mapId/smokes
   * Get all smokes for a specific map with calculated scores
   * Public endpoint - no authentication required
   */
  @Get('maps/:mapId/smokes')
  async getSmokesByMapId(
    @Param('mapId', ParseIntPipe) mapId: number,
  ): Promise<SmokeResponseDto[]> {
    return this.smokesService.findByMapId(mapId);
  }

  /**
   * POST /smokes
   * Create a new smoke strategy
   * Protected endpoint - requires JWT authentication
   */
  @Post('smokes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a new smoke strategy' })
  @ApiResponse({ status: 201, description: 'Smoke strategy created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  async createSmoke(
    @Body() createSmokeDto: CreateSmokeDto,
    @Request() req: { user: JwtPayload },
  ): Promise<SmokeResponseDto> {
    console.log('createSmokeDto', createSmokeDto);
    
    const authorId = req.user.sub;
    return this.smokesService.create(createSmokeDto, authorId);
  }

  /**
   * DELETE /smokes/:id
   * Delete a smoke strategy (only owner can delete)
   * Protected endpoint - requires JWT authentication
   */
  @Delete('smokes/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a smoke strategy' })
  @ApiResponse({ status: 204, description: 'Smoke strategy deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only the owner can delete the smoke strategy' })
  async deleteSmoke(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: JwtPayload },
  ): Promise<void> {
    const userId = req.user.sub;
    return this.smokesService.delete(id, userId);
  }
}