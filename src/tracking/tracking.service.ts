import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, randomCode } from './tracking.access';
import { encryptAuthCode, trackingKey, validShareKey } from './tracking.crypto';
import { ConfigureTrackingDto, MatchQueryDto, PreferencesDto } from './tracking.dto';
import { summarize } from './tracking.metrics';

type Viewer = Pick<User, 'id' | 'steamId' | 'accessGrantedAt'>;

@Injectable()
export class TrackingService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService, private readonly access: AccessService) {}

  async status(user: Viewer) {
    const [granted, seats, me, groups] = await Promise.all([this.access.hasAccess(user), this.access.seats(),
      this.db.user.findUnique({ where: { id: user.id }, select: { allowPreview: true } }),
      this.db.groupMember.findMany({ where: { userId: user.id }, orderBy: { joinedAt: 'asc' },
        select: { group: { select: { id: true, name: true, ownerId: true, _count: { select: { members: true } } } } } })]);
    const base = { access: granted, admin: this.access.isAdmin(user), seats, allowPreview: me?.allowPreview ?? true,
      groups: groups.map(({ group }) => ({ id: group.id, name: group.name, owner: group.ownerId === user.id, members: group._count.members })) };
    if (!granted) return { ...base, tracking: null, workerOnline: false, workerLastSeen: null, serverConfigured: false, queue: [] };
    const [tracking, worker, queue] = await Promise.all([
      this.db.matchTracking.findUnique({ where: { userId: user.id }, select: { enabled: true, lastCheckedAt: true, lastError: true } }),
      this.db.trackingWorker.findUnique({ where: { id: 'collector' } }),
      this.db.trackedMatch.findMany({ where: { requests: { some: { userId: user.id } }, status: { not: 'READY' } },
        select: { id: true, status: true, lastError: true, attempts: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    let configured = true;
    try { trackingKey(this.config.get<string>('TRACKING_ENCRYPTION_KEY')); } catch { configured = false; }
    return { ...base, tracking, workerOnline: !!worker && Date.now() - worker.heartbeatAt.getTime() < 120000,
      workerLastSeen: worker?.heartbeatAt ?? null, serverConfigured: configured, queue };
  }

  async configure(user: Viewer, dto: ConfigureTrackingDto) {
    await this.access.assertAccess(user);
    let authCodeEncrypted: string;
    try { authCodeEncrypted = encryptAuthCode(dto.authCode, this.config.get<string>('TRACKING_ENCRYPTION_KEY'), user.id); }
    catch { throw new ServiceUnavailableException('A chave de proteção do rastreamento ainda não foi configurada no servidor.'); }
    const data = { authCodeEncrypted, lastShareCode: dto.shareCode, seedPending: true, enabled: true, lastError: null, nextPollAt: new Date() };
    await this.db.matchTracking.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: { ...data, revision: { increment: 1 } } });
    return { message: 'Importação salva. As partidas novas vão aparecer depois que o coletor processar cada demo.' };
  }

  async disconnect(user: Viewer) {
    await this.access.assertAccess(user);
    await this.db.matchTracking.deleteMany({ where: { userId: user.id } });
    return { message: 'Importação automática desligada. As partidas já importadas continuam no histórico.' };
  }

  async preferences(user: Viewer, dto: PreferencesDto) {
    await this.db.user.update({ where: { id: user.id }, data: { allowPreview: dto.allowPreview } });
    return { allowPreview: dto.allowPreview };
  }

  /**
   * "Excluir meus dados": desliga a importação, sai dos grupos (apaga os que a pessoa criou),
   * apaga links e convites dela, libera a vaga e remove as partidas que só ela tinha importado
   * e em que nenhum outro usuário com acesso jogou. Os números dela continuam no placar das
   * partidas de quem jogou junto, como no placar do próprio jogo.
   */
  async deleteMine(user: Viewer) {
    const requested = await this.db.matchRequest.findMany({ where: { userId: user.id }, select: { matchId: true } });
    await this.db.$transaction(async tx => {
      await tx.matchTracking.deleteMany({ where: { userId: user.id } });
      await tx.matchRequest.deleteMany({ where: { userId: user.id } });
      await tx.matchShare.deleteMany({ where: { userId: user.id } });
      await tx.group.deleteMany({ where: { ownerId: user.id } });
      await tx.groupMember.deleteMany({ where: { userId: user.id } });
      await tx.invite.deleteMany({ where: { createdById: user.id } });
      await tx.user.update({ where: { id: user.id }, data: { accessGrantedAt: null, allowPreview: true } });
      const others = await tx.user.findMany({ where: { accessGrantedAt: { not: null } }, select: { steamId: true } });
      await tx.trackedMatch.deleteMany({ where: { id: { in: requested.map(r => r.matchId) }, requests: { none: {} },
        players: { none: { steamId: { in: others.map(o => o.steamId) } } } } });
    });
    return { message: 'Pronto. Seus dados do CS2 Hub foram apagados e a sua vaga foi liberada.' };
  }

  private where(steamId: string, query: MatchQueryDto, groupIds: string[] = []): Prisma.TrackedMatchWhereInput {
    const others = groupIds.filter(id => id !== steamId);
    return { status: 'READY', players: { some: { steamId } },
      ...(query.days ? { playedAt: { gte: new Date(Date.now() - query.days * 86400000) } } : {}),
      ...(query.mode && query.mode !== 'all' ? { mode: query.mode } : {}),
      ...(query.map ? { map: query.map } : {}),
      // "Com o grupo no mesmo time": pelo menos mais alguém do grupo do meu lado.
      ...(query.scope === 'together' ? { OR: [0, 1].map(team => ({ AND: [{ players: { some: { steamId, team } } }, { players: { some: { steamId: { in: others }, team } } }] })) } : {}),
    };
  }

  private async groupSteamIds(user: Viewer, groupId?: number) {
    if (!groupId) return [];
    await this.access.membership(user.id, groupId);
    const members = await this.db.groupMember.findMany({ where: { groupId }, select: { user: { select: { steamId: true, username: true, accessGrantedAt: true } } } });
    return members.map(m => m.user);
  }

  async dashboard(user: Viewer, query: MatchQueryDto) {
    await this.access.assertAccess(user);
    const steamId = user.steamId;
    const members = await this.groupSteamIds(user, query.group);
    const ids = members.map(m => m.steamId);
    const where = this.where(steamId, query, ids);
    const [total, matches, rows, maps] = await Promise.all([
      this.db.trackedMatch.count({ where }),
      this.db.trackedMatch.findMany({ where, orderBy: [{ playedAt: 'desc' }, { id: 'desc' }], take: 20, skip: (query.page - 1) * 20,
        select: { id: true, mode: true, map: true, playedAt: true, players: { where: { steamId } } } }),
      this.db.matchPlayer.findMany({ where: { steamId, match: where }, include: { match: { select: { playedAt: true } } }, orderBy: { match: { playedAt: 'asc' } } }),
      this.db.trackedMatch.findMany({ where: { status: 'READY', players: { some: { steamId } } }, distinct: ['map'], select: { map: true } }),
    ]);
    const comparison = (await Promise.all(members.filter(m => m.accessGrantedAt || m.steamId === steamId).map(async member => ({ steamId: member.steamId, username: member.username,
      stats: summarize(await this.db.matchPlayer.findMany({ where: { steamId: member.steamId, match: this.where(member.steamId, query, ids) } })) }))))
      .filter(m => m.stats.matches > 0);
    return { summary: summarize(rows), comparison, maps: maps.map(m => m.map).filter(Boolean).sort(), total, page: query.page,
      evolution: rows.slice(-30).map(row => ({ id: row.matchId, playedAt: row.match.playedAt, adr: row.damage === null || !row.rounds ? null : Math.round(row.damage / row.rounds * 100) / 100 })),
      matches: matches.map(({ players, ...match }) => ({ ...match, shareKey: null, player: players[0] })) };
  }

  /** Código do link compartilhado desta pessoa para esta partida (criado na primeira vez). */
  private async shareCode(matchId: number, userId: number) {
    const existing = await this.db.matchShare.findUnique({ where: { matchId_userId: { matchId, userId } } });
    if (existing) return existing.code;
    try { return (await this.db.matchShare.create({ data: { code: randomCode(10), matchId, userId } })).code; }
    catch { return (await this.db.matchShare.findUnique({ where: { matchId_userId: { matchId, userId } } }))?.code ?? null; }
  }

  async detail(user: Viewer, id: number) {
    await this.access.assertAccess(user);
    const match = await this.db.trackedMatch.findFirst({ where: { id, status: 'READY', players: { some: { steamId: user.steamId } } },
      select: { id: true, mode: true, map: true, playedAt: true, rounds: true, analysis: true, players: { orderBy: [{ team: 'asc' }, { kills: 'desc' }] } } });
    if (!match) throw new NotFoundException('Partida não encontrada no seu histórico.');
    return { ...match, shareKey: await this.shareCode(match.id, user.id) };
  }

  // Resumo público para a miniatura do link. Mostra quem compartilhou e quem divide grupo
  // com essa pessoa, se tiver deixado aparecer. Links antigos (chave HMAC) mostram os fundadores.
  async preview(id: number, key: string) {
    let visible: string[] | null = null;
    try { if (validShareKey(id, key, this.config.get<string>('TRACKING_ENCRYPTION_KEY'))) visible = this.access.founders(); } catch { /* sem chave */ }
    if (!visible && /^[A-Za-z0-9]{10}$/.test(key || '')) {
      const share = await this.db.matchShare.findFirst({ where: { code: key, matchId: id }, include: { user: true } });
      if (share) visible = await this.access.circle(share.userId).then(ids => [...new Set([share.user.steamId, ...ids])]);
    }
    const match = visible && await this.db.trackedMatch.findFirst({ where: { id, status: 'READY' },
      select: { id: true, mode: true, map: true, playedAt: true, rounds: true, players: { orderBy: [{ team: 'asc' }, { kills: 'desc' }] } } });
    if (!match || !visible) throw new NotFoundException('Partida não encontrada.');
    const allowed = new Set((await this.db.user.findMany({ where: { steamId: { in: visible }, allowPreview: true }, select: { steamId: true } })).map(u => u.steamId));
    const score = [0, 1].map(team => match.players.find(p => p.team === team)?.scoreFor ?? 0);
    return { id: match.id, mode: match.mode, map: match.map, playedAt: match.playedAt, rounds: match.rounds, score,
      group: match.players.filter(p => allowed.has(p.steamId)).map(p => ({ name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, assists: p.assists,
        adr: p.damage == null || !p.rounds ? null : Math.round(p.damage / p.rounds), hsPercent: p.headshots == null || !p.kills ? null : Math.round(p.headshots / p.kills * 100) })) };
  }
}
