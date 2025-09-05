import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validates Steam user profile and creates/updates user in database
   * Requirements: 1.2, 1.5
   */
  async validateSteamUser(profile: any) {
    const steamId = profile.id;
    const username = profile.displayName || profile.username;
    const avatarUrl = profile.photos?.[2]?.value || profile.photos?.[1]?.value || profile.photos?.[0]?.value;

    // Check if user already exists
    let user = await this.prismaService.user.findUnique({
      where: { steamId },
    });

    if (user) {
      // Update existing user profile information
      user = await this.prismaService.user.update({
        where: { steamId },
        data: {
          username,
          avatarUrl,
        },
      });
    } else {
      // Create new user
      user = await this.prismaService.user.create({
        data: {
          steamId,
          username,
          avatarUrl,
        },
      });
    }

    return user;
  }

  /**
   * Generates JWT token containing user information
   * Requirements: 1.3
   */
  async generateJwtToken(user: { id: number; steamId: string; username: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      steamId: user.steamId,
      username: user.username,
    };

    return this.jwtService.sign(payload);
  }
}