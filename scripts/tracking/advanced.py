"""Round and radar-contact statistics from completed, live CS2 rounds."""
from bisect import bisect_left, bisect_right
from collections import defaultdict
from math import acos, cos, degrees, hypot, isfinite, radians, sin

MASK = 'CCSPlayerPawn.m_bSpottedByMask'
# 3: lista de mortes com posições (mapa de abates). O --backfill do coletor reprocessa versões antigas.
ANALYSIS_VERSION = 3
GUNS = set('ak47 aug awp bizon cz75a deagle elite famas fiveseven g3sg1 galilar glock hkp2000 m249 m4a1 m4a1_silencer mac10 mag7 mp5sd mp7 mp9 negev nova p250 p90 revolver sawedoff scar20 sg556 ssg08 tec9 ump45 usp_silencer xm1014'.split())


def advanced(parser, players, ends):
    teams = {p['steamId']: p['team'] for p in players}
    starts = sorted(parser.parse_event('round_freeze_end')['tick'])
    ranges = []
    for end in ends.sort_values('tick').itertuples():
        i = bisect_right(starts, end.tick) - 1
        if i >= 0 and (not ranges or starts[i] > ranges[-1][1]):
            ranges.append((int(starts[i]), int(end.tick), end.winner))
    if len(ranges) != players[0]['rounds']:
        return None
    events = {}
    for name in ['player_death', 'player_blind', 'weapon_fire', 'player_hurt']:
        # Nas mortes, a posição de quem matou e de quem morreu vira o mapa de abates.
        frame = parser.parse_event(name, player=['X', 'Y', 'Z', 'team_num']) if name == 'player_death' else parser.parse_event(name)
        events[name] = sorted(frame.itertuples(), key=lambda x: x.tick)
    ticks = [t for start, end, _ in ranges for t in range(start, end + 1, 8)]
    fields = [MASK, 'X', 'Y', 'Z', 'duck_amount', 'pitch', 'yaw', 'is_alive', 'team_num', 'rank']
    snapshots = parser.parse_ticks(fields, ticks=ticks).rename(columns={MASK: 'spotters'})
    samples = {p: defaultdict(list) for p in teams}
    stats = {p: dict(kast=0, opening=0, multi=0, clutch=0, flashed=0, shots=0, hits=0, rank=None) for p in teams}
    segments, kill_map = [], []
    for number, (start, end, winner) in enumerate(ranges, 1):
        rows = snapshots[(snapshots.tick >= start) & (snapshots.tick <= end)]
        by_tick = defaultdict(dict)
        for row in rows.itertuples():
            pid = str(row.steamid)
            if pid in teams:
                by_tick[row.tick][pid] = row
        start_rows = by_tick.get(start, {})
        side = {teams[p]: r.team_num for p, r in start_rows.items() if r.team_num in (2, 3)}
        winning = next((team for team, value in side.items() if value == {'T': 2, 'CT': 3}.get(winner)), None)
        if winning is not None:
            if not segments or segments[-1]['sideA'] != side.get(0):
                segments.append(dict(sideA=int(side.get(0, 0)), wins=[0, 0]))
            segments[-1]['wins'][winning] += 1
        for p, r in start_rows.items():
            if r.rank and isfinite(r.rank) and r.rank > 0:
                stats[p]['rank'] = int(r.rank)
        def live_events(name):
            return (e for e in events[name] if start <= e.tick <= end)
        alive = set(teams)
        credited, deaths, kills, candidates = set(), [], defaultdict(int), set()
        opening = True
        shots, damage, lethal = defaultdict(list), defaultdict(list), defaultdict(list)
        for e in live_events('player_death'):
            a, v = e.attacker_steamid, e.user_steamid
            alive.discard(v)
            if v in teams:
                kill_map.append(kill_point(e, number, start, a if a in teams else None, v))
            if a in teams and v in teams and teams[a] != teams[v]:
                if opening:
                    stats[a]['opening'] += 1
                    stats[v]['opening'] -= 1
                    opening = False
                kills[a] += 1
                credited.add(a)
                if teams.get(e.assister_steamid) == teams[a]:
                    credited.add(e.assister_steamid)
                credited.update(dead for tick, dead, killer in deaths if killer == v and e.tick - tick <= 320)
                deaths.append((e.tick, v, a))
                if e.weapon in GUNS:
                    lethal[a, v].append(e.tick)
            for team in (0, 1):
                remaining = [p for p in alive if teams[p] == team]
                if len(remaining) == 1 and any(teams[p] != team for p in alive):
                    candidates.add(remaining[0])
        for p in teams:
            stats[p]['kast'] += int(p in credited or p in alive)
            stats[p]['multi'] += int(kills[p] >= 3)
            stats[p]['clutch'] += int(p in candidates and teams[p] == winning)
        for e in live_events('player_blind'):
            if e.attacker_steamid in teams and e.user_steamid in teams and teams[e.attacker_steamid] != teams[e.user_steamid] and e.blind_duration >= 1:
                stats[e.attacker_steamid]['flashed'] += 1
        for e in live_events('weapon_fire'):
            if e.user_steamid in teams and e.weapon.removeprefix('weapon_') in GUNS:
                shots[e.user_steamid].append(e.tick)
        hit_ticks = defaultdict(set)
        for e in live_events('player_hurt'):
            a, v = e.attacker_steamid, e.user_steamid
            if a in teams and v in teams and teams[a] != teams[v] and e.weapon in GUNS:
                damage[a, v].append(e.tick)
                hit_ticks[a].add(e.tick)
        for p, fired in shots.items():
            stats[p]['shots'] += len(fired)
            stats[p]['hits'] += len(set(fired) & hit_ticks[p])
        active = {}
        def finish(pair, until):
            t, angle = active[pair]
            a, v = pair
            samples[a]['preaim'].append(angle)
            for label, series in [('tts', shots[a]), ('ttd', damage[pair]), ('ttk', lethal[pair])]:
                i = bisect_left(series, t)
                if i < len(series) and series[i] < until:
                    samples[a][label].append((series[i] - t) / 64)
        for tick, group in sorted(by_tick.items()):
            seen = set()
            for v, target in group.items():
                if not target.is_alive or target.spotters is None:
                    continue
                for identifier in target.spotters:
                    a = str(identifier)
                    eye = group.get(a)
                    if not eye or not eye.is_alive or teams[a] == teams[v]:
                        continue
                    pair = (a, v)
                    seen.add(pair)
                    if pair in active:
                        continue
                    dx, dy = target.X - eye.X, target.Y - eye.Y
                    dz = target.Z - eye.Z - 18 * (target.duck_amount - eye.duck_amount)
                    length = hypot(dx, dy, dz)
                    yaw, pitch = radians(eye.yaw), radians(eye.pitch)
                    if length and all(map(isfinite, [length, pitch, yaw])):
                        dot = (cos(pitch)*(dx*cos(yaw)+dy*sin(yaw))-dz*sin(pitch))/length
                        active[pair] = (tick, degrees(acos(max(-1, min(1, dot)))))
            for pair in active.keys() - seen:
                finish(pair, tick+1)
                del active[pair]
        for pair in active:
            finish(pair, end+1)
    for p, result in stats.items():
        result['aim'] = {key: {'n': len(values), 'mean': round(sum(values)/len(values), 3)} for key, values in samples[p].items() if values}
    if [sum(s['wins'][i] for s in segments) for i in (0, 1)] != [players[0]['scoreFor'], players[0]['scoreAgainst']]:
        segments = []
    premier = False
    if 'rank_update' in parser.list_game_events():
        for row in parser.parse_event('rank_update').sort_values('tick').itertuples():
            player = str(row.user_steamid)
            if player not in stats or row.rank_type_id != 11 or row.tick < ranges[-1][1]:
                continue
            premier = True
            if row.rank_new > 0:
                stats[player]['premierAfter'] = int(row.rank_new)
                if row.rank_old > 0:
                    stats[player]['premierDelta'] = int(row.rank_new - row.rank_old)
    return dict(version=ANALYSIS_VERSION, premier=premier, players=stats, segments=segments, kills=kill_map)


def position(e, prefix):
    values = [getattr(e, f'{prefix}_{axis}', None) for axis in 'XYZ']
    return [round(v) for v in values] if all(v is not None and isfinite(v) for v in values) else None


def kill_point(e, number, start, attacker, victim):
    """Uma morte do round: quem, com o quê, onde estavam (coordenadas do jogo) e o lado de cada um."""
    side = {2: 'T', 3: 'CT'}
    return dict(round=number, time=round((e.tick - start) / 64, 1), attacker=attacker, victim=victim,
                weapon=str(e.weapon or ''), headshot=bool(e.headshot),
                attackerPos=position(e, 'attacker') if attacker else None, victimPos=position(e, 'user'),
                attackerSide=side.get(getattr(e, 'attacker_team_num', None)) if attacker else None,
                victimSide=side.get(getattr(e, 'user_team_num', None)))
