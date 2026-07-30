import os

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.main import Base, Problem


@pytest.mark.integration
def test_models_round_trip_on_postgresql():
    database_url = os.getenv("TEST_POSTGRES_DATABASE_URL")
    if not database_url:
        pytest.skip("TEST_POSTGRES_DATABASE_URL is not configured")

    postgres_engine = create_engine(database_url, pool_pre_ping=True)
    Base.metadata.create_all(postgres_engine)
    slug = "postgres-compatibility-check"

    with Session(postgres_engine) as session:
        existing = session.scalar(
            select(Problem).where(
                Problem.platform == "leetcode", Problem.slug == slug
            )
        )
        if existing:
            session.delete(existing)
            session.commit()
        session.add(
            Problem(
                platform="leetcode",
                slug=slug,
                title="PostgreSQL Compatibility Check",
                url=f"https://leetcode.com/problems/{slug}/",
                topics_json='["Arrays"]',
                auto_solved=True,
            )
        )
        session.commit()

    with Session(postgres_engine) as session:
        problem = session.scalar(select(Problem).where(Problem.slug == slug))
        assert problem is not None
        assert problem.solved is True
        assert problem.topics == ["Arrays"]
        session.delete(problem)
        session.commit()

    postgres_engine.dispose()