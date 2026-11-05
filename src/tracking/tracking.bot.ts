import { CanActivate, Controller, ExecutionContext, Get, Injectable, NotFoundException, Param, Query, ServiceUnavailableException,
  UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { allowedSteamIds, matchShareKey } from './tracking.crypto';
import { mapBreakdown, Match, matchCard, periodStats, periodWhere } from './tracking.stats';

// Rotas de leitura para o Clodoaldo (bot do Discord). Ele não tem login Steam:
// autentica com CS2_BOT_TOKEN e só enxerga partidas e números de quem é do grupo.

@Injectable()
export class BotTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext) {
    const expected = this.config.get<string>('CS2_BOT_TOKEN') || '';
    if (expected.length < 32) throw new ServiceUnavailableException('Integração com o bot não configurada.');
    const header: string = context.switchToHttp().getRequest().headers.authorization || '';
    const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (given.length !== expected.length || !timingSafeEqual(given, Buffer.from(expected))) throw new UnauthorizedException();
    return true;
  }
}

export class BotPeriodDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 7, 30, 90])
  days: number = 30;
}
export class BotMatchesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  limit: number = 5;
}

@Injectable()
export class TrackingBotService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}

  private ids() { return allowedSteamIds(this.config.get<string>('TRACKING_ALLOWED_STEAM_IDS')); }
  private member(steamId: string) {
    if (!this.ids().includes(steamId)) throw new NotFoundException('Jogador fora do grupo.');
  }
  private matches(steamId: string, days: number, take?: number): Promise<Match[]> {
    return this.db.trackedMatch.findMany({ where: periodWhere(steamId, days), include: { players: true }, orderBy: [{ playedAt: 'desc' }, { id: 'desc' }], take });
  }

  // Link no formato antigo (chave HMAC): a miniatura mostra os fundadores, que são o grupo do Clodoaldo.
  private card(match: Match, steamId: string) {
    let shareKey: string | null = null;
    try { shareKey = matchShareKey(match.id, this.config.get<string>('TRACKING_ENCRYPTION_KEY')); } catch { /* sem link */ }
    return { ...matchCard(match, steamId, this.ids()), shareKey };
  }

  async recent(steamId: string, limit: number) {
    this.member(steamId);
    return (await this.matches(steamId, 0, limit)).map(m => this.card(m, steamId));
  }

  async summary(steamId: string, days: number) {
    this.member(steamId);
    const matches = await this.matches(steamId, days);
    const cards = matches.map(m => this.card(m, steamId));
    const best = cards.filter(c => c.player.rating != null).sort((a, b) => b.player.rating! - a.player.rating!)[0] ?? null;
    return { days, stats: periodStats(matches, steamId), best, maps: mapBreakdown(cards) };
  }

  async ranking(days: number) {
    const ids = this.ids();
    const users = await this.db.user.findMany({ where: { steamId: { in: ids } }, select: { steamId: true, username: true } });
    const members = await Promise.all(ids.map(async steamId => {
      const matches = await this.matches(steamId, days);
      if (!matches.length) return null;
      const name = users.find(u => u.steamId === steamId)?.username ?? matches[0].players.find(p => p.steamId === steamId)!.name;
      return { steamId, name, stats: periodStats(matches, steamId) };
    }));
    return { days, members: members.filter(Boolean) };
  }
}

@ApiExcludeController()
@UseGuards(BotTokenGuard)
@Controller('tracking/bot')
export class TrackingBotController {
  constructor(private readonly service: TrackingBotService) {}
  @Get('players/:steamId/matches') recent(@Param('steamId') steamId: string, @Query() query: BotMatchesDto) { return this.service.recent(steamId, query.limit); }
  @Get('players/:steamId/stats') summary(@Param('steamId') steamId: string, @Query() query: BotPeriodDto) { return this.service.summary(steamId, query.days); }
  @Get('ranking') ranking(@Query() query: BotPeriodDto) { return this.service.ranking(query.days); }
}
