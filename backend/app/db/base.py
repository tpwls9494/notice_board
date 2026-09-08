from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core.config import settings

engine_options = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.DATABASE_URL:
        # Share the same in-memory database across FastAPI worker threads in tests.
        engine_options["poolclass"] = StaticPool

engine = create_engine(settings.DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Ensure all models are imported so SQLAlchemy can resolve relationship strings.
import app.models  # noqa: E402,F401
