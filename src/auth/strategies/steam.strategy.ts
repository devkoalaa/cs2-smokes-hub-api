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
    const returnURL = configService.get<string>('STEAM_RETURN_URL');
    const realm = configService.get<string>('STEAM_REALM');
    const apiKey = configService.get<string>('STEAM_API_KEY');
    
    super({
      returnURL,
      realm,
      apiKey,
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