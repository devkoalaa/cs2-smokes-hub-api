import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { allowedSteamIds } from './tracking.crypto';

// Beta fechado: as partidas são para quem tem acesso. Fundadores
// (TRACKING_ALLOWED_STEAM_IDS) entram sozinhos; os demais por convite, até
// TRACKING_MAX_USERS vagas. Admins (TRACKING_ADMIN_STEAM_IDS) criam convites de acesso.

export const LIMITS = { groupsPerUser: 10, membersPerGroup: 20 };
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const randomCode = (length: number) => [...randomBytes(length)].map(b => ALPHABET[b % ALPHABET.length]).join('');
export const NO_ACCESS = 'O CS2 Hub está em beta fechado. Para entrar, abra um link de convite de quem já usa.';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AccessService {
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {}

  founders() { return allowedSteamIds(this.config.get<string>('TRACKING_ALLOWED_STEAM_IDS')); }
  isAdmin(user: Pick<User, 'steamId'>) { return allowedSteamIds(this.config.get<string>('TRACKING_ADMIN_STEAM_IDS')).includes(user.steamId); }
  maxUsers() { return Math.max(1, Number(this.config.get<string>('TRACKING_MAX_USERS')) || 30); }
  seats() { return this.db.user.count({ where: { accessGrantedAt: { not: null } } }).then(used => ({ used, max: this.maxUsers() })); }

  /** Tem acesso? Fundador ganha na primeira visita, sem contar no limite. */
  async hasAccess(user: Pick<User, 'id' | 'steamId' | 'accessGrantedAt'>) {
    if (user.accessGrantedAt) return true;
    if (!this.founders().includes(user.steamId)) return false;
    await this.db.user.update({ where: { id: user.id }, data: { accessGrantedAt: new Date() } });
    return true;
  }

  async assertAccess(user: Pick<User, 'id' | 'steamId' | 'accessGrantedAt'>) {
    if (!(await this.hasAccess(user))) throw new ForbiddenException(NO_ACCESS);
  }

  /** Concede uma vaga dentro de uma transação de convite. */
  async grant(tx: Db, user: Pick<User, 'id' | 'steamId' | 'accessGrantedAt'>) {
    if (user.accessGrantedAt) return;
    if (!this.founders().includes(user.steamId)) {
      const used = await tx.user.count({ where: { accessGrantedAt: { not: null } } });
      if (used >= this.maxUsers()) throw new ForbiddenException('As vagas do beta acabaram por enquanto. Tenta de novo daqui a uns dias.');
    }
    await tx.user.update({ where: { id: user.id }, data: { accessGrantedAt: new Date() } });
  }

  /** IDs dos grupos da pessoa e SteamIDs de quem divide algum grupo com ela (incluindo ela). */
  async circle(userId: number) {
    const groups = await this.db.groupMember.findMany({ where: { userId }, select: { groupId: true } });
    const members = await this.db.groupMember.findMany({ where: { groupId: { in: groups.map(g => g.groupId) } }, select: { user: { select: { steamId: true } } } });
    return [...new Set(members.map(m => m.user.steamId))];
  }

  async membership(userId: number, groupId: number) {
    const member = await this.db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } }, include: { group: true } });
    if (!member) throw new ForbiddenException('Você não está nesse grupo.');
    return member;
  }
}
