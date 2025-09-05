import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';

/**
 * Example controller demonstrating how to use JWT authentication
 * This file is for documentation purposes and shows the usage pattern
 */
@Controller('example')
export class ExampleProtectedController {
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@GetUser() user: any) {
    // The user object is automatically injected from the JWT payload
    // after successful authentication via JwtStrategy.validate()
    return {
      message: 'This is a protected endpoint',
      user: {
        id: user.id,
        steamId: user.steamId,
        username: user.username,
      },
    };
  }

  @Get('public')
  getPublicData() {
    // This endpoint is not protected and doesn't require authentication
    return {
      message: 'This is a public endpoint',
      data: 'Anyone can access this',
    };
  }
}