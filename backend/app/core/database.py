from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import get_settings
from typing import Optional

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db():
    """Connect to MongoDB using Motor async driver"""
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.MONGO_URI)
    try:
        _db = _client.get_default_database()
    except Exception:
        # URI has no database name embedded — fall back to 'travel_buddy'
        _db = _client["travel_buddy"]
    print(f"Connected to MongoDB: {settings.MONGO_URI}")


async def close_db():
    """Close MongoDB connection"""
    global _client
    if _client:
        _client.close()
        print("Closed MongoDB connection")


def get_db() -> AsyncIOMotorDatabase:
    """Get the current database instance"""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
