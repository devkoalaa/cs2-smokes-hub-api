import { link, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export async function queueSummaries(db: PrismaClient, allowed: string[], directory: string) {
  const matches = await db.trackedMatch.findMany({
    where: { status: 'READY', summaryPending: true }, orderBy: { id: 'asc' }, take: 10,
    include: { players: true },
  });
  if (!matches.length) return;
  const start = Date.parse((await readFile(join(directory, 'enabled-at'), 'utf8')).trim());
  if (!Number.isFinite(start)) throw new Error('Data de ativação inválida');
  for (const match of matches) {
    if (match.playedAt && match.playedAt.getTime() >= start) {
      const analysis = match.analysis as { players?: Record<string, { premierAfter?: number; premierDelta?: number; clutch?: number; multi?: number; flashed?: number }> } | null;
      const roster = match.players.map(p => ({ team: p.team, name: p.name, kills: p.kills, deaths: p.deaths }));
      // Quem recebe: quem vinculou o Discord no site e deixou o aviso ligado (precisa ter acesso),
      // além dos fundadores, que o Clodoaldo ainda conhece pelo CS2_DISCORD_USERS.
      const linked = await db.user.findMany({ where: { steamId: { in: match.players.map(p => p.steamId) }, discordId: { not: null }, discordDm: true,
        OR: [{ accessGrantedAt: { not: null } }, { steamId: { in: allowed } }] }, select: { steamId: true, discordId: true } });
      const discordOf = new Map(linked.map(u => [u.steamId, u.discordId!]));
      const optedOut = new Set((await db.user.findMany({ where: { steamId: { in: allowed }, discordDm: false }, select: { steamId: true } })).map(u => u.steamId));
      for (const player of match.players.filter(p => discordOf.has(p.steamId) || (allowed.includes(p.steamId) && !optedOut.has(p.steamId)))) {
        const stats = analysis?.players?.[player.steamId];
        const summary = {
          matchId: match.id, steamId: player.steamId, discordId: discordOf.get(player.steamId) ?? null, map: match.map, playedAt: match.playedAt,
          mode: match.mode, team: player.team, roster, headshots: player.headshots,
          clutches: stats?.clutch, multi: stats?.multi, flashed: stats?.flashed,
          scoreFor: player.scoreFor, scoreAgainst: player.scoreAgainst,
          kills: player.kills, deaths: player.deaths, assists: player.assists,
          adr: player.damage == null || !player.rounds ? null : Math.round(player.damage / player.rounds),
          premierAfter: stats?.premierAfter, premierDelta: stats?.premierDelta,
        };
        const temp = join(directory, randomUUID() + '.tmp');
        await writeFile(temp, JSON.stringify(summary), { flag: 'wx', mode: 0o600 });
        try {
          await link(temp, join(directory, match.id + '-' + player.steamId + '.json'));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        } finally { await unlink(temp); }
      }
    }
    await db.trackedMatch.update({ where: { id: match.id }, data: { summaryPending: false } });
  }
}
