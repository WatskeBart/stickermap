#!/usr/bin/env python3
"""PostToolUse hook: keep lockfiles in sync when their manifest is edited.

Runs after Edit/Write/MultiEdit. Reads the tool input from stdin, looks at the
edited file path, and re-runs the appropriate lock command if the path matches
one of the project's manifests. Errors are swallowed so the hook never blocks.
"""

import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent.parent

TARGETS = {
    "backend/pyproject.toml": (["uv", "lock"], "backend"),
    "database_migrations/pyproject.toml": (["uv", "lock"], "database_migrations"),
    "frontend/package.json": (["pnpm", "install"], "frontend"),
}


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return

    file_path = data.get("tool_input", {}).get("file_path", "")
    if not file_path:
        return

    norm = file_path.replace("\\", "/")
    for suffix, (cmd, cwd) in TARGETS.items():
        if norm.endswith(suffix):
            subprocess.run(
                cmd,
                cwd=REPO_ROOT / cwd,
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
