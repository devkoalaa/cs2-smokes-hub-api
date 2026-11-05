"""Parse a Valve replay. Reject incomplete scoreboards instead of inventing stats."""
import bz2
import json
import math
from pathlib import Path
import sys

FIELDS = ['kills_total', 'deaths_total', 'assists_total', 'headshot_kills_total', 'damage_total']

def integer(value, nullable=False):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        if nullable:
            return None
        raise ValueError('Missing statistic')
    number = int(value)
    if number < 0 or number != value:
        raise ValueError('Invalid statistic')
    return number

def scoreboard(records, roster):
    by_id = {str(row['steamid']): row for row in records}
    scores = roster['scores']
    rounds = sum(scores)
    result = []
    for player in roster['players']:
        row = by_id.get(player['steamId'])
        if row is None:
            raise ValueError('Incomplete demo roster')
        stats = {name: integer(row.get(field), name in ['headshots', 'damage']) for name, field in zip(['kills', 'deaths', 'assists', 'headshots', 'damage'], FIELDS)}
        for field in ['kills', 'deaths', 'assists']:
            if player.get(field) is None or stats[field] != player[field]:
                raise ValueError('Demo scoreboard differs from Valve final scoreboard')
        if stats['headshots'] is not None and stats['headshots'] > stats['kills']:
            raise ValueError('Invalid headshot count')
        team = player['team']
        result.append(dict(steamId=player['steamId'], name=str(row.get('name') or player['steamId'])[:128], team=team,
                           rounds=rounds, scoreFor=scores[team], scoreAgainst=scores[1-team], **stats))
    return result

def main():
    from demoparser2 import DemoParser
    compressed = Path(sys.argv[1])
    demo = compressed.with_suffix('')
    try:
        size = 0
        with bz2.open(compressed, 'rb') as source, demo.open('xb') as target:
            while block := source.read(1024 * 1024):
                size += len(block)
                if size > 2 * 1024 * 1024 * 1024:
                    raise ValueError('Uncompressed demo exceeds limit')
                target.write(block)
        parser = DemoParser(str(demo))
        ends = parser.parse_event('round_end')
        if ends.empty:
            raise ValueError('No completed rounds')
        tick = int(ends['tick'].max())
        rows = parser.parse_ticks(FIELDS, ticks=[tick]).to_dict('records')
        roster = json.load(sys.stdin)
        header = parser.parse_header()
        map_name = header.get('map_name')
        if not map_name:
            raise ValueError('Map not available')
        print(json.dumps({'map': map_name, 'players': scoreboard(rows, roster)}, allow_nan=False))
    finally:
        demo.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
