import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Initiates Steam authentication flow
   * Requirements: 1.1 - Redirect to Steam authentication page
   */
  @ApiOperation({
    summary: 'Initiate Steam authentication',
    description: 'Redirects user to Steam OpenID authentication page',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Steam authentication page',
  })

  @Get('steam')
  @UseGuards(AuthGuard('steam'))
  async steamAuth() {
    // This endpoint will redirect to Steam's authentication page
    // The actual redirect is handled by the Steam strategy
  }

  /**
   * Steam authentication callback endpoint
   * Requirements: 1.2, 1.3, 1.5 - Handle Steam callback, create/update user, generate JWT
   */
  @ApiOperation({
    summary: 'Steam authentication callback',
    description: 'Handles Steam OpenID callback and returns JWT token',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful, returns JWT token and user data',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Authentication successful' },
        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            steamId: { type: 'string', example: '76561198000000000' },
            username: { type: 'string', example: 'PlayerName' },
            avatarUrl: { type: 'string', example: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/...' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
  })
  @ApiExcludeEndpoint()
  @Get('steam/return')
  @UseGuards(AuthGuard('steam'))
  async steamAuthCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const user = req.user as any;
      
      if (!user) {
        throw new HttpException(
          'Authentication failed: No user data received from Steam',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Generate JWT token for the authenticated user
      const token = await this.authService.generateJwtToken(user);

      // Return JSON response instead of redirect
      const response = {
        message: 'Authentication successful',
        token,
        user: {
          id: user.id,
          steamId: user.steamId,
          username: user.username,
          avatarUrl: user.avatarUrl,
        },
      };

      res.json(response);
    } catch (error) {
      // If it's already an HttpException, re-throw it as is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // For other errors, wrap them
      throw new HttpException(
        'Authentication failed: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Protected endpoint to get current user profile
   * Requirements: 1.4 - Return user profile data for valid JWT
   */
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile data',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        steamId: { type: 'string', example: '76561198000000000' },
        username: { type: 'string', example: 'PlayerName' },
        avatarUrl: { type: 'string', example: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/...' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    const user = req.user as any;
    
    return {
      id: user.id,
      steamId: user.steamId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}