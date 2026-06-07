#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${1:-/mnt/c/Dev/ClaudeDev}"

SOURCE="$(realpath "$SOURCE")"
ROOT="$(realpath "$ROOT")"
case "$SOURCE/" in
  "$ROOT/"*) echo "Source and atlas project must be separate directories: $SOURCE" >&2; exit 1 ;;
esac
case "$ROOT/" in
  "$SOURCE/"*) echo "Source and atlas project must be separate directories: $SOURCE" >&2; exit 1 ;;
esac

python3 -m py_compile "$ROOT/tools/analyze.py"
python3 "$ROOT/tools/analyze.py" \
  --source "$SOURCE" \
  --output "$ROOT/data/architecture-data.js" \
  --config "$ROOT/config/analysis-config.json"

echo "Generated $ROOT/data/architecture-data.js"
