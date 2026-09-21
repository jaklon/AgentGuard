import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app


@pytest.fixture(autouse=True)
def test_database():
    test_engine = create_engine(
        "sqlite://",
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
    )

    TestSessionLocal = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
    )

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    original_ai_provider = settings.ai_provider
    settings.ai_provider = "mock"

    app.dependency_overrides[get_db] = override_get_db

    yield

    settings.ai_provider = original_ai_provider
    app.dependency_overrides.clear()

    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()