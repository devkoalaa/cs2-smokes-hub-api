import { MatchPlayer, Prisma } from '@prisma/client';
import { hubRating, summarize } from './tracking.metrics';

// Números por jogador a partir das partidas já importadas. Usado no perfil, no
// grupo e nas rotas do Clodoaldo, para todos contarem do mesmo jeito.

export type Match = Prisma.TrackedMatchGetPayload<{ include: { players: true } }>;
type Analysis = { players?: Record<string, { kast?: number; clutch?: number; multi?: number; premierAfter?: number; premierDelta?: number }> } | null;
const round = (n: number | null, digits = 2) => n == null ? null : Math.round(n * 10 ** digits) / 10 ** digits;
const mean = (values: (number | null)[]) => { const v = values.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

export const periodWhere = (steamId: string, days: number): Prisma.TrackedMatchWhereInput => ({ status: 'READY', players: { some: { steamId } },
  ...(days ? { playedAt: { gte: new Date(Date.now() - days * 86400000) } } : {}) });

export function playerRow(match: Match, p: MatchPlayer) {
  const extra = (match.analysis as Analysis)?.players?.[p.steamId];
  return { steamId: p.steamId, name: p.name, team: p.team, kills: p.kills, deaths: p.deaths, assists: p.assists, damage: p.damage,
    adr: p.damage == null || !p.rounds ? null : Math.round(p.damage / p.rounds), hsPercent: p.headshots == null || !p.kills ? null : Math.round(100 * p.headshots / p.kills),
    kastPercent: extra?.kast == null || !p.rounds ? null : Math.round(100 * extra.kast / p.rounds), rating: round(hubRating(p, match.players)),
    clutches: extra?.clutch ?? null, multiKills: extra?.multi ?? null, premierAfter: extra?.premierAfter ?? null, premierDelta: extra?.premierDelta ?? null };
}

/** Partida do ponto de vista de `steamId`, com os companheiros de time que estão em `circle`. */
export function matchCard(match: Match, steamId: string, circle: string[] = []) {
  const me = match.players.find(p => p.steamId === steamId)!;
  return { id: match.id, map: match.map, mode: match.mode, playedAt: match.playedAt, rounds: match.rounds,
    scoreFor: me.scoreFor, scoreAgainst: me.scoreAgainst, player: playerRow(match, me),
    teammates: match.players.filter(p => p.team === me.team && p.steamId !== steamId && circle.includes(p.steamId)).map(p => playerRow(match, p)) };
}

export function periodStats(matches: Match[], steamId: string) {
  const rows = matches.map(m => m.players.find(p => p.steamId === steamId)!);
  const ratings = matches.map(m => hubRating(m.players.find(p => p.steamId === steamId)!, m.players));
  return { ...summarize(rows), rating: round(mean(ratings)) };
}

export function mapBreakdown(cards: ReturnType<typeof matchCard>[]) {
  return Object.entries(cards.reduce<Record<string, { matches: number; wins: number }>>((acc, c) => {
    const m = (acc[c.map ?? '?'] ??= { matches: 0, wins: 0 }); m.matches++; if (c.scoreFor > c.scoreAgainst) m.wins++; return acc;
  }, {})).map(([map, v]) => ({ map, ...v })).sort((a, b) => b.matches - a.matches || b.wins - a.wins);
}
