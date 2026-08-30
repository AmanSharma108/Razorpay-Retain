import asyncio
import logging
from app.config import settings

logger = logging.getLogger(__name__)

async def check_abandoned_orders():
    logger.info("Checking for abandoned orders...")

async def start_abandonment_worker():
    interval = settings.ABANDONMENT_CHECK_INTERVAL_MINUTES * 60
    while True:
        await check_abandoned_orders()
        await asyncio.sleep(interval)
