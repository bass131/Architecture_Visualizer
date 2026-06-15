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
    def analyze_sources(self, sources: dict[str, str], thresholds: dict | None = None) -> dict:
        with tempfile.TemporaryDirectory() as temporary:
            source = pathlib.Path(temporary)
            for relative, content in sources.items():
                path = source / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            return Analyzer(source, {
                "sourceRoots": ["Game"],
                "includeTests": False,
                "testMarkers": ["Tests.cs"],
                "generatedMarkers": ["/Generated/"],
                "solidThresholds": thresholds or {},
            }).run()

    def analyze_fixtures(self) -> dict:
        fixture_root = pathlib.Path(__file__).parent / "fixtures"
        sources = {f"Game/{path.name}": path.read_text(encoding="utf-8") for path in fixture_root.glob("*.cs")}
        return self.analyze_sources(sources, {
            "classReviewLines": 12,
            "godClassLines": 20,
            "interfaceMembers": 10,
            "fanOut": 50,
            "fanIn": 0,
            "concreteDependencies": 50,
            "longMethodLines": 12,
            "delegationDensityContainer": 0.4,
            "decisionDensityVeto": 0.12,
            "decisionCountVeto": 3,
            "decisionHeavyMethodTokens": 3,
            "decisionHeavyMethodRatioVeto": 0.15,
            "stateCentralityContainer": 0.55,
            "stateContainerFields": 5,
            "stateContainerLongMethods": 1,
            "collaboratorFanOutContainer": 0.4,
            "fieldSharingCohesionContainer": 0.45,
            "containerEvidenceMinimum": 3,
            "fieldClusterReview": 2,
        })

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
        self.assertEqual("Server", layer_for("02_Server/GameServer/Loop.cs"))
        self.assertEqual("Client", layer_for("03_Client/Assets/Scripts/Player.cs"))
        self.assertEqual("ClientNet", layer_for("04_ClientNet/ClientSession.cs"))
        self.assertEqual("Shared", layer_for("98_Shared/Protocol/Packet.cs"))
        self.assertEqual("Tool", layer_for("99_Tools/PacketGenerator/Program.cs"))
        self.assertEqual("Other", layer_for("99_Tools/headless-bot/Bot.cs"))

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

    def test_configured_roots_can_limit_tools_to_packet_generator(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = pathlib.Path(temporary)
            paths = (
                "02_Server/GameServer/Server.cs",
                "03_Client/Assets/Scripts/Client.cs",
                "04_ClientNet/ClientSession.cs",
                "98_Shared/Protocol/Packet.cs",
                "99_Tools/PacketGenerator/Program.cs",
                "99_Tools/headless-bot/Bot.cs",
                "99_Tools/BgmComposer/Composer.cs",
            )
            for relative in paths:
                path = source / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("class Sample {}", encoding="utf-8")

            analyzer = Analyzer(source, {
                "sourceRoots": [
                    "02_Server",
                    "03_Client/Assets/Scripts",
                    "04_ClientNet",
                    "98_Shared",
                    "99_Tools/PacketGenerator",
                ],
                "includeTests": False,
                "testMarkers": [".Tests/", "/Tests/", "Tests.cs"],
            })
            analyzer.read_files()

            self.assertEqual(
                sorted(paths[:5]),
                sorted(item.relative for item in analyzer.files),
            )

    def test_responsibilities_ignore_comments_and_string_literals(self) -> None:
        data = self.analyze_sources({
            "Game/Sample.cs": '''
class Sample
{
    // attack combat damage cooldown stageclear
    private string Description => "attack combat damage cooldown stageclear";
    public void Run() { }
}
''',
        })

        sample = next(item for item in data["types"] if item["name"] == "Sample")
        self.assertEqual([], sample["responsibilities"])

    def test_every_diagnostic_has_a_category_and_summary_counts_match(self) -> None:
        data = self.analyze_sources({
            "Game/Inheritance.cs": '''
class Base { }
class Middle : Base { }
class Deep : Middle { }
class MutableState { public static int Count; }
''',
        })

        self.assertTrue(data["diagnostics"])
        self.assertEqual(
            {"issue", "recommendation"},
            {item["category"] for item in data["diagnostics"]},
        )
        self.assertEqual(
            len(data["diagnostics"]),
            data["summary"]["issueCount"] + data["summary"]["recommendationCount"] + data["summary"]["informationalCount"],
        )

    def test_structural_ground_truth_fixtures(self) -> None:
        data = self.analyze_fixtures()
        diagnostics_by_type = {}
        for diagnostic in data["diagnostics"]:
            diagnostics_by_type.setdefault(diagnostic["typeName"], []).append(diagnostic)
        types = {item["name"]: item for item in data["types"]}

        for name in ("TickCoordinator", "StateAggregate", "ProtocolAdapter"):
            srp = [item for item in diagnostics_by_type.get(name, []) if item["principle"] == "SRP"]
            self.assertTrue(srp, name)
            self.assertTrue(types[name]["structureMetrics"]["containerLike"], name)
            self.assertFalse(any(item["severity"] == "high" for item in srp), name)
            self.assertTrue(all(item["category"] == "recommendation" for item in srp), name)

        translator_srp = [item for item in diagnostics_by_type.get("IntentTranslator", []) if item["principle"] == "SRP"]
        self.assertEqual([], translator_srp)

        prediction_srp = [item for item in diagnostics_by_type.get("PredictionWorkspace", []) if item["principle"] == "SRP"]
        self.assertTrue(any(item["severity"] == "high" and item["category"] == "recommendation" for item in prediction_srp))

        contract = diagnostics_by_type.get("ContractBypassAction", [])
        self.assertTrue(any(item["principle"] == "LSP" and item["category"] == "issue" for item in contract))

        hybrid_srp = [item for item in diagnostics_by_type.get("HybridCoordinator", []) if item["principle"] == "SRP"]
        self.assertTrue(types["HybridCoordinator"]["structureMetrics"]["decisionVeto"])
        self.assertFalse(types["HybridCoordinator"]["structureMetrics"]["containerLike"])
        self.assertTrue(any(item["severity"] == "high" for item in hybrid_srp))

    def test_fan_in_is_informational_and_field_clusters_are_not_issues(self) -> None:
        data = self.analyze_fixtures()
        fan_in = [item for item in data["diagnostics"] if item["title"] == "High incoming coupling"]
        cluster_signals = [item for item in data["diagnostics"] if item["title"] == "Separated field-sharing clusters"]

        self.assertTrue(fan_in)
        self.assertTrue(all(item["category"] == "informational" for item in fan_in))
        self.assertTrue(cluster_signals)
        self.assertTrue(all(item["category"] == "recommendation" for item in cluster_signals))


if __name__ == "__main__":
    unittest.main()
