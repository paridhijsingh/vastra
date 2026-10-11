"""Manual Nebius Nemotron smoke test.

Makes one paid chat completion. Pytest does not run this script.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

from vastra.nemotron import (
    NemotronConfigError,
    format_usage,
    parse_nemotron_env,
    run_styling_check,
)


def main() -> int:
    load_dotenv(ROOT / ".env")
    try:
        config = parse_nemotron_env()
        result = run_styling_check(config)
    except NemotronConfigError as exc:
        print(exc.message, file=sys.stderr)
        return 1

    if result.text:
        print(result.text)
    usage_line = format_usage(result.usage)
    if usage_line:
        print(usage_line)
    if not result.ok:
        print(result.message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
