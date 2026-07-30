import os

import pytest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["TRACKER_TOKEN"] = ""

from app.main import Base, engine


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield