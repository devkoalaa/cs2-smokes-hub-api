import { link, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

export async function queueSummaries(db: PrismaClient, allowed: string[], directory: string) {
  const matches = await db.trackedMatch.findMany({
    where: { status: 'READY', summaryPending: true }, orderBy: { id: 'asc' }, take: 10,
    include: { players: { where: { steamId: { in: allowed } } } },
  });
  if (!matches.length) return;
  const start = Date.parse((await readFile(join(directory, 'enabled-at'), 'utf8')).trim());
  if (!Number.isFinite(start)) throw new Error('Data de ativação inválida');
  for (const match of matches) {
    if (match.playedAt && match.playedAt.getTime() >= start) {
      const analysis = match.analysis as { players?: Record<string, { premierAfter?: number; premierDelta?: number }> } | null;
      for (const player of match.players) {
        const stats = analysis?.players?.[player.steamId];
        const summary = {
          matchId: match.id, steamId: player.steamId, map: match.map, playedAt: match.playedAt,
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
