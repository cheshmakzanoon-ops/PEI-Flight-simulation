import importlib.util
from pathlib import Path
import unittest
from osgeo import gdal

spec = importlib.util.spec_from_file_location('audit', Path(__file__).with_name('audit-osm-surface-history.py'))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def way(v, year, label, nodes=(1, 2, 3, 4, 1)):
    return {'type': 'way', 'id': 21, 'version': v, 'timestamp': f'{year}-01-01T00:00:00Z',
            'tags': {'surface': label} if label else {}, 'nodes': list(nodes)}


def node(n, lon, lat, v=1, year=2020):
    return {'type': 'node', 'id': n, 'version': v,
            'timestamp': f'{year}-01-01T00:00:00Z', 'lon': lon, 'lat': lat}


class SurfaceHistory(unittest.TestCase):
    def setUp(self):
        self.nodes = [node(1,-63.12,46.23), node(2,-63.119,46.23),
                      node(3,-63.119,46.231), node(4,-63.12,46.231)]
        self.times = [way(1,2020,None), way(2,2021,'concrete'),way(3,2025,'concrete')]

    def report(self, ways=None, nodes=None, at='2026-11-26T00:00:00Z'):
        return audit.compare(ways or self.times, nodes or self.nodes,21,at)

    def test_carried_surface_uses_assignment_epoch(self):
        outcome = self.report()
        self.assertEqual(outcome['mostRecentAssignment']['wayVersion'], 2)
        self.assertEqual(outcome['observedOutline']['wayVersion'], 3)
        self.assertAlmostEqual(outcome['overlapOfObserved'], 1)
        self.assertAlmostEqual(outcome['areaAddedSinceTagM2'], 0)

    def test_node_motion_does_not_need_another_way_edit(self):
        moved = self.nodes + [node(2,-63.1187,46.23,2,2026),node(3,-63.1187,46.231,2,2026)]
        outcome = self.report(nodes=moved)
        self.assertEqual(outcome['observedOutline']['nodeVersions'], [[1,1],[2,2],[3,2],[4,1]])
        self.assertEqual(outcome['mostRecentAssignment']['nodeVersions'], [[1,1],[2,1],[3,1],[4,1]])
        self.assertGreater(outcome['areaAddedSinceTagM2'], 2100)
        self.assertLess(outcome['overlapOfObserved'], .80)

    def test_retag_and_date_filter(self):
        ways = self.times + [way(4,2026,'gravel'),way(5,2027,'concrete')]
        self.assertEqual(self.report(ways)['surfaceTag'], 'gravel')
        self.assertEqual(self.report(ways,at='2028-01-01T00:00:00Z')['mostRecentAssignment']['wayVersion'],5)

    def test_divergent_way_geometry(self):
        outer = self.nodes + [node(5,-63.1188,46.23),node(6,-63.1188,46.231)]
        ways = [*self.times[:2],way(3,2025,'concrete',(1,5,6,4,1))]
        result = self.report(ways,outer)
        self.assertGreater(result['areaAddedSinceTagM2'], 1600)
        self.assertAlmostEqual(result['areaLostSinceTagM2'], 0, places=2)

    def test_missing_history_or_open_path_refused(self):
        with self.assertRaisesRegex(ValueError, 'Incomplete'):
            self.report([self.times[0],self.times[2]])
        with self.assertRaisesRegex(ValueError, 'Missing or oversized history'):
            self.report(nodes=self.nodes[:3])
        with self.assertRaisesRegex(ValueError, 'closed OSM way'):
            self.report([*self.times[:2],way(3,2025,'concrete',(1,2,3,4))])

    def test_bow_tie_refused(self):
        gdal.PushErrorHandler('CPLQuietErrorHandler')
        try:
            with self.assertRaisesRegex(ValueError, 'invalid'):
                self.report([*self.times[:2],way(3,2025,'concrete',(1,3,2,4,1))])
        finally:
            gdal.PopErrorHandler()


if __name__ == '__main__':
    unittest.main()
