import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { refreshSteamProfiles } from '../common/steam-profiles';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Ao abrir o app: se nome e foto não vêm da Steam há mais de 30 minutos, busca de novo.
   * Falha da Steam não atrapalha: segue com o que já está salvo.
   */
  async syncSteamProfile<T extends { id: number; steamId: string; steamSyncedAt?: Date | null }>(user: T): Promise<T> {
    if (user.steamSyncedAt && Date.now() - new Date(user.steamSyncedAt).getTime() < 30 * 60_000) return user;
    try {
      await refreshSteamProfiles(this.prismaService, process.env.STEAM_API_KEY, [user.steamId]);
      return { ...user, ...(await this.prismaService.user.findUnique({ where: { id: user.id } })) };
    } catch {
      return user;
    }
  }

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
          steamSyncedAt: new Date(),
        },
      });
    } else {
      // Create new user
      user = await this.prismaService.user.create({
        data: {
          steamId,
          username,
          avatarUrl,
          steamSyncedAt: new Date(),
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