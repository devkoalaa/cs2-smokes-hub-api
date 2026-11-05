export interface StatRow {
  kills: number; deaths: number; assists: number; headshots: number | null;
  damage: number | null; rounds: number; scoreFor: number; scoreAgainst: number;
}

const rounded = (n: number) => Math.round(n * 100) / 100;
export function summarize(rows: StatRow[]) {
  const sum = (key: 'kills' | 'deaths' | 'assists' | 'rounds') => rows.reduce((n, r) => n + r[key], 0);
  const kills = sum('kills'), deaths = sum('deaths');
  const damageRows = rows.filter(r => r.damage !== null && r.rounds > 0);
  const hsRows = rows.filter(r => r.headshots !== null);
  const hsKills = hsRows.reduce((n, r) => n + r.kills, 0);
  const wins = rows.filter(r => r.scoreFor > r.scoreAgainst).length;
  return {
    matches: rows.length, kills, deaths, assists: sum('assists'), rounds: sum('rounds'), wins,
    draws: rows.filter(r => r.scoreFor === r.scoreAgainst).length,
    kd: deaths ? rounded(kills / deaths) : null,
    adr: damageRows.length ? rounded(damageRows.reduce((n,r) => n + r.damage!, 0) / damageRows.reduce((n,r) => n + r.rounds, 0)) : null,
    hsPercent: hsKills ? rounded(hsRows.reduce((n,r) => n + r.headshots!, 0) / hsKills * 100) : null,
    winRate: rows.length ? rounded(wins / rows.length * 100) : null,
    adrMatches: damageRows.length,
  };
}
