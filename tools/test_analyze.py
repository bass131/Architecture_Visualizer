#!/usr/bin/env python3
import pathlib
import tempfile
import unittest

from analyze import (
    Analyzer,
    clean_type,
    ensure_output_outside_source,
    layer_for,
    mask_non_code,
    matching_brace,
    split_params,
)


class AnalyzerUtilityTests(unittest.TestCase):
    def test_mask_non_code_preserves_structure_for_brace_matching(self) -> None:
        source = 'class Sample { string text = "}"; // }\n void Run() { } /* } */ }'
        masked = mask_non_code(source)

        self.assertEqual(source.count("\n"), masked.count("\n"))
        self.assertEqual(len(source), len(masked))
        self.assertEqual(source.rfind("}"), matching_brace(masked, source.index("{")))

    def test_type_and_parameter_normalization(self) -> None:
        self.assertEqual("Session", clean_type("global::Game.Network.Session?"))
        self.assertEqual(
            [{"name": "session", "type": "Session"}, {"name": "count", "type": "int"}],
            split_params("Session session, int count"),
        )

    def test_layer_mapping_uses_specific_roots_first(self) -> None:
        self.assertEqual("Server Tests", layer_for("02_Server/GameServer.Tests/Test.cs"))
        self.assertEqual("Game Server", layer_for("02_Server/GameServer/Loop.cs"))
        self.assertEqual("QA Tools", layer_for("99_Tools/headless-bot/Bot.cs"))

    def test_output_must_be_outside_source_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary).resolve()
            source = root / "source"
            source.mkdir()

            ensure_output_outside_source(source, root / "atlas" / "data.js")
            with self.assertRaises(ValueError):
                ensure_output_outside_source(source, source / "data" / "data.js")

    def test_test_files_can_be_excluded_from_analysis_input(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            source = root / "source"
            production = source / "Game"
            tests = source / "Game.Tests"
            production.mkdir(parents=True)
            tests.mkdir(parents=True)
            (production / "Player.cs").write_text("class Player {}", encoding="utf-8")
            (tests / "PlayerTests.cs").write_text("class PlayerTests {}", encoding="utf-8")
            config = {
                "sourceRoots": ["Game", "Game.Tests"],
                "testMarkers": [".Tests/", "Tests.cs"],
                "includeTests": False,
            }

            analyzer = Analyzer(source, config)
            analyzer.read_files()

            self.assertEqual(["Game/Player.cs"], [item.relative for item in analyzer.files])

            config["includeTests"] = True
            analyzer = Analyzer(source, config)
            analyzer.read_files()
            self.assertEqual(2, len(analyzer.files))
            self.assertTrue(any(item.is_test for item in analyzer.files))


if __name__ == "__main__":
    unittest.main()
