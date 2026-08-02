#!/usr/bin/env python3

"""
Bump version across all project files and update CHANGELOG.md.

CHANGELOG.md serves three audiences from one source. Each release opens with a
`### Highlights` section written in plain language for people using the app; the
`Added`/`Changed`/`Fixed`/`Security` sections below it are the technical record.

    Highlights only  → frontend/src/app/core/models/changelog.model.ts (in-app dialog)
    Highlights first,
    technical detail
    collapsed below   → GitHub release body (--release-notes)
    Everything        → CHANGELOG.md itself, for maintainers

Usage (from any directory):
    uv run general/scripts/bump-version.py <new_version>
    python3 general/scripts/bump-version.py <new_version>

    # Print the GitHub release body for an existing version; changes no files
    python3 general/scripts/bump-version.py <version> --release-notes

Example:
    uv run general/scripts/bump-version.py 1.8.0
"""

import argparse
import re
import sys
from datetime import date
from pathlib import Path

# The one section written for end users. Everything else in a release block is
# treated as maintainer-facing detail.
HIGHLIGHTS_SECTION = "Highlights"


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


def split_release_block(text: str, version: str) -> tuple[str, str] | None:
    """Split one release's body into (highlights markdown, technical markdown).

    Both halves are returned verbatim so nested bullets and multi-line entries
    survive — unlike the flat parse used for the in-app model. Returns None when
    the version has no section in the changelog.
    """
    m = re.search(
        rf"^## \[{re.escape(version)}\][^\n]*\n(.*?)(?=^## \[|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if m is None:
        return None

    body = m.group(1)
    highlights_re = rf"^### {HIGHLIGHTS_SECTION}\s*?\n(.*?)(?=^### |\Z)"

    hm = re.search(highlights_re, body, re.MULTILINE | re.DOTALL)
    highlights = hm.group(1).strip() if hm else ""
    technical = re.sub(highlights_re, "", body, flags=re.MULTILINE | re.DOTALL).strip()

    return highlights, technical


def compare_url(text: str, version: str) -> str | None:
    m = re.search(rf"^\[{re.escape(version)}\]: (\S+)", text, re.MULTILINE)
    return m.group(1) if m else None


def warn_if_no_highlights(changelog_path: Path, version: str) -> None:
    parts = split_release_block(changelog_path.read_text(encoding="utf-8"), version)
    if parts is None or parts[0]:
        return
    print(
        f"  WARNING: release {version} has no '### {HIGHLIGHTS_SECTION}' section.\n"
        f"           The in-app changelog dialog and the GitHub release notes will both be\n"
        f"           empty for this version. Add a few plain-language bullets to CHANGELOG.md\n"
        f"           and re-run this script to regenerate changelog.model.ts.",
        file=sys.stderr,
    )


def generate_release_notes(changelog_path: Path, version: str) -> str:
    """Build the GitHub release body: highlights first, technical detail collapsed."""
    text = changelog_path.read_text(encoding="utf-8")
    parts = split_release_block(text, version)
    if parts is None:
        print(f"Error: no '## [{version}]' section found in CHANGELOG.md", file=sys.stderr)
        sys.exit(1)

    highlights, technical = parts
    blocks: list[str] = []

    if highlights:
        blocks.append(highlights)
    else:
        print(f"WARNING: no '### {HIGHLIGHTS_SECTION}' section for {version}", file=sys.stderr)

    if technical:
        blocks.append(f"<details>\n<summary>Technical details</summary>\n\n{technical}\n\n</details>")

    url = compare_url(text, version)
    if url:
        blocks.append(f"**Full changelog:** {url}")

    return "\n\n".join(blocks) + "\n"


def _process_item(text: str) -> str:
    def backtick_to_code(m: re.Match) -> str:
        inner = m.group(1).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return f"<code>{inner}</code>"

    text = re.sub(r"`([^`]+)`", backtick_to_code, text)
    # The dialog binds items with [innerHTML], so markdown emphasis has to become
    # real tags or it renders as literal asterisks.
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\s*\(fixes #\d+\)", "", text)
    return text.strip()


def generate_changelog_model(changelog_path: Path, model_path: Path) -> None:
    """Emit changelog.model.ts from the `### Highlights` sections only.

    Everything else in CHANGELOG.md is maintainer-facing and never reaches the
    in-app dialog. Only top-level bullets are picked up, so highlights must be
    flat — nested bullets would be silently dropped.
    """
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

    # Drop the technical sections — the dialog is end-user facing.
    for release in releases:
        release["sections"] = [s for s in release["sections"] if s["type"] == HIGHLIGHTS_SECTION]
    releases = [r for r in releases if r["sections"]]

    out = [
        "// Generated by general/scripts/bump-version.py from the `### Highlights`",
        "// sections of CHANGELOG.md. Do not edit by hand.",
        "",
        "export interface ChangelogRelease {",
        "  version: string;",
        "  date?: string;",
        "  items: string[];",
        "}",
        "",
        "export const CHANGELOG_DATA: ChangelogRelease[] = [",
    ]

    for r in releases:
        items = [item for section in r["sections"] for item in section["items"]]
        out.append("  {")
        out.append(f"    version: '{r['version']}',")
        if r["date"]:
            out.append(f"    date: '{r['date']}',")
        out.append("    items: [")
        for item in items:
            escaped = item.replace("\\", "\\\\").replace("'", "\\'")
            out.append(f"      '{escaped}',")
        out.append("    ],")
        out.append("  },")

    out.extend(["];", ""])
    model_path.write_text("\n".join(out), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bump the project version everywhere, or print GitHub release notes.",
        epilog="Example: %(prog)s 1.2.3",
    )
    parser.add_argument("version", help="Version to bump to, or to render notes for (X.Y.Z)")
    parser.add_argument(
        "--release-notes",
        action="store_true",
        help="Print the GitHub release body for <version> to stdout and exit. Changes no files.",
    )
    args = parser.parse_args()

    version = args.version
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        print(f"Error: '{version}' is not a valid version (expected X.Y.Z)")
        sys.exit(1)

    # Resolve repo root relative to this script's location: general/scripts/ → ../../
    root = Path(__file__).resolve().parent.parent.parent
    changelog_path = root / "CHANGELOG.md"

    if args.release_notes:
        sys.stdout.write(generate_release_notes(changelog_path, version))
        return

    today = date.today().isoformat()

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

    changelog_text = changelog_path.read_text(encoding="utf-8")
    if re.search(rf"^## \[{re.escape(version)}\]", changelog_text, re.MULTILINE):
        print(f"  Version {version} already in CHANGELOG.md — skipping changelog update")
    else:
        update_changelog(changelog_path, version, today)
        print("  Updated CHANGELOG.md")

    warn_if_no_highlights(changelog_path, version)

    model_path = root / "frontend/src/app/core/models/changelog.model.ts"
    generate_changelog_model(changelog_path, model_path)
    print("  Regenerated changelog.model.ts")

    print(f"Done. Version is now {version}.")


if __name__ == "__main__":
    main()
