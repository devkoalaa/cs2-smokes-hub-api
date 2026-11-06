import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { AccessService } from './tracking.access';
import { GroupsService } from './tracking.groups';
import { MediaService } from './tracking.media';
import { TrackingService } from './tracking.service';

// Beta, grupos e privacidade contra um Postgres de verdade com as migrations aplicadas.
// Só roda com TEST_DATABASE_URL (banco descartável: as tabelas são esvaziadas).
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Beta fechado, grupos e privacidade (Postgres)', () => {
  // O Jest executa o corpo do describe mesmo quando pula: sem banco, nada de cliente.
  const db = (url ? new PrismaClient({ datasources: { db: { url } } }) : {}) as any;
  const F1 = '76561198000000001';
  const config = new ConfigService({ TRACKING_ALLOWED_STEAM_IDS: F1, TRACKING_ADMIN_STEAM_IDS: F1, TRACKING_MAX_USERS: '3', TRACKING_ENCRYPTION_KEY: 'ab'.repeat(32) });
  const access = new AccessService(db, config);
  const tracking = new TrackingService(db, config, access);
  const groups = new GroupsService(db, access);
  const media = new MediaService(db, access);
  const users: Record<string, any> = {};
  const fresh = async (name: string) => (users[name] = await db.user.findUnique({ where: { id: users[name].id } }));

  beforeAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE users, tracked_matches RESTART IDENTITY CASCADE');
    for (const [i, name] of ['F1', 'A', 'B', 'C', 'D', 'E'].entries()) {
      users[name] = await db.user.create({ data: { steamId: name === 'F1' ? F1 : `7656119800000010${i}`, username: name } });
    }
  });
  afterAll(() => db.$disconnect?.());

  let groupId: number, invite: string;
  it('fundador entra sozinho e cria o grupo com link de convite', async () => {
    expect(await access.hasAccess(users.F1)).toBe(true);
    await fresh('F1');
    groupId = (await groups.create(users.F1, 'Trio')).id;
    invite = (await groups.group(users.F1, groupId, 0)).invite;
    expect(invite).toMatch(/^[A-Za-z0-9]{12}$/);
    expect((await groups.inviteInfo(invite)).group).toEqual({ name: 'Trio', members: 1, avatarUrl: null });
  });

  it('convite de grupo dá acesso até acabarem as vagas', async () => {
    await groups.accept(users.A, invite); await fresh('A');
    await groups.accept(users.B, invite); await fresh('B');
    expect(await access.seats()).toEqual({ used: 3, max: 3 });
    await expect(groups.accept(users.C, invite)).rejects.toThrow(ForbiddenException);
    expect((await fresh('C')).accessGrantedAt).toBeNull();
    await expect(tracking.dashboard(users.C, { days: 0, mode: 'all', scope: 'all', page: 1 } as any)).rejects.toThrow(ForbiddenException);
  });

  it('perfil só abre para quem divide grupo', async () => {
    await db.user.update({ where: { id: users.E.id }, data: { accessGrantedAt: new Date() } }); await fresh('E');
    expect((await groups.profile(users.A, F1, 0)).user.username).toBe('F1');
    expect((await groups.profile(users.A, users.A.steamId, 0)).user.self).toBe(true);
    await expect(groups.profile(users.E, users.A.steamId, 0)).rejects.toThrow(NotFoundException);
    await expect(groups.profile(users.D, users.A.steamId, 0)).rejects.toThrow(ForbiddenException);
  });

  it('só o dono tira gente, e o dono não sai do próprio grupo', async () => {
    await expect(groups.removeMember(users.A, groupId, users.B.id)).rejects.toThrow(ForbiddenException);
    await expect(groups.removeMember(users.F1, groupId, users.F1.id)).rejects.toThrow(BadRequestException);
    await groups.removeMember(users.F1, groupId, users.B.id);
    await expect(groups.profile(users.B, users.A.steamId, 0)).rejects.toThrow(NotFoundException);
    await expect(groups.group(users.B, groupId, 0)).rejects.toThrow(ForbiddenException);
  });

  let matchId: number;
  it('link compartilhado mostra quem compartilhou e o grupo, respeitando quem não quer aparecer', async () => {
    const row = { assists: 1, headshots: 2, damage: 1600, rounds: 16, scoreFor: 13, scoreAgainst: 3, kills: 10, deaths: 5 };
    const match = await db.trackedMatch.create({ data: { shareCode: 'CSGO-test', status: 'READY', map: 'de_mirage', playedAt: new Date(), rounds: 16, players: { create: [
      { ...row, steamId: F1, name: 'F1', team: 0 }, { ...row, steamId: users.A.steamId, name: 'A', team: 0 },
      { ...row, steamId: users.E.steamId, name: 'E', team: 1, scoreFor: 3, scoreAgainst: 13 }] } } });
    matchId = match.id;
    const { shareKey } = await tracking.detail(users.F1, matchId);
    expect(shareKey).toMatch(/^[A-Za-z0-9]{10}$/);
    expect((await tracking.detail(users.F1, matchId)).shareKey).toBe(shareKey);
    expect((await tracking.preview(matchId, shareKey!)).group.map(p => p.name)).toEqual(['F1', 'A']);
    await tracking.preferences(users.A, { allowPreview: false });
    expect((await tracking.preview(matchId, shareKey!)).group.map(p => p.name)).toEqual(['F1']);
    await expect(tracking.preview(matchId, 'zzzzzzzzzz')).rejects.toThrow(NotFoundException);
  });

  it('grupo compara quem jogou e acha as partidas jogadas juntos', async () => {
    const dash = await tracking.dashboard(users.F1, { days: 0, mode: 'all', scope: 'together', page: 1, group: groupId } as any);
    expect(dash.total).toBe(1);
    expect(dash.comparison.map(c => c.username).sort()).toEqual(['A', 'F1']);
    const group = await groups.group(users.A, groupId, 0);
    expect(group.together).toHaveLength(1);
    expect(group.together[0].players.map(p => p.name).sort()).toEqual(['A', 'F1']);
    expect(group.members.find(m => m.username === 'F1')?.stats.matches).toBe(1);
  });

  it('Discord vincula pelo código do site, um Discord por conta', async () => {
    const { code } = await media.discordCode(users.A);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await media.linkDiscord({ code, discordId: '123456789012345678', discordName: 'a#0' })).toEqual({ username: 'A' });
    await expect(media.linkDiscord({ code, discordId: '123456789012345678', discordName: 'a#0' })).rejects.toThrow(NotFoundException);
    const other = await media.discordCode(users.F1);
    await media.linkDiscord({ code: other.code, discordId: '123456789012345678', discordName: 'a#0' });
    expect((await fresh('A')).discordId).toBeNull();
    expect((await fresh('F1')).discordId).toBe('123456789012345678');
    await media.unlinkByDiscord('123456789012345678');
    expect((await fresh('F1')).discordId).toBeNull();
  });

  it('banner e foto do grupo viram WebP e só o dono troca a foto', async () => {
    const png = { buffer: await require('sharp')({ create: { width: 40, height: 30, channels: 3, background: '#e11d48' } }).png().toBuffer() } as any;
    const { url } = await media.setBanner(users.A, png);
    const key = url!.split('/').pop()!;
    const meta = await require('sharp')(await media.image(key)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1600, 640]);
    await expect(media.setBanner(users.A, { buffer: Buffer.from('não é imagem') } as any)).rejects.toThrow(BadRequestException);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expect(media.setBanner(users.A, { buffer: svg } as any)).rejects.toThrow(BadRequestException);
    await expect(media.setGroupAvatar(users.A, groupId, png)).rejects.toThrow(ForbiddenException);
    expect((await media.setGroupAvatar(users.F1, groupId, png)).url).toMatch(/^\/api\/tracking\/images\/[A-Za-z0-9]{24}$/);
    expect((await groups.group(users.A, groupId, 0)).avatarUrl).toMatch(/images/);
  });

  it('excluir meus dados libera a vaga e apaga o que só a pessoa importou', async () => {
    const solo = await db.trackedMatch.create({ data: { shareCode: 'CSGO-solo', status: 'READY', map: 'de_nuke', playedAt: new Date(), rounds: 1,
      players: { create: [{ steamId: users.A.steamId, name: 'A', team: 0, kills: 1, deaths: 0, assists: 0, rounds: 1, scoreFor: 1, scoreAgainst: 0 }] },
      requests: { create: [{ userId: users.A.id }] } } });
    await db.matchRequest.create({ data: { userId: users.A.id, matchId } });
    await tracking.deleteMine(users.A); await fresh('A');
    expect(users.A.accessGrantedAt).toBeNull();
    expect(await db.image.count({ where: { userId: users.A.id } })).toBe(0);
    expect(await db.groupMember.count({ where: { userId: users.A.id } })).toBe(0);
    expect(await db.trackedMatch.findUnique({ where: { id: solo.id } })).toBeNull();
    expect(await db.trackedMatch.findUnique({ where: { id: matchId } })).not.toBeNull();
  });

  it('convite de acesso do admin tem número de usos', async () => {
    await expect(groups.createAccessInvite(users.E, 1)).rejects.toThrow(ForbiddenException);
    const { code } = await groups.createAccessInvite(users.F1, 1);
    await db.user.update({ where: { id: users.E.id }, data: { accessGrantedAt: null } }); // libera a vaga de E
    await groups.accept(users.C, code);
    expect((await fresh('C')).accessGrantedAt).not.toBeNull();
    await expect(groups.accept(users.D, code)).rejects.toThrow(NotFoundException);
    expect((await groups.admin(users.F1)).seats).toEqual({ used: 3, max: 3 });
  });
});
