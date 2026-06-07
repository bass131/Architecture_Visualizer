#!/usr/bin/env python3
import pathlib
import tempfile

from analyze import ensure_output_outside_source


def main() -> int:
    with tempfile.TemporaryDirectory() as temporary:
        root = pathlib.Path(temporary).resolve()
        source = root / "source"
        source.mkdir()

        ensure_output_outside_source(source, root / "atlas" / "architecture-data.js")

        try:
            ensure_output_outside_source(source, source / "data" / "architecture-data.js")
        except ValueError:
            pass
        else:
            raise AssertionError("Analyzer accepted an output path inside the source tree")

    print("Verified analyzer source/output boundary.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
