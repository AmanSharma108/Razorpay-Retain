from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App & Environment
    APP_NAME: str = "Razorpay Retain Revenue Recovery Orchestrator"
    ENVIRONMENT: str = "development"  # development, staging, production
    LOG_LEVEL: str = "INFO"
    ENABLE_DOCS: bool = True
    
    # Razorpay Gateway Configuration
    RAZORPAY_KEY_ID: str = "rzp_test_XXXXXXXXXXXXXX"
    RAZORPAY_KEY_SECRET: str = "XXXXXXXXXXXXXX"
    RAZORPAY_WEBHOOK_SECRET: str = ""
    PUBLIC_WEBHOOK_URL: str = ""
    
    # Database Settings
    DATABASE_URL: str = "sqlite+aiosqlite:///./revenue_recovery.db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    
    # CORS & Security
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: Union[str, List[str]] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
    RATE_LIMIT_PER_MINUTE: int = 120
    RATE_LIMIT_BURST: int = 30
    
    # Intervals & Thresholds
    ABANDONMENT_CHECK_INTERVAL_MINUTES: int = 1
    ABANDONMENT_THRESHOLD_MINUTES: int = 1  # 1 min for fast test/demo mode
    POLLING_INTERVAL_SECONDS: int = 20
    HEALTH_CHECK_TIMEOUT_SECONDS: int = 5

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()

