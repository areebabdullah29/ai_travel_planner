from datetime import datetime
from bson import ObjectId
import bcrypt

from app import mongo


class UserModel:
    """User model for database operations"""

    collection_name = 'users'

    @staticmethod
    def get_collection():
        return mongo.db[UserModel.collection_name]

    @staticmethod
    def create_user(name: str, email: str, password: str, preferences: dict = None) -> dict:
        """Create a new user"""
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        user = {
            'name': name,
            'email': email.lower(),
            'password': hashed_password,
            'preferences': preferences or {
                'budgetRange': {'min': 10000, 'max': 50000},
                'travelStyles': [],
                'preferredRegions': [],
                'tripDuration': 5
            },
            'role': 'user',
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }

        result = UserModel.get_collection().insert_one(user)
        user['_id'] = result.inserted_id
        return UserModel.serialize(user)

    @staticmethod
    def find_by_email(email: str) -> dict:
        """Find user by email"""
        user = UserModel.get_collection().find_one({'email': email.lower()})
        return user

    @staticmethod
    def find_by_id(user_id: str) -> dict:
        """Find user by ID"""
        try:
            user = UserModel.get_collection().find_one({'_id': ObjectId(user_id)})
            return user
        except Exception:
            return None

    @staticmethod
    def verify_password(stored_password: bytes, provided_password: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password)

    @staticmethod
    def update_preferences(user_id: str, preferences: dict) -> dict:
        """Update user preferences"""
        result = UserModel.get_collection().find_one_and_update(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'preferences': preferences,
                    'updatedAt': datetime.utcnow()
                }
            },
            return_document=True
        )
        return UserModel.serialize(result) if result else None

    @staticmethod
    def update_profile(user_id: str, data: dict) -> dict:
        """Update user profile"""
        update_data = {'updatedAt': datetime.utcnow()}

        if 'name' in data:
            update_data['name'] = data['name']
        if 'preferences' in data:
            update_data['preferences'] = data['preferences']

        result = UserModel.get_collection().find_one_and_update(
            {'_id': ObjectId(user_id)},
            {'$set': update_data},
            return_document=True
        )
        return UserModel.serialize(result) if result else None

    @staticmethod
    def serialize(user: dict) -> dict:
        """Convert user document to JSON-serializable format"""
        if not user:
            return None

        return {
            'id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'preferences': user.get('preferences', {}),
            'role': user.get('role', 'user'),
            'createdAt': user.get('createdAt', datetime.utcnow()).isoformat()
        }
