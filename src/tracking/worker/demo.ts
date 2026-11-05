import { createWriteStream } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { CollectorError, demoUrl, matchRoster } from './steam';

export async function parseMatch(match: any) {
  const roster = matchRoster(match);
  const folder = await mkdtemp(join(tmpdir(), 'cs2-tracker-'));
  try {
    const file = join(folder, 'match.dem.bz2');
    const response = await fetch(demoUrl(match), { redirect: 'error', signal: AbortSignal.timeout(180000) });
    if (!response.ok || !response.body) throw new CollectorError('Não foi possível baixar a demo; ela pode ainda não estar disponível.');
    let received = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
      received += chunk.length;
      callback(received > 512 * 1024 * 1024 ? new Error('Demo excede o limite de download.') : null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body as any), limit, createWriteStream(file, { flags: 'wx' }));
    const result = await new Promise<any>((resolve, reject) => {
      const child = spawn(process.env.TRACKING_PYTHON || 'python3', [join(process.cwd(), 'scripts/tracking/parse_demo.py'), file], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', size = 0;
      const timer = setTimeout(() => { child.kill(); reject(new CollectorError('A análise excedeu o tempo limite.')); }, 180000);
      child.stdout.on('data', chunk => { size += chunk.length; if (size > 1024 * 1024) child.kill(); else output += chunk.toString(); });
      child.stderr.resume();
      child.on('error', () => { clearTimeout(timer); reject(new CollectorError('Analisador Python indisponível. Verifique a instalação do coletor.')); });
      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0 || size > 1024 * 1024) return reject(new CollectorError('A demo não pôde ser validada. Nova tentativa automática.'));
        try { resolve(JSON.parse(output)); } catch { reject(new CollectorError('Resposta inválida do analisador.')); }
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify(roster));
    });
    if (!Array.isArray(result.players) || result.players.length !== roster.players.length || typeof result.map !== 'string' || result.map.length > 64) throw new CollectorError('Dados da demo incompletos.');
    return { mode: roster.players.length === 4 ? 'wingman' : 'competitive', map: result.map, players: result.players, scoreA: roster.scores[0], scoreB: roster.scores[1], rounds: roster.scores[0] + roster.scores[1] };
  } finally { await rm(folder, { recursive: true, force: true }); }
}
