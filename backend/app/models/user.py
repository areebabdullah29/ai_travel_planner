from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import bcrypt
from typing import Optional, Dict, Any


class UserModel:
    """User model for async MongoDB operations"""

    collection_name = "users"

    @staticmethod
    def _get_collection(db: AsyncIOMotorDatabase):
        return db[UserModel.collection_name]

    @staticmethod
    async def create_user(
        db: AsyncIOMotorDatabase,
        name: str,
        email: str,
        password: str,
        preferences: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new user"""
        hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

        user = {
            "name": name,
            "email": email.lower(),
            "password": hashed_password,
            "preferences": preferences
            or {
                "budgetRange": {"min": 10000, "max": 50000},
                "travelStyles": [],
                "preferredRegions": [],
                "tripDuration": 5,
            },
            "role": "user",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        result = await UserModel._get_collection(db).insert_one(user)
        user["_id"] = result.inserted_id
        return UserModel.serialize(user)

    @staticmethod
    async def find_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[Dict[str, Any]]:
        """Find user by email"""
        user = await UserModel._get_collection(db).find_one({"email": email.lower()})
        return user

    @staticmethod
    async def find_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[Dict[str, Any]]:
        """Find user by ID"""
        try:
            user = await UserModel._get_collection(db).find_one({"_id": ObjectId(user_id)})
            return user
        except Exception:
            return None

    @staticmethod
    def verify_password(stored_password: bytes, provided_password: str) -> bool:
        """Verify password against hash"""
        try:
            if isinstance(stored_password, bytes):
                return bcrypt.checkpw(provided_password.encode("utf-8"), stored_password)
            else:
                return bcrypt.checkpw(
                    provided_password.encode("utf-8"), stored_password.encode("utf-8")
                )
        except Exception:
            return False

    @staticmethod
    async def update_preferences(
        db: AsyncIOMotorDatabase, user_id: str, preferences: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update user preferences"""
        result = await UserModel._get_collection(db).find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": {"preferences": preferences, "updatedAt": datetime.utcnow()}},
            return_document=True,
        )
        return UserModel.serialize(result) if result else None

    @staticmethod
    async def update_profile(
        db: AsyncIOMotorDatabase, user_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update user profile"""
        update_data = {"updatedAt": datetime.utcnow()}

        if "name" in data:
            update_data["name"] = data["name"]
        if "preferences" in data:
            update_data["preferences"] = data["preferences"]

        result = await UserModel._get_collection(db).find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True,
        )
        return UserModel.serialize(result) if result else None

    @staticmethod
    def serialize(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Convert user document to JSON-serializable format"""
        if not user:
            return None

        return {
            "id": str(user["_id"]),
            "_id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "preferences": user.get("preferences", {}),
            "role": user.get("role", "user"),
            "createdAt": user.get("createdAt", datetime.utcnow()).isoformat()
            if user.get("createdAt")
            else None,
        }
