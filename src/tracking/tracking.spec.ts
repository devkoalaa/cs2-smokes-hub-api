import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { allowedSteamIds, decryptAuthCode, encryptAuthCode } from './tracking.crypto';
import { summarize } from './tracking.metrics';
import { TrackingService } from './tracking.service';
import { demoUrl, nextShareCode } from './worker/steam';

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
