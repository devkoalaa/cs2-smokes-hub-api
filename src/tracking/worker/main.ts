import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { allowedSteamIds, decryptAuthCode, trackingKey } from '../tracking.crypto';
import { CollectorError, nextShareCode, SteamCoordinator } from './steam';
import { parseMatch } from './demo';

const db = new PrismaClient();
const gc = new SteamCoordinator();
const allowed = allowedSteamIds(process.env.TRACKING_ALLOWED_STEAM_IDS);
let stopped = false;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const safeMessage = (error: unknown) => error instanceof CollectorError ? error.publicMessage : 'Falha temporária no processamento. Verifique o coletor.';

async function discover() {
  const accounts = await db.matchTracking.findMany({ where: { enabled: true, nextPollAt: { lte: new Date() }, user: { steamId: { in: allowed } } }, include: { user: true } });
  for (const account of accounts) {
    if (stopped) break;
    try {
      const code = account.seedPending ? account.lastShareCode : await nextShareCode(process.env.STEAM_API_KEY!, account.user.steamId,
        decryptAuthCode(account.authCodeEncrypted, process.env.TRACKING_ENCRYPTION_KEY!, account.userId), account.lastShareCode);
      await db.$transaction(async tx => {
        // Revision makes disconnect/reconfiguration win over an in-flight discovery request.
        const updated = await tx.matchTracking.updateMany({ where: { userId: account.userId, revision: account.revision, enabled: true },
          data: { lastCheckedAt: new Date(), lastError: null, nextPollAt: new Date(Date.now() + (code ? 10000 : 300000)),
            ...(code ? { lastShareCode: code, seedPending: false } : {}) } });
        if (!updated.count || !code) return;
        const match = await tx.trackedMatch.upsert({ where: { shareCode: code }, update: {}, create: { shareCode: code } });
        await tx.matchRequest.upsert({ where: { userId_matchId: { userId: account.userId, matchId: match.id } }, update: {}, create: { userId: account.userId, matchId: match.id } });
      });
    } catch (error) {
      await db.matchTracking.updateMany({ where: { userId: account.userId, revision: account.revision }, data: {
        lastError: safeMessage(error), lastCheckedAt: new Date(), nextPollAt: new Date(Date.now() + 600000),
        ...(error instanceof CollectorError && error.permanent ? { enabled: false } : {}),
      } });
    }
    await delay(1500);
  }
}

async function processOne() {
  const job = await db.trackedMatch.findFirst({ where: { status: 'PENDING', retryAt: { lte: new Date() },
    requests: { some: { user: { steamId: { in: allowed }, tracking: { enabled: true } } } } }, orderBy: { retryAt: 'asc' } });
  if (!job) return;
  const claimed = await db.trackedMatch.updateMany({ where: { id: job.id, status: 'PENDING' }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
  if (!claimed.count) return;
  try {
    const info = await gc.match(job.shareCode);
    const parsed = await parseMatch(info);
    const requests = await db.matchRequest.findMany({ where: { matchId: job.id }, include: { user: true } });
    const valid = requests.filter(r => parsed.players.some(p => p.steamId === r.user.steamId));
    if (!valid.length) throw new CollectorError('A partida inicial não pertence a nenhum dos jogadores solicitantes.', true);
    await db.$transaction(async tx => {
      await tx.matchPlayer.deleteMany({ where: { matchId: job.id } });
      await tx.trackedMatch.update({ where: { id: job.id }, data: { status: 'READY', lastError: null, valveMatchId: String(info.matchid),
        analysis: parsed.analysis ?? undefined, playedAt: new Date(info.matchtime * 1000), mode: parsed.mode, map: parsed.map, rounds: parsed.rounds, scoreA: parsed.scoreA, scoreB: parsed.scoreB,
        players: { create: parsed.players } } });
    });
    console.log(`Partida ${job.id} processada.`);
  } catch (error) {
    const attempts = job.attempts + 1;
    await db.trackedMatch.update({ where: { id: job.id }, data: {
      status: attempts >= 12 || (error instanceof CollectorError && error.permanent) ? 'FAILED' : 'PENDING',
      retryAt: new Date(Date.now() + Math.min(21600000, 60000 * 2 ** attempts)), lastError: safeMessage(error),
    } });
    console.warn(`Partida ${job.id}: ${safeMessage(error)}`);
  }
}

async function main() {
  trackingKey(process.env.TRACKING_ENCRYPTION_KEY!);
  if (!allowed.length || !process.env.STEAM_API_KEY || (!process.env.STEAM_BOT_REFRESH_TOKEN && (!process.env.STEAM_BOT_USERNAME || !process.env.STEAM_BOT_PASSWORD))) {
    throw new CollectorError('Configure a lista do grupo, a chave da API e a conta Steam do coletor.');
  }
  await db.$connect();
  await gc.connect();
  if (process.argv.includes('--backfill')) {
    const matches = await db.trackedMatch.findMany({ where: { status: 'READY', players: { some: { steamId: { in: allowed } } } }, select: { id: true, shareCode: true, analysis: true } });
    for (const match of matches.filter(m => !m.analysis || typeof m.analysis !== 'object' || !('version' in m.analysis) || m.analysis.version !== 2)) {
      try {
        const parsed = await parseMatch(await gc.match(match.shareCode));
        if (!parsed.analysis) throw new CollectorError('Rounds incompletos na demo.');
        await db.trackedMatch.update({ where: { id: match.id }, data: { analysis: parsed.analysis } });
        console.log(`Partida ${match.id} atualizada.`);
      } catch (error) {
        console.warn(`Partida ${match.id}: ${safeMessage(error)}`);
        process.exitCode = 1;
      }
    }
    return;
  }
  const heartbeat = async () => { await db.trackingWorker.upsert({ where: { id: 'collector' }, create: { id: 'collector', heartbeatAt: new Date() }, update: { heartbeatAt: new Date() } }); };
  await heartbeat();
  const timer = setInterval(() => { heartbeat().catch(() => console.warn('Falha no heartbeat do coletor.')); }, 30000);
  try {
    do {
      // Recover jobs abandoned by a crashed worker; processing is bounded to less than 10 minutes.
      await db.trackedMatch.updateMany({ where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 900000) } }, data: { status: 'PENDING' } });
      await discover();
      await processOne();
      if (process.argv.includes('--once')) break;
      await delay(10000);
    } while (!stopped);
  } finally { clearInterval(timer); }
}

process.on('SIGTERM', () => { stopped = true; });
process.on('SIGINT', () => { stopped = true; });
main().catch(error => { console.error(safeMessage(error)); process.exitCode = 1; }).finally(async () => { gc.close(); await db.$disconnect(); });
