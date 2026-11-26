import importlib.util
from pathlib import Path
import unittest

import numpy as np

spec = importlib.util.spec_from_file_location('screen', Path(__file__).with_name('screen-aerial-joins.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


class AerialJoinTests(unittest.TestCase):
    def test_known_north_row_binding_and_east_column_bounds(self):
        self.assertEqual(s.cover_box(10,11,'x',457), (1407,1447,1408,1452))
        self.assertEqual(s.cover_box(21,16,'z',613), (2810,2101,2815,2102))
        with self.assertRaises(ValueError):
            s.cover_box(10,11,'y',457)

    def test_eligibility_accounts_for_every_cover_channel(self):
        cover = np.full((4,4,2), [40,255],dtype=np.uint8)
        self.assertTrue(s.eligible(cover,(1,1,2,2)))
        cover[2,2] = [30,148]
        self.assertTrue(s.eligible(cover,(1,1,2,2)))
        cover[2,2] = [30,147]
        self.assertFalse(s.eligible(cover,(1,1,2,2)))
        cover[2,2] = [50,255]
        self.assertFalse(s.eligible(cover,(1,1,2,2)))
        self.assertFalse(s.eligible(cover,(-1,1,2,2)))

    def test_rank_needs_persistent_discontinuity_not_one_hot_pixel(self):
        self.assertIsNone(s.rank_window([255]+[0]*15,[0]*16))
        self.assertIsNone(s.rank_window([47]*16,[39]*16))
        self.assertEqual(s.rank_window([47]*16,[14]*16)['score'],33)

    def test_nearby_windows_are_merged_but_other_neighbours_retained(self):
        def row(key, start, score):
            return dict(ownerTiles=key,alongWindow=[start],score=score)
        a,b=['1-2','2-2'],['1-2','1-3']
        rows=[row(a,12,44),row(a,15,40),row(a,36,28),row(b,15,39)]
        self.assertEqual(s.rank_distinct(rows,3),[rows[0],rows[3],rows[2]])

    def test_hash_drift_fails_closed(self):
        self.assertEqual(s.signed(b'x',s.hashlib.sha256(b'x').hexdigest(),'unit'),b'x')
        with self.assertRaisesRegex(ValueError,'fixture'):
            s.signed(b'x','not-an-authentic-identity','fixture')


if __name__ == '__main__':
    unittest.main()
