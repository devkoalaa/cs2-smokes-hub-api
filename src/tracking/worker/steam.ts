const SteamUser = require('steam-user');
const GlobalOffensive = require('globaloffensive');
const { ShareCode } = require('globaloffensive-sharecode');

export class CollectorError extends Error {
  constructor(public readonly publicMessage: string, public readonly permanent = false) { super(publicMessage); }
}

export async function nextShareCode(apiKey: string, steamId: string, authCode: string, knownCode: string): Promise<string | null> {
  const url = new URL('https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1/');
  url.search = new URLSearchParams({ key: apiKey, steamid: steamId, steamidkey: authCode, knowncode: knownCode }).toString();
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' }); }
  catch { throw new CollectorError('Não foi possível consultar a Steam. Nova tentativa automática.'); }
  if (response.status === 202) return null;
  if ([401, 403].includes(response.status)) throw new CollectorError('A Steam recusou o acesso. Confira o código de autenticação e a chave da API.', true);
  if (response.status === 400) throw new CollectorError('Código inicial inválido ou antigo. Configure uma partida recente.', true);
  if (!response.ok) throw new CollectorError('A Steam está indisponível ou limitou as consultas. Nova tentativa automática.');
  const body = await response.json() as any;
  const code = body?.result?.nextcode;
  if (code === 'n/a') return null;
  if (typeof code !== 'string' || !/^CSGO-(?:[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789]{5}-){4}[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789]{5}$/.test(code)) {
    throw new CollectorError('Resposta inesperada da Steam. Nova tentativa automática.');
  }
  return code === knownCode ? null : code;
}

export class SteamCoordinator {
  private client = new SteamUser({ enablePicsCache: false, autoRelogin: true, dataDirectory: null });
  private gc = new GlobalOffensive(this.client);
  constructor() {
    this.client.on('loggedOn', () => this.client.gamesPlayed([730]));
    // Never log Steam errors: they can contain authentication details.
    this.client.on('error', () => console.warn('Steam: conexão indisponível.'));
    this.client.on('steamGuard', () => console.warn('Steam Guard necessário: configure STEAM_BOT_GUARD_CODE e reinicie o coletor.'));
  }
  async connect() {
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new CollectorError('Tempo esgotado ao conectar ao Game Coordinator.')); }, 60000);
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new CollectorError('Falha na autenticação da conta do coletor.')); };
      const cleanup = () => { clearTimeout(timer); this.gc.off('connectedToGC', onReady); this.client.off('error', onError); };
      this.gc.on('connectedToGC', onReady); this.client.on('error', onError);
    });
    const refreshToken = process.env.STEAM_BOT_REFRESH_TOKEN;
    this.client.logOn(refreshToken ? { refreshToken } : {
      accountName: process.env.STEAM_BOT_USERNAME, password: process.env.STEAM_BOT_PASSWORD,
      twoFactorCode: process.env.STEAM_BOT_GUARD_CODE, authCode: process.env.STEAM_BOT_EMAIL_CODE,
    });
    await ready;
  }
  async match(code: string): Promise<any> {
    if (!this.gc.haveGCSession) throw new CollectorError('Aguardando conexão com o Game Coordinator.');
    const decoded = new ShareCode(code).decode();
    if (!decoded) throw new CollectorError('Código de partida inválido.', true);
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.gc.off('matchList', listener); };
      const listener = (matches: any[]) => {
        const found = matches.find(m => String(m.matchid) === decoded.matchId);
        if (found) { cleanup(); resolve(found); }
      };
      const timer = setTimeout(() => { cleanup(); reject(new CollectorError('Demo ainda indisponível ou expirada. Nova tentativa automática.')); }, 30000);
      this.gc.on('matchList', listener);
      try { this.gc.requestGame(code); } catch { cleanup(); reject(new CollectorError('Não foi possível consultar a partida.')); }
    });
  }
  close() { this.client.logOff(); }
}

export function demoUrl(match: any): string {
  const rounds = [...(match.roundstatsall || [])].reverse();
  const value = [match.roundstats_legacy, ...rounds].map(r => r?.map).find(x => typeof x === 'string' && /^https?:\/\//.test(x));
  if (!value) throw new CollectorError('Demo ainda indisponível ou expirada.');
  const url = new URL(value);
  // Only Valve replay hosts; no redirects, credentials or user-supplied destinations.
  if (!/^replay\d+\.valve\.net$/.test(url.hostname) || url.username || url.password || url.port || !/^\/730\/[\w.-]+\.dem\.bz2$/.test(url.pathname) || url.search || url.hash) {
    throw new CollectorError('Endereço da demo não reconhecido.', true);
  }
  return url.toString();
}

export function matchRoster(match: any) {
  const last = [...(match.roundstatsall || [])].reverse().find(r => r.reservation?.account_ids?.length === 10 && r.team_scores?.length === 2) || match.roundstats_legacy;
  if (last?.reservation?.account_ids?.length !== 10 || last?.team_scores?.length !== 2 || !match.matchtime) {
    throw new CollectorError('A partida não contém um placar competitivo completo.', true);
  }
  const scores = last.team_scores;
  if (!scores.every(n => Number.isInteger(n) && n >= 0) || scores[0] + scores[1] < 1) throw new CollectorError('Placar inválido.', true);
  const players = last.reservation.account_ids.map((account: number, i: number) => ({
    steamId: (76561197960265728n + BigInt(account)).toString(), team: i < 5 ? 0 : 1,
    kills: last.kills?.[i], deaths: last.deaths?.[i], assists: last.assists?.[i],
  })).filter(player => player.steamId !== '76561197960265728');
  const teamSize = players.filter(player => player.team === 0).length;
  if (![2, 5].includes(teamSize) || players.length !== teamSize * 2 || new Set(players.map(player => player.steamId)).size !== players.length) {
    throw new CollectorError('Formato da partida não suportado: esperado 5×5 ou Duplas 2×2.', true);
  }
  return { scores, players };
}
