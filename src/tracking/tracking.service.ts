import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { allowedSteamIds, encryptAuthCode, matchShareKey, trackingKey, validShareKey } from './tracking.crypto';
import { ConfigureTrackingDto, MatchQueryDto } from './tracking.dto';
import { summarize } from './tracking.metrics';

@Injectable()
export class TrackingService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}

  private shareKey(id: number) {
    try { return matchShareKey(id, this.config.get<string>('TRACKING_ENCRYPTION_KEY')); } catch { return null; }
  }
  private ids() { return allowedSteamIds(this.config.get<string>('TRACKING_ALLOWED_STEAM_IDS')); }
  assertAccess(steamId: string) {
    const ids = this.ids();
    if (!ids.length) throw new ServiceUnavailableException('A área de partidas aguarda a configuração dos SteamIDs do grupo.');
    if (!ids.includes(steamId)) throw new ForbiddenException('A área de partidas é privada para o grupo configurado.');
  }

  async status(userId: number, steamId: string) {
    this.assertAccess(steamId);
    const [tracking, worker, queue] = await Promise.all([
      this.db.matchTracking.findUnique({ where: { userId }, select: { enabled: true, lastCheckedAt: true, lastError: true } }),
      this.db.trackingWorker.findUnique({ where: { id: 'collector' } }),
      this.db.trackedMatch.findMany({ where: { requests: { some: { userId } }, status: { not: 'READY' } },
        select: { id: true, status: true, lastError: true, attempts: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    let configured = true;
    try { trackingKey(this.config.get<string>('TRACKING_ENCRYPTION_KEY')); } catch { configured = false; }
    return { tracking, workerOnline: !!worker && Date.now() - worker.heartbeatAt.getTime() < 120000,
      workerLastSeen: worker?.heartbeatAt ?? null, serverConfigured: configured, queue };
  }

  async configure(userId: number, steamId: string, dto: ConfigureTrackingDto) {
    this.assertAccess(steamId);
    let authCodeEncrypted: string;
    try { authCodeEncrypted = encryptAuthCode(dto.authCode, this.config.get<string>('TRACKING_ENCRYPTION_KEY'), userId); }
    catch { throw new ServiceUnavailableException('A chave de proteção do rastreamento ainda não foi configurada no servidor.'); }
    const data = { authCodeEncrypted, lastShareCode: dto.shareCode, seedPending: true, enabled: true, lastError: null, nextPollAt: new Date() };
    await this.db.matchTracking.upsert({ where: { userId }, create: { userId, ...data }, update: { ...data, revision: { increment: 1 } } });
    return { message: 'Rastreamento salvo. O coletor verificará o acesso e a partida inicial.' };
  }

  async disconnect(userId: number, steamId: string) {
    this.assertAccess(steamId);
    await this.db.matchTracking.deleteMany({ where: { userId } });
    return { message: 'Acesso ao histórico removido. As partidas já processadas foram mantidas.' };
  }

  private where(steamId: string, query: MatchQueryDto): Prisma.TrackedMatchWhereInput {
    return { status: 'READY', players: { some: { steamId } },
      ...(query.days ? { playedAt: { gte: new Date(Date.now() - query.days * 86400000) } } : {}),
      ...(query.mode && query.mode !== 'all' ? { mode: query.mode } : {}),
      ...(query.map ? { map: query.map } : {}),
      ...(query.scope === 'together' ? { OR: [0, 1].map(team => ({ AND: this.ids().map(id => ({ players: { some: { steamId: id, team } } })) })) } : {}),
    };
  }

  async dashboard(userId: number, steamId: string, query: MatchQueryDto) {
    this.assertAccess(steamId);
    const where = this.where(steamId, query);
    const [total, matches, rows, maps, members] = await Promise.all([
      this.db.trackedMatch.count({ where }),
      this.db.trackedMatch.findMany({ where, orderBy: [{ playedAt: 'desc' }, { id: 'desc' }], take: 20, skip: (query.page - 1) * 20,
        select: { id: true, mode: true, map: true, playedAt: true, players: { where: { steamId } } } }),
      this.db.matchPlayer.findMany({ where: { steamId, match: where }, include: { match: { select: { playedAt: true } } }, orderBy: { match: { playedAt: 'asc' } } }),
      this.db.trackedMatch.findMany({ where: { status: 'READY', players: { some: { steamId } } }, distinct: ['map'], select: { map: true } }),
      this.db.user.findMany({ where: { steamId: { in: this.ids() }, tracking: { enabled: true } }, select: { steamId: true, username: true } }),
    ]);
    const comparison = await Promise.all(members.map(async member => ({ ...member,
      stats: summarize(await this.db.matchPlayer.findMany({ where: { steamId: member.steamId, match: this.where(member.steamId, query) } })) })));
    return { summary: summarize(rows), comparison, maps: maps.map(m => m.map).filter(Boolean).sort(), total, page: query.page,
      evolution: rows.slice(-30).map(row => ({ id: row.matchId, playedAt: row.match.playedAt, adr: row.damage === null || !row.rounds ? null : Math.round(row.damage / row.rounds * 100) / 100 })),
      matches: matches.map(({ players, ...match }) => ({ ...match, shareKey: this.shareKey(match.id), player: players[0] })) };
  }

  async detail(steamId: string, id: number) {
    this.assertAccess(steamId);
    const match = await this.db.trackedMatch.findFirst({ where: { id, status: 'READY', players: { some: { steamId } } },
      select: { id: true, mode: true, map: true, playedAt: true, rounds: true, analysis: true, players: { orderBy: [{ team: 'asc' }, { kills: 'desc' }] } } });
    if (!match) throw new NotFoundException('Partida não encontrada no seu histórico.');
    return { ...match, shareKey: this.shareKey(match.id) };
  }

  // Resumo público para a miniatura do link: só o placar e os números do grupo.
  async preview(id: number, key: string) {
    let valid = false;
    try { valid = validShareKey(id, key, this.config.get<string>('TRACKING_ENCRYPTION_KEY')); } catch { valid = false; }
    const match = valid && await this.db.trackedMatch.findFirst({ where: { id, status: 'READY' },
      select: { id: true, mode: true, map: true, playedAt: true, rounds: true, players: { orderBy: [{ team: 'asc' }, { kills: 'desc' }] } } });
    if (!match) throw new NotFoundException('Partida não encontrada.');
    const ids = this.ids();
    const score = [0, 1].map(team => match.players.find(p => p.team === team)?.scoreFor ?? 0);
    return { id: match.id, mode: match.mode, map: match.map, playedAt: match.playedAt, rounds: match.rounds, score,
      group: match.players.filter(p => ids.includes(p.steamId)).map(p => ({ name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, assists: p.assists,
        adr: p.damage == null || !p.rounds ? null : Math.round(p.damage / p.rounds), hsPercent: p.headshots == null || !p.kills ? null : Math.round(p.headshots / p.kills * 100) })) };
  }
}
