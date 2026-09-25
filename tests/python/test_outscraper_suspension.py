import ast
from pathlib import Path
import unittest
from unittest.mock import Mock

import _helpers  # noqa: F401
from ownercell.scrape import outscraper
from ownercell.errors import Frozen


class OutscraperSuspension(unittest.TestCase):
    def test_blocks_before_network_or_meter(self):
        request, meter, sleep = Mock(), Mock(), Mock()
        with self.assertRaisesRegex(Frozen, 'Outscraper paid searches are disabled'):
            outscraper(['Roofing in Miami, FL'], 50, 'synthetic', meter, get=request, sleep=sleep)
        request.assert_not_called()
        meter.check.assert_not_called()
        meter.charge.assert_not_called()
        sleep.assert_not_called()

    def test_historical_executable_cannot_bypass_suspension(self):
        # Isolate the function without running the historical script's setup.
        source = Path(__file__).resolve().parents[2] / 'handoff' / 'engine.py'
        function = next(n for n in ast.parse(source.read_text()).body
                        if isinstance(n, ast.FunctionDef) and n.name == 'outscraper')
        request = Mock()

        def die(message):
            raise RuntimeError(message)

        namespace = {'die': die, 'get_json': request, 'ENV': {'OUTSCRAPER_API_KEY': 'synthetic'}}
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), 'exec'), namespace)
        with self.assertRaisesRegex(RuntimeError, 'Outscraper paid searches are disabled'):
            namespace['outscraper'](['Roofing in Miami, FL'], 50)
        request.assert_not_called()
