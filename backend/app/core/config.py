import os

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./spms.db")
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Smart Proxy Management System (SPMS)"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "*"]

settings = Settings()
