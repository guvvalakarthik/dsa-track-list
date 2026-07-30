import os
import subprocess
import sys

from sqlalchemy import create_engine, inspect, text


def run_migration(database_path):
    environment = os.environ.copy()
    environment["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    return subprocess.run(
        [sys.executable, "-m", "scripts.migrate"],
        cwd=database_path.parent.parent,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_migration_creates_fresh_schema(tmp_path):
    database_path = tmp_path / "fresh.db"
    environment = os.environ.copy()
    environment["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"
    result = subprocess.run(
        [sys.executable, "-m", "scripts.migrate"],
        cwd=os.path.dirname(os.path.dirname(__file__)),
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr

    migrated_engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    tables = set(inspect(migrated_engine).get_table_names())
    assert {"alembic_version", "import_jobs", "problems", "sync_runs"}.issubset(tables)
    with migrated_engine.connect() as connection:
        revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
    assert revision == "20260730_02"
    migrated_engine.dispose()

    schema_check = subprocess.run(
        [sys.executable, "-m", "alembic", "check"],
        cwd=os.path.dirname(os.path.dirname(__file__)),
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert schema_check.returncode == 0, schema_check.stderr or schema_check.stdout