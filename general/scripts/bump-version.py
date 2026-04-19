#!/usr/bin/env python3

"""
Bump version across all project files and update CHANGELOG.md.

Usage (from any directory):
    uv run general/scripts/bump-version.py <new_version>
    python3 general/scripts/bump-version.py <new_version>

Example:
    uv run general/scripts/bump-version.py 1.8.0
"""

import re
import sys
from datetime import date
from pathlib import Path


def replace_in_file(path: Path, pattern: str, replacement: str, flags: int = 0) -> None:
    text = path.read_text(encoding="utf-8")
    new_text, count = re.subn(pattern, replacement, text, flags=flags)
    if count == 0:
        print(f"  WARNING: no match for pattern in {path.relative_to(path.parent.parent.parent)}", file=sys.stderr)
    path.write_text(new_text, encoding="utf-8")


def update_changelog(path: Path, version: str, today: str) -> None:
    text = path.read_text(encoding="utf-8")

    # Promote [Unreleased] → [version] - today
    text = re.sub(r"^## \[Unreleased\]", f"## [{version}] - {today}", text, flags=re.MULTILINE)

    # Re-insert empty [Unreleased] section before the new versioned block
    text = re.sub(
        rf"(## \[{re.escape(version)}\])",
        "## [Unreleased]\n\n\\1",
        text,
        count=1,
    )

    # Update comparison links at the bottom
    m = re.search(
        r"^\[unreleased\]: (https://\S+/compare/)(\S+)\.\.\.HEAD",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if m:
        base_url = m.group(1)
        prev_version = m.group(2)
        text = re.sub(
            r"^\[unreleased\]:.*",
            f"[unreleased]: {base_url}{version}...HEAD\n[{version}]: {base_url}{prev_version}...{version}",
            text,
            count=1,
            flags=re.MULTILINE | re.IGNORECASE,
        )

    path.write_text(text, encoding="utf-8")


def _process_item(text: str) -> str:
    def backtick_to_code(m: re.Match) -> str:
        inner = m.group(1).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return f"<code>{inner}</code>"

    text = re.sub(r"`([^`]+)`", backtick_to_code, text)
    text = re.sub(r"\s*\(fixes #\d+\)", "", text)
    return text.strip()


def generate_changelog_model(changelog_path: Path, model_path: Path) -> None:
    lines = changelog_path.read_text(encoding="utf-8").splitlines()

    releases: list[dict] = []
    current_release: dict | None = None
    current_section: dict | None = None

    for line in lines:
        m = re.match(r"^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?", line)
        if m:
            if current_release is not None:
                if current_section and current_section["items"]:
                    current_release["sections"].append(current_section)
                if current_release["sections"]:
                    releases.append(current_release)
            current_release = {"version": m.group(1), "date": m.group(2), "sections": []}
            current_section = None
            continue

        m = re.match(r"^### (.+)", line)
        if m and current_release is not None:
            if current_section and current_section["items"]:
                current_release["sections"].append(current_section)
            current_section = {"type": m.group(1), "items": []}
            continue

        m = re.match(r"^- (.+)", line)
        if m and current_release is not None:
            if current_section is None:
                current_section = {"type": "Notes", "items": []}
            current_section["items"].append(_process_item(m.group(1)))

    if current_release is not None:
        if current_section and current_section["items"]:
            current_release["sections"].append(current_section)
        if current_release["sections"]:
            releases.append(current_release)

    out = [
        "export interface ChangelogSection {",
        "  type: string;",
        "  items: string[];",
        "}",
        "",
        "export interface ChangelogRelease {",
        "  version: string;",
        "  date?: string;",
        "  sections: ChangelogSection[];",
        "}",
        "",
        "export const CHANGELOG_DATA: ChangelogRelease[] = [",
    ]

    for r in releases:
        out.append("  {")
        out.append(f"    version: '{r['version']}',")
        if r["date"]:
            out.append(f"    date: '{r['date']}',")
        out.append("    sections: [")
        for s in r["sections"]:
            out.append("      {")
            out.append(f"        type: '{s['type']}',")
            out.append("        items: [")
            for item in s["items"]:
                escaped = item.replace("\\", "\\\\").replace("'", "\\'")
                out.append(f"          '{escaped}',")
            out.append("        ],")
            out.append("      },")
        out.append("    ],")
        out.append("  },")

    out.extend(["];", ""])
    model_path.write_text("\n".join(out), encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <new_version>")
        print()
        print(f"Example: {sys.argv[0]} 1.2.3")
        sys.exit(1)

    version = sys.argv[1]
    today = date.today().isoformat()

    # Resolve repo root relative to this script's location: general/scripts/ → ../../
    root = Path(__file__).resolve().parent.parent.parent

    print(f"Bumping version to {version} ...")

    replace_in_file(root / "frontend/package.json", r'"version": "[^"]*"', f'"version": "{version}"')
    replace_in_file(root / "backend/pyproject.toml", r'^version = "[^"]*"', f'version = "{version}"', re.MULTILINE)
    replace_in_file(root / "backend/main.py", r'version="[^"]*"', f'version="{version}"')
    replace_in_file(root / "database_migrations/pyproject.toml", r'^version = "[^"]*"', f'version = "{version}"', re.MULTILINE)
    replace_in_file(root / "backend/Dockerfile", r"^ARG IMAGE_VERSION=.*", f"ARG IMAGE_VERSION={version}", re.MULTILINE)
    replace_in_file(root / "database_migrations/Dockerfile", r"^ARG IMAGE_VERSION=.*", f"ARG IMAGE_VERSION={version}", re.MULTILINE)
    replace_in_file(root / "frontend/Dockerfile", r"^ARG IMAGE_VERSION=.*", f"ARG IMAGE_VERSION={version}", re.MULTILINE)
    replace_in_file(root / "helm/stickermap/Chart.yaml", r"^appVersion: .*", f'appVersion: "{version}"', re.MULTILINE)
    print("  Updated version in all project files")

    changelog_path = root / "CHANGELOG.md"
    update_changelog(changelog_path, version, today)
    print("  Updated CHANGELOG.md")

    model_path = root / "frontend/src/app/core/models/changelog.model.ts"
    generate_changelog_model(changelog_path, model_path)
    print("  Regenerated changelog.model.ts")

    print(f"Done. Version is now {version}.")


if __name__ == "__main__":
    main()
