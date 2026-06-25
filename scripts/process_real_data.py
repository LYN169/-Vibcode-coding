"""CLI entrypoint for non-destructive real-data processing and diagnostics."""

from __future__ import annotations

import json
import argparse
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from src.real_data_pipeline import process_real_data  # noqa: E402


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Build isolated real-data outputs without modifying raw inputs."
    )
    parser.add_argument(
        "--output-root",
        default=None,
        help="Output directory relative to the project, for example outputs/real_data_v2.",
    )
    args = parser.parse_args()
    result = process_real_data(PROJECT_DIR, output_root=args.output_root)
    print(json.dumps(result.summary, ensure_ascii=False, indent=2, default=str))
    print("OUTPUTS")
    for output in result.output_files:
        print(output)
