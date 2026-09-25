from pathlib import Path

import pytest

from scripts import apply_migrations


class FakeCursor:
    def __init__(self, applied=None):
        self.applied = applied if applied is not None else {}
        self.pending_name = None
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))
        if sql.startswith("SELECT checksum"):
            self.pending_name = params[0]
        elif sql.startswith("INSERT INTO"):
            self.applied[params[0]] = params[1]

    def fetchone(self):
        digest = self.applied.get(self.pending_name)
        return (digest,) if digest else None


class FakeConnection:
    def __init__(self, applied=None):
        self.applied = applied if applied is not None else {}
        self.cursor_obj = FakeCursor(self.applied)
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def test_apply_migrations_is_idempotent_and_ordered(tmp_path: Path):
    (tmp_path / "002_second.sql").write_text("SELECT 2;", encoding="utf-8")
    (tmp_path / "001_first.sql").write_text("SELECT 1;", encoding="utf-8")
    connection = FakeConnection()

    applied, skipped = apply_migrations.apply_migrations(connection, tmp_path)
    assert (applied, skipped) == (2, 0)
    assert list(connection.applied) == ["001_first.sql", "002_second.sql"]

    applied, skipped = apply_migrations.apply_migrations(connection, tmp_path)
    assert (applied, skipped) == (0, 2)


def test_apply_migrations_rejects_checksum_drift(tmp_path: Path):
    path = tmp_path / "001_first.sql"
    path.write_text("SELECT 1;", encoding="utf-8")
    connection = FakeConnection({path.name: "wrong"})

    with pytest.raises(RuntimeError, match="checksum drift"):
        apply_migrations.apply_migrations(connection, tmp_path)
    assert connection.rollbacks == 1
