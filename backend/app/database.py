from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


engine = create_engine(
    settings.database_url,
    connect_args={
        "check_same_thread": False,
        "timeout": 30,
    },
)


@event.listens_for(engine, "connect")
def configure_sqlite_connection(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()

    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")

    cursor.close()


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()