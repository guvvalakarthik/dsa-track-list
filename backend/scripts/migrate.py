from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.database import engine


def migrate() -> None:
    config = Config("alembic.ini")
    tables = set(inspect(engine).get_table_names())
    core_tables = {"problems", "sync_runs"}
    if core_tables.issubset(tables) and "alembic_version" not in tables:
        command.stamp(config, "head")
    else:
        command.upgrade(config, "head")


if __name__ == "__main__":
    migrate()