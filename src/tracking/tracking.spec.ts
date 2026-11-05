import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { allowedSteamIds, decryptAuthCode, encryptAuthCode, matchShareKey, validShareKey } from './tracking.crypto';
import { summarize } from './tracking.metrics';
import { TrackingService } from './tracking.service';
import { demoUrl, nextShareCode, matchRoster } from './worker/steam';

describe('Placares Valve 5×5 e Duplas', () => {
  const match = (ids: number[]) => ({ matchtime: 1, roundstatsall: [{ reservation: { account_ids: ids }, team_scores: [9, 6], kills: [14, 8, 0, 0, 0, 10, 6, 0, 0, 0], deaths: [7, 9, 0, 0, 0, 11, 11, 0, 0, 0], assists: [2, 3, 0, 0, 0, 2, 1, 0, 0, 0] }] });
  it('ignora slots vazios de Duplas preservando times e índices das estatísticas', () => {
    const result = matchRoster(match([11, 12, 0, 0, 0, 21, 22, 0, 0, 0]));
    expect(result.players).toHaveLength(4);
    expect(result.players.map(p => p.team)).toEqual([0, 0, 1, 1]);
    expect(result.players.map(p => p.kills)).toEqual([14, 8, 10, 6]);
    expect(result.players[2].steamId).toBe(String(76561197960265728n + 21n));
  });
  it('mantém os dez jogadores de 5×5', () => {
    expect(matchRoster(match([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).players).toHaveLength(10);
  });
  it('rejeita escalações incompletas ou duplicadas sem publicar estatísticas', () => {
    expect(() => matchRoster(match([11, 12, 0, 0, 0, 21, 0, 0, 0, 0]))).toThrow();
    expect(() => matchRoster(match([11, 12, 0, 0, 0, 11, 22, 0, 0, 0]))).toThrow();
  });
});

describe('Proteção e cálculo do rastreamento', () => {
  const key = 'ab'.repeat(32);
  it('criptografa com nonce único e vincula a credencial ao usuário', () => {
    const code = 'AAAA-AAAAA-AAAA';
    const encrypted = encryptAuthCode(code, key, 1);
    expect(encrypted).not.toContain(code);
    expect(encryptAuthCode(code, key, 1)).not.toBe(encrypted);
    expect(decryptAuthCode(encrypted, key, 1)).toBe(code);
    expect(() => decryptAuthCode(encrypted, key, 2)).toThrow();
    expect(() => decryptAuthCode(encrypted, 'cd'.repeat(32), 1)).toThrow();
  });
  it('não transforma estatística ausente em zero e pondera ADR pelos rounds', () => {
    const row = { kills: 10, deaths: 5, assists: 2, headshots: 5, damage: 1000, rounds: 10, scoreFor: 8, scoreAgainst: 2 };
    const result = summarize([row, { ...row, kills: 30, deaths: 15, headshots: null, damage: 2000, rounds: 30 }, { ...row, damage: null }]);
    expect(result.adr).toBe(75);
    expect(result.kd).toBe(2);
    expect(result.hsPercent).toBe(50);
    expect(result.adrMatches).toBe(2);
    expect(summarize([]).winRate).toBeNull();
    expect(summarize([{ ...row, deaths: 0 }]).kd).toBeNull();
  });
  it('restringe acesso ao grupo e falha fechado sem configuração', async () => {
    const db = { trackedMatch: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const config = new ConfigService({ TRACKING_ALLOWED_STEAM_IDS: '76561198143147452' });
    const service = new TrackingService(db, config);
    expect(() => service.assertAccess('76561198132822021')).toThrow(ForbiddenException);
    expect(() => new TrackingService(db, new ConfigService()).assertAccess('76561198143147452')).toThrow(ServiceUnavailableException);
    await expect(service.detail('76561198143147452', 7)).rejects.toThrow(NotFoundException);
    expect(db.trackedMatch.findFirst.mock.calls[0][0].where.players.some.steamId).toBe('76561198143147452');
    expect(allowedSteamIds('invalid,76561198143147452,76561198143147452')).toHaveLength(1);
  });
  it('link compartilhável exige a chave da própria partida', async () => {
    expect(matchShareKey(7, key)).toMatch(/^[a-f0-9]{16}$/);
    expect(validShareKey(7, matchShareKey(7, key), key)).toBe(true);
    expect(validShareKey(8, matchShareKey(7, key), key)).toBe(false);
    expect(validShareKey(7, '', key)).toBe(false);
    const group = '76561198143147452', other = '76561198000000001';
    const player = { kills: 20, deaths: 10, assists: 3, headshots: 10, damage: 2100, rounds: 21, scoreFor: 13, scoreAgainst: 8 };
    const db = { trackedMatch: { findFirst: jest.fn().mockResolvedValue({ id: 7, mode: 'competitive', map: 'de_mirage', playedAt: new Date(0), rounds: 21,
      players: [{ ...player, steamId: group, name: 'koala', team: 0 }, { ...player, steamId: other, name: 'rival', team: 1, scoreFor: 8, scoreAgainst: 13 }] }) } } as any;
    const service = new TrackingService(db, new ConfigService({ TRACKING_ALLOWED_STEAM_IDS: group, TRACKING_ENCRYPTION_KEY: key }));
    await expect(service.preview(7, 'f'.repeat(16))).rejects.toThrow(NotFoundException);
    expect(db.trackedMatch.findFirst).not.toHaveBeenCalled();
    const preview = await service.preview(7, matchShareKey(7, key));
    expect(preview.score).toEqual([13, 8]);
    expect(preview.group).toEqual([{ name: 'koala', team: 0, kills: 20, deaths: 10, assists: 3, adr: 100, hsPercent: 50 }]);
  });
  it('só aceita URL de replay da Valve sem redirecionamento arbitrário', () => {
    expect(demoUrl({ roundstatsall: [{ map: 'http://replay123.valve.net/730/test.dem.bz2' }] })).toContain('replay123.valve.net');
    for (const url of ['http://127.0.0.1/demo.dem.bz2', 'http://replay123.valve.net.evil.test/730/test.dem.bz2', 'http://user:pass@replay123.valve.net/730/test.dem.bz2']) {
      expect(() => demoUrl({ roundstats_legacy: { map: url } })).toThrow();
    }
  });
});

describe('Descoberta incremental Steam', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('202 significa que não há nova partida, não uma falha', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 202 });
    await expect(nextShareCode('secret', 'id', 'auth', 'known')).resolves.toBeNull();
  });
  it('credencial recusada exige reconfiguração sem expor códigos', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 403 });
    await expect(nextShareCode('secret', 'id', 'auth', 'known')).rejects.toMatchObject({ permanent: true });
  });
  it('não avança cursor em resposta inválida ou limitação de taxa', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 429, ok: false });
    await expect(nextShareCode('secret', 'id', 'auth', 'known')).rejects.toMatchObject({ permanent: false });
    global.fetch = jest.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ result: {} }) });
    await expect(nextShareCode('secret', 'id', 'auth', 'known')).rejects.toThrow();
  });
});

