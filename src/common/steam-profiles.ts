import { PrismaClient } from '@prisma/client';

// Nome e foto do perfil vêm da Steam no login; aqui eles são atualizados sem precisar
// entrar de novo (ao abrir o app e, no coletor, de tempos em tempos para todo mundo).

type Db = Pick<PrismaClient, 'user'>;
interface Summary { steamid: string; personaname?: string; avatarfull?: string }

/** Busca até 100 perfis por chamada na Web API da Steam e grava o que mudou. */
export async function refreshSteamProfiles(db: Db, apiKey: string | undefined, steamIds: string[]) {
  if (!apiKey || !steamIds.length) return 0;
  let updated = 0;
  for (let i = 0; i < steamIds.length; i += 100) {
    const batch = steamIds.slice(i, i + 100);
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${batch.join(',')}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Steam respondeu ${response.status}`);
    const players: Summary[] = (await response.json())?.response?.players ?? [];
    const now = new Date();
    for (const p of players) {
      if (!batch.includes(p.steamid)) continue;
      await db.user.updateMany({ where: { steamId: p.steamid }, data: {
        ...(p.personaname ? { username: p.personaname.slice(0, 64) } : {}),
        ...(p.avatarfull?.startsWith('https://') ? { avatarUrl: p.avatarfull } : {}),
        steamSyncedAt: now,
      } });
      updated++;
    }
  }
  return updated;
}
