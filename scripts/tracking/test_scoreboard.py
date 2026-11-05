import unittest
from parse_demo import scoreboard

class ScoreboardTests(unittest.TestCase):
    def setUp(self):
        self.roster = {'scores': [13, 7], 'players': [{'steamId': '76561198143147452', 'team': 0, 'kills': 20, 'deaths': 10, 'assists': 3}]}
        self.rows = [{'steamid': '76561198143147452', 'name': 'koala', 'kills_total': 20, 'deaths_total': 10, 'assists_total': 3, 'damage_total': 1700, 'headshot_kills_total': 8}]
    def test_preserves_steamid_and_score(self):
        row = scoreboard(self.rows, self.roster)[0]
        self.assertEqual(row['steamId'], '76561198143147452')
        self.assertEqual(row['rounds'], 20)
        self.assertEqual(row['scoreFor'], 13)
    def test_rejects_partial_demo(self):
        self.rows[0]['kills_total'] = 19
        with self.assertRaises(ValueError): scoreboard(self.rows, self.roster)
    def test_missing_damage_is_not_zero(self):
        del self.rows[0]['damage_total']
        self.assertIsNone(scoreboard(self.rows, self.roster)[0]['damage'])
    def test_missing_player_is_error(self):
        with self.assertRaises(ValueError): scoreboard([], self.roster)

if __name__ == '__main__': unittest.main()
