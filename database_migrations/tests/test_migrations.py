"""Structural tests for Alembic migration scripts.

No live database is required. Tests verify:
  - The revision chain has a single head and no gaps.
  - Every migration exposes both upgrade() and downgrade().
  - Each migration touches the expected tables / columns.
"""

import inspect
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

MIGRATIONS_DIR = Path(__file__).parent.parent
ALEMBIC_INI = MIGRATIONS_DIR / "alembic.ini"

EXPECTED_REVISIONS = {"0001", "0002"}
EXPECTED_HEAD = "0002"


@pytest.fixture(scope="session")
def script_dir():
    cfg = Config(str(ALEMBIC_INI))
    return ScriptDirectory.from_config(cfg)


# ── Chain integrity ───────────────────────────────────────────────────────────


class TestRevisionChain:
    def test_single_head(self, script_dir):
        assert script_dir.get_heads() == [EXPECTED_HEAD]

    def test_all_expected_revisions_present(self, script_dir):
        ids = {r.revision for r in script_dir.walk_revisions()}
        assert ids == EXPECTED_REVISIONS

    def test_no_gaps(self, script_dir):
        """Every down_revision points to an existing revision."""
        revisions = {r.revision: r for r in script_dir.walk_revisions()}
        for rev in revisions.values():
            if rev.down_revision is not None:
                assert rev.down_revision in revisions, (
                    f"Revision {rev.revision} references missing "
                    f"down_revision {rev.down_revision}"
                )

    def test_base_revision_has_no_parent(self, script_dir):
        assert script_dir.get_revision("0001").down_revision is None


# ── Per-revision structure ────────────────────────────────────────────────────


class TestMigrationStructure:
    @pytest.mark.parametrize("revision_id", sorted(EXPECTED_REVISIONS))
    def test_has_upgrade(self, script_dir, revision_id):
        rev = script_dir.get_revision(revision_id)
        assert callable(getattr(rev.module, "upgrade", None))

    @pytest.mark.parametrize("revision_id", sorted(EXPECTED_REVISIONS))
    def test_has_downgrade(self, script_dir, revision_id):
        rev = script_dir.get_revision(revision_id)
        assert callable(getattr(rev.module, "downgrade", None))


# ── Migration content ─────────────────────────────────────────────────────────


class TestInitialSchema:
    def test_upgrade_enables_postgis(self, script_dir):
        src = inspect.getsource(script_dir.get_revision("0001").module.upgrade)
        assert "postgis" in src.lower()

    def test_upgrade_creates_stickers_table(self, script_dir):
        src = inspect.getsource(script_dir.get_revision("0001").module.upgrade)
        assert "stickers" in src

    def test_upgrade_creates_spatial_index(self, script_dir):
        src = inspect.getsource(script_dir.get_revision("0001").module.upgrade)
        assert "idx_stickers_location" in src

    def test_downgrade_drops_stickers_table(self, script_dir):
        src = inspect.getsource(script_dir.get_revision("0001").module.downgrade)
        assert "stickers" in src


class TestAddSpottedCount:
    def test_upgrade_adds_spotted_count(self, script_dir):
        src = inspect.getsource(script_dir.get_revision("0002").module.upgrade)
        assert "spotted_count" in src

    def test_downgrade_removes_spotted_count(self, script_dir):
        src = inspect.getsource(script_dir.get_revision("0002").module.downgrade)
        assert "spotted_count" in src
