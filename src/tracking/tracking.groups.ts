import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Injectable, NotFoundException, Param, ParseIntPipe,
  Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, LIMITS, randomCode } from './tracking.access';
import { AccessInviteDto, GroupNameDto, PeriodDto } from './tracking.dto';
import { mapBreakdown, Match, matchCard, periodStats, periodWhere } from './tracking.stats';

type Viewer = Pick<User, 'id' | 'steamId' | 'accessGrantedAt'>;
const publicUser = { id: true, steamId: true, username: true, avatarUrl: true } as const;

@Injectable()
export class GroupsService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService) {}

  private async owned(user: Viewer, groupId: number) {
    const member = await this.access.membership(user.id, groupId);
    if (member.group.ownerId !== user.id) throw new ForbiddenException('Só quem criou o grupo pode fazer isso.');
    return member.group;
  }

  private newInvite(groupId: number, createdById: number) {
    return this.db.invite.create({ data: { code: randomCode(12), kind: 'GROUP', groupId, createdById } });
  }

  async create(user: Viewer, name: string) {
    await this.access.assertAccess(user);
    if (await this.db.groupMember.count({ where: { userId: user.id } }) >= LIMITS.groupsPerUser) throw new BadRequestException(`Dá para estar em até ${LIMITS.groupsPerUser} grupos.`);
    const group = await this.db.group.create({ data: { name, ownerId: user.id, members: { create: { userId: user.id } } } });
    await this.newInvite(group.id, user.id);
    return { id: group.id };
  }

  async rename(user: Viewer, id: number, name: string) {
    await this.owned(user, id);
    await this.db.group.update({ where: { id }, data: { name } });
    return { id, name };
  }

  async remove(user: Viewer, id: number) {
    await this.owned(user, id);
    await this.db.group.delete({ where: { id } });
    return { message: 'Grupo apagado.' };
  }

  async rotateInvite(user: Viewer, id: number) {
    await this.owned(user, id);
    await this.db.invite.deleteMany({ where: { groupId: id } });
    return { code: (await this.newInvite(id, user.id)).code };
  }

  /** Dono tira alguém; qualquer um sai sozinho. O dono não sai: apaga o grupo. */
  async removeMember(user: Viewer, groupId: number, userId: number) {
    const member = await this.access.membership(user.id, groupId);
    if (userId === member.group.ownerId) throw new BadRequestException('Quem criou o grupo não sai dele; dá para apagar o grupo.');
    if (userId !== user.id && member.group.ownerId !== user.id) throw new ForbiddenException('Só quem criou o grupo pode tirar alguém.');
    await this.db.groupMember.deleteMany({ where: { groupId, userId } });
    return { message: userId === user.id ? 'Você saiu do grupo.' : 'Pessoa removida do grupo.' };
  }

  private async period(steamId: string, days: number) {
    return this.db.trackedMatch.findMany({ where: periodWhere(steamId, days), include: { players: true }, orderBy: [{ playedAt: 'desc' }, { id: 'desc' }] });
  }

  async group(user: Viewer, id: number, days: number) {
    await this.access.assertAccess(user);
    const { group } = await this.access.membership(user.id, id);
    const [members, invite] = await Promise.all([
      this.db.groupMember.findMany({ where: { groupId: id }, orderBy: { joinedAt: 'asc' }, select: { joinedAt: true, user: { select: publicUser } } }),
      this.db.invite.findFirst({ where: { groupId: id, kind: 'GROUP' }, orderBy: { createdAt: 'desc' } }),
    ]);
    const ids = members.map(m => m.user.steamId);
    const ranking = await Promise.all(members.map(async m => ({ ...m.user, joinedAt: m.joinedAt, owner: m.user.id === group.ownerId,
      stats: periodStats(await this.period(m.user.steamId, days), m.user.steamId) })));
    // Partidas em que pelo menos dois do grupo jogaram do mesmo lado.
    const candidates: Match[] = await this.db.trackedMatch.findMany({ where: { status: 'READY', players: { some: { steamId: { in: ids } } },
      ...(days ? { playedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}) }, include: { players: true }, orderBy: [{ playedAt: 'desc' }, { id: 'desc' }], take: 300 });
    const together = candidates.flatMap(match => [0, 1].map(team => ({ match, mine: match.players.filter(p => p.team === team && ids.includes(p.steamId)) })))
      .filter(t => t.mine.length >= 2).slice(0, 15)
      .map(({ match, mine }) => { const card = matchCard(match, mine[0].steamId, ids);
        return { ...card, players: [card.player, ...card.teammates], viewerPlayed: match.players.some(p => p.steamId === user.steamId) }; });
    return { id: group.id, name: group.name, createdAt: group.createdAt, owner: group.ownerId === user.id, ownerId: group.ownerId,
      invite: invite?.code ?? null, limits: LIMITS, days, members: ranking, together };
  }

  async profile(user: Viewer, steamId: string, days: number) {
    await this.access.assertAccess(user);
    const circle = await this.access.circle(user.id);
    const target = await this.db.user.findUnique({ where: { steamId }, select: { ...publicUser, accessGrantedAt: true, tracking: { select: { enabled: true } } } });
    // Perfil privado: só a própria pessoa e quem divide algum grupo com ela.
    if (!target?.accessGrantedAt || (steamId !== user.steamId && !circle.includes(steamId))) throw new NotFoundException('Perfil não encontrado.');
    const [matches, groups] = await Promise.all([this.period(steamId, days),
      this.db.group.findMany({ where: { AND: [{ members: { some: { userId: target.id } } }, { members: { some: { userId: user.id } } }] },
        select: { id: true, name: true, _count: { select: { members: true } } }, orderBy: { createdAt: 'asc' } })]);
    const cards = matches.map(m => ({ ...matchCard(m, steamId, circle), viewerPlayed: m.players.some(p => p.steamId === user.steamId) }));
    const best = cards.filter(c => c.player.rating != null).sort((a, b) => b.player.rating! - a.player.rating!)[0] ?? null;
    return { user: { steamId: target.steamId, username: target.username, avatarUrl: target.avatarUrl, memberSince: target.accessGrantedAt,
      importing: !!target.tracking?.enabled, self: steamId === user.steamId }, days, stats: periodStats(matches, steamId),
      best, maps: mapBreakdown(cards), recent: cards.slice(0, 10),
      groups: groups.map(g => ({ id: g.id, name: g.name, members: g._count.members })) };
  }

  async inviteInfo(code: string) {
    const invite = await this.db.invite.findUnique({ where: { code }, include: { createdBy: { select: { username: true, avatarUrl: true } },
      group: { select: { name: true, _count: { select: { members: true } } } } } });
    if (!invite || invite.usesLeft === 0) throw new NotFoundException('Esse convite não vale mais. Peça um link novo.');
    return { kind: invite.kind, inviter: invite.createdBy, group: invite.group ? { name: invite.group.name, members: invite.group._count.members } : null };
  }

  async accept(user: Viewer, code: string) {
    return this.db.$transaction(async tx => {
      const invite = await tx.invite.findUnique({ where: { code }, include: { group: { include: { _count: { select: { members: true } } } } } });
      if (!invite || invite.usesLeft === 0) throw new NotFoundException('Esse convite não vale mais. Peça um link novo.');
      await this.access.grant(tx, user);
      if (invite.usesLeft != null) await tx.invite.update({ where: { code }, data: { usesLeft: { decrement: 1 } } });
      if (invite.kind === 'ACCESS' || !invite.group) return { groupId: null };
      const already = await tx.groupMember.findUnique({ where: { groupId_userId: { groupId: invite.group.id, userId: user.id } } });
      if (!already) {
        if (invite.group._count.members >= LIMITS.membersPerGroup) throw new BadRequestException(`O grupo já tem ${LIMITS.membersPerGroup} pessoas.`);
        if (await tx.groupMember.count({ where: { userId: user.id } }) >= LIMITS.groupsPerUser) throw new BadRequestException(`Dá para estar em até ${LIMITS.groupsPerUser} grupos.`);
        await tx.groupMember.create({ data: { groupId: invite.group.id, userId: user.id } });
      }
      return { groupId: invite.group.id };
    });
  }

  private assertAdmin(user: Viewer) { if (!this.access.isAdmin(user)) throw new ForbiddenException('Área só para administradores.'); }

  async admin(user: Viewer) {
    this.assertAdmin(user);
    const [seats, users, invites] = await Promise.all([this.access.seats(),
      this.db.user.findMany({ where: { accessGrantedAt: { not: null } }, orderBy: { accessGrantedAt: 'asc' },
        select: { ...publicUser, accessGrantedAt: true, tracking: { select: { enabled: true } }, _count: { select: { groups: true } } } }),
      this.db.invite.findMany({ where: { kind: 'ACCESS' }, orderBy: { createdAt: 'desc' }, select: { code: true, usesLeft: true, createdAt: true } })]);
    return { seats, founders: this.access.founders(), invites,
      users: users.map(({ tracking, _count, ...u }) => ({ ...u, importing: !!tracking?.enabled, groups: _count.groups })) };
  }

  async createAccessInvite(user: Viewer, uses: number) {
    this.assertAdmin(user);
    return this.db.invite.create({ data: { code: randomCode(12), kind: 'ACCESS', createdById: user.id, usesLeft: uses }, select: { code: true, usesLeft: true } });
  }

  async deleteInvite(user: Viewer, code: string) {
    this.assertAdmin(user);
    await this.db.invite.deleteMany({ where: { code, kind: 'ACCESS' } });
    return { message: 'Convite apagado.' };
  }

  async revokeAccess(user: Viewer, userId: number) {
    this.assertAdmin(user);
    if (userId === user.id) throw new BadRequestException('Você não pode tirar o próprio acesso.');
    await this.db.$transaction([this.db.matchTracking.deleteMany({ where: { userId } }),
      this.db.user.update({ where: { id: userId }, data: { accessGrantedAt: null } })]);
    return { message: 'Acesso removido. A importação dessa pessoa foi desligada.' };
  }
}

