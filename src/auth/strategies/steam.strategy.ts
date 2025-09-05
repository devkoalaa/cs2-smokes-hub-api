import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-steam';
import { AuthService } from '../auth.service';

@Injectable()
export class SteamStrategy extends PassportStrategy(Strategy, 'steam') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      returnURL: configService.get<string>('STEAM_RETURN_URL') || 'http://localhost:3000/auth/steam/return',
      realm: configService.get<string>('STEAM_REALM') || 'http://localhost:3000',
      apiKey: configService.get<string>('STEAM_API_KEY'),
    });
  }

  async validate(
    identifier: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ): Promise<any> {
    try {
      const user = await this.authService.validateSteamUser(profile);
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
}