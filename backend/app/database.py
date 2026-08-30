import logging
import time
from typing import AsyncGenerator, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.config import settings

logger = logging.getLogger(__name__)

# Engine configuration depending on DB dialect
engine_kwargs: Dict[str, Any] = {
    "echo": False,
    "pool_pre_ping": True,
}

if "sqlite" in settings.DATABASE_URL:
    # SQLite does not support standard queue pooling with overflow
    pass
else:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_timeout": settings.DB_POOL_TIMEOUT,
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

async def ping_db() -> Dict[str, Any]:
    """Pings database and measures latency for health checks."""
    start = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "connected", "latency_ms": latency_ms}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "disconnected", "error": str(e)}

async def init_db():
    import app.models  # Ensure models are imported for metadata registration
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Safe automated schema column migrations for existing SQLite/Postgres instances
        migrations = [
            "ALTER TABLE revenue_events ADD COLUMN razorpay_object_id VARCHAR",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_events_razorpay_object_id ON revenue_events(razorpay_object_id)",
            "ALTER TABLE diagnoses ADD COLUMN is_systemic BOOLEAN DEFAULT 0",
            "ALTER TABLE recovery_actions ADD COLUMN requires_human_review BOOLEAN DEFAULT 0",
            "ALTER TABLE recovery_actions ADD COLUMN review_status VARCHAR DEFAULT 'not_required'",
            "ALTER TABLE recovery_actions ADD COLUMN reviewed_by VARCHAR",
            "ALTER TABLE recovery_actions ADD COLUMN reviewed_at DATETIME",
            "ALTER TABLE recovery_actions ADD COLUMN review_reason TEXT",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