@ApiTags('grupos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tracking/groups')
export class GroupsController {
  constructor(private readonly service: GroupsService) {}
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post() create(@Req() req: any, @Body() dto: GroupNameDto) { return this.service.create(req.user, dto.name); }
  @Get(':id') group(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query() query: PeriodDto) { return this.service.group(req.user, id, query.days); }
  @Patch(':id') rename(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: GroupNameDto) { return this.service.rename(req.user, id, dto.name); }
  @Delete(':id') remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.remove(req.user, id); }
  @Post(':id/invite') rotate(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.rotateInvite(req.user, id); }
  @Delete(':id/members/:userId') removeMember(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Param('userId', ParseIntPipe) userId: number) {
    return this.service.removeMember(req.user, id, userId);
  }
}

@ApiTags('grupos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tracking/profiles')
export class ProfilesController {
  constructor(private readonly service: GroupsService) {}
  @Get(':steamId') profile(@Req() req: any, @Param('steamId') steamId: string, @Query() query: PeriodDto) { return this.service.profile(req.user, steamId, query.days); }
}

@ApiTags('grupos')
@Controller('tracking/invites')
export class InvitesController {
  constructor(private readonly service: GroupsService) {}
  @Get(':code') info(@Param('code') code: string) { return this.service.inviteInfo(code); }
  @ApiBearerAuth('JWT-auth') @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':code/accept') accept(@Req() req: any, @Param('code') code: string) { return this.service.accept(req.user, code); }
}

@ApiTags('grupos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tracking/admin')
export class AdminController {
  constructor(private readonly service: GroupsService) {}
  @Get() overview(@Req() req: any) { return this.service.admin(req.user); }
  @Post('invites') invite(@Req() req: any, @Body() dto: AccessInviteDto) { return this.service.createAccessInvite(req.user, dto.uses); }
  @Delete('invites/:code') deleteInvite(@Req() req: any, @Param('code') code: string) { return this.service.deleteInvite(req.user, code); }
  @Delete('users/:id/access') revoke(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.revokeAccess(req.user, id); }
}
