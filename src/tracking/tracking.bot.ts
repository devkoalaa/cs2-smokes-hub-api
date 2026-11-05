import { CanActivate, Controller, ExecutionContext, Get, Injectable, NotFoundException, Param, Query, ServiceUnavailableException,
  UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MatchPlayer, Prisma } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { allowedSteamIds, matchShareKey } from './tracking.crypto';
import { hubRating, summarize } from './tracking.metrics';

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

type Match = Prisma.TrackedMatchGetPayload<{ include: { players: true } }>;
type Analysis = { players?: Record<string, { kast?: number; clutch?: number; multi?: number; premierAfter?: number; premierDelta?: number }> } | null;
const round = (n: number | null, digits = 2) => n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits;
const mean = (values: (number | null)[]) => { const v = values.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

@Injectable()
export class TrackingBotService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}

  private ids() { return allowedSteamIds(this.config.get<string>('TRACKING_ALLOWED_STEAM_IDS')); }
  private member(steamId: string) {
    if (!this.ids().includes(steamId)) throw new NotFoundException('Jogador fora do grupo.');
  }
  private matches(steamId: string, days: number, take?: number): Promise<Match[]> {
    return this.db.trackedMatch.findMany({ where: { status: 'READY', players: { some: { steamId } },
      ...(days ? { playedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}) },
      include: { players: true }, orderBy: [{ playedAt: 'desc' }, { id: 'desc' }], take });
  }

  private row(match: Match, p: MatchPlayer) {
    const extra = (match.analysis as Analysis)?.players?.[p.steamId];
    return { steamId: p.steamId, name: p.name, kills: p.kills, deaths: p.deaths, assists: p.assists, damage: p.damage,
      adr: p.damage == null || !p.rounds ? null : Math.round(p.damage / p.rounds), hsPercent: p.headshots == null || !p.kills ? null : Math.round(100 * p.headshots / p.kills),
      kastPercent: extra?.kast == null || !p.rounds ? null : Math.round(100 * extra.kast / p.rounds), rating: round(hubRating(p, match.players)),
      clutches: extra?.clutch ?? null, multiKills: extra?.multi ?? null, premierAfter: extra?.premierAfter ?? null, premierDelta: extra?.premierDelta ?? null };
  }

  private card(match: Match, steamId: string) {
    const me = match.players.find(p => p.steamId === steamId)!;
    let shareKey: string | null = null;
    try { shareKey = matchShareKey(match.id, this.config.get<string>('TRACKING_ENCRYPTION_KEY')); } catch { /* sem link */ }
    const ids = this.ids();
    return { id: match.id, shareKey, map: match.map, mode: match.mode, playedAt: match.playedAt, rounds: match.rounds,
      scoreFor: me.scoreFor, scoreAgainst: me.scoreAgainst, player: this.row(match, me),
      teammates: match.players.filter(p => p.team === me.team && p.steamId !== steamId && ids.includes(p.steamId)).map(p => this.row(match, p)) };
  }

  private stats(matches: Match[], steamId: string) {
    const rows = matches.map(m => m.players.find(p => p.steamId === steamId)!);
    const ratings = matches.map(m => hubRating(m.players.find(p => p.steamId === steamId)!, m.players));
    return { ...summarize(rows), rating: round(mean(ratings)) };
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
    const maps = Object.entries(cards.reduce<Record<string, { matches: number; wins: number }>>((acc, c) => {
      const m = (acc[c.map ?? '?'] ??= { matches: 0, wins: 0 }); m.matches++; if (c.scoreFor > c.scoreAgainst) m.wins++; return acc;
    }, {})).map(([map, v]) => ({ map, ...v })).sort((a, b) => b.matches - a.matches || b.wins - a.wins);
    return { days, stats: this.stats(matches, steamId), best, maps };
  }

  async ranking(days: number) {
    const ids = this.ids();
    const users = await this.db.user.findMany({ where: { steamId: { in: ids } }, select: { steamId: true, username: true } });
    const members = await Promise.all(ids.map(async steamId => {
      const matches = await this.matches(steamId, days);
      if (!matches.length) return null;
      const name = users.find(u => u.steamId === steamId)?.username ?? matches[0].players.find(p => p.steamId === steamId)!.name;
      return { steamId, name, stats: this.stats(matches, steamId) };
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