describe('Integração com o Clodoaldo', () => {
  const { BotTokenGuard, TrackingBotService } = require('./tracking.bot');
  const { UnauthorizedException, ServiceUnavailableException } = require('@nestjs/common');
  const context = (authorization?: string) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) }) as any;
  const token = 'x'.repeat(40);
  it('exige o token do bot e falha fechado sem configuração', () => {
    const guard = new BotTokenGuard(new ConfigService({ CS2_BOT_TOKEN: token }));
    expect(guard.canActivate(context(`Bearer ${token}`))).toBe(true);
    expect(() => guard.canActivate(context(`Bearer ${'y'.repeat(40)}`))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => new BotTokenGuard(new ConfigService({})).canActivate(context(`Bearer ${token}`))).toThrow(ServiceUnavailableException);
  });
  it('só responde sobre o grupo e mostra só companheiros do grupo', async () => {
    const me = '76561198143147452', friend = '76561198132822021', stranger = '76561198000000001';
    const base = { assists: 2, headshots: 5, damage: 1500, rounds: 20, scoreFor: 13, scoreAgainst: 7, kills: 10, deaths: 8 };
    const match = { id: 3, map: 'de_nuke', mode: 'competitive', playedAt: new Date(0), rounds: 20, analysis: null, players: [
      { ...base, steamId: me, name: 'koala', team: 0 }, { ...base, steamId: friend, name: 'Moacir', team: 0 },
      { ...base, steamId: stranger, name: 'aleatório', team: 0 }, { ...base, steamId: '76561198000000002', name: 'rival', team: 1, scoreFor: 7, scoreAgainst: 13 }] };
    const db = { trackedMatch: { findMany: jest.fn().mockResolvedValue([match]) } } as any;
    const service = new TrackingBotService(db, new ConfigService({ TRACKING_ALLOWED_STEAM_IDS: `${me},${friend}`, TRACKING_ENCRYPTION_KEY: 'ab'.repeat(32) }));
    await expect(service.recent(stranger, 5)).rejects.toThrow(NotFoundException);
    const [card] = await service.recent(me, 5);
    expect(card.teammates.map((t: any) => t.name)).toEqual(['Moacir']);
    expect(card.player).toMatchObject({ kills: 10, adr: 75, hsPercent: 50, rating: 1 });
    expect(card.shareKey).toMatch(/^[a-f0-9]{16}$/);
  });
});
