from datetime import datetime
from bson import ObjectId
from typing import List, Optional

from app import mongo


class DestinationModel:
    """Destination model for database operations"""

    collection_name = 'destinations'

    @staticmethod
    def get_collection():
        return mongo.db[DestinationModel.collection_name]

    @staticmethod
    def create(data: dict) -> dict:
        """Create a new destination"""
        destination = {
            'name': data['name'],
            'type': data['type'],
            'region': data['region'],
            'cost': data['cost'],
            'weather': data.get('weather', ''),
            'bestSeason': data.get('bestSeason', ''),
            'activities': data.get('activities', []),
            'safetyRating': data.get('safetyRating', 4),
            'userRating': data.get('userRating', 0),
            'image': data.get('image', ''),
            'description': data.get('description', ''),
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }

        result = DestinationModel.get_collection().insert_one(destination)
        destination['_id'] = result.inserted_id
        return DestinationModel.serialize(destination)

    @staticmethod
    def find_all(
        filters: dict = None,
        sort_by: str = 'userRating',
        sort_order: int = -1,
        limit: int = 50,
        skip: int = 0
    ) -> List[dict]:
        """Find all destinations with optional filtering"""
        query = {}

        if filters:
            if filters.get('type'):
                query['type'] = filters['type']
            if filters.get('region'):
                query['region'] = filters['region']
            if filters.get('maxBudget'):
                query['cost'] = {'$lte': filters['maxBudget']}
            if filters.get('minBudget'):
                if 'cost' in query:
                    query['cost']['$gte'] = filters['minBudget']
                else:
                    query['cost'] = {'$gte': filters['minBudget']}
            if filters.get('activities'):
                query['activities'] = {'$in': filters['activities']}

        destinations = DestinationModel.get_collection().find(query) \
            .sort(sort_by, sort_order) \
            .skip(skip) \
            .limit(limit)

        return [DestinationModel.serialize(d) for d in destinations]

    @staticmethod
    def find_by_id(destination_id: str) -> Optional[dict]:
        """Find destination by ID"""
        try:
            destination = DestinationModel.get_collection().find_one(
                {'_id': ObjectId(destination_id)}
            )
            return DestinationModel.serialize(destination) if destination else None
        except Exception:
            return None

    @staticmethod
    def update(destination_id: str, data: dict) -> Optional[dict]:
        """Update destination"""
        update_data = {'updatedAt': datetime.utcnow()}

        allowed_fields = [
            'name', 'type', 'region', 'cost', 'weather', 'bestSeason',
            'activities', 'safetyRating', 'userRating', 'image', 'description'
        ]

        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]

        result = DestinationModel.get_collection().find_one_and_update(
            {'_id': ObjectId(destination_id)},
            {'$set': update_data},
            return_document=True
        )
        return DestinationModel.serialize(result) if result else None

    @staticmethod
    def delete(destination_id: str) -> bool:
        """Delete destination"""
        try:
            result = DestinationModel.get_collection().delete_one(
                {'_id': ObjectId(destination_id)}
            )
            return result.deleted_count > 0
        except Exception:
            return False

    @staticmethod
    def search(query: str) -> List[dict]:
        """Search destinations by name or description"""
        regex_query = {'$regex': query, '$options': 'i'}
        destinations = DestinationModel.get_collection().find({
            '$or': [
                {'name': regex_query},
                {'description': regex_query},
                {'region': regex_query},
                {'activities': regex_query}
            ]
        }).limit(20)

        return [DestinationModel.serialize(d) for d in destinations]

    @staticmethod
    def get_regions() -> List[str]:
        """Get all unique regions"""
        return DestinationModel.get_collection().distinct('region')

    @staticmethod
    def get_types() -> List[str]:
        """Get all unique travel types"""
        return DestinationModel.get_collection().distinct('type')

    @staticmethod
    def serialize(destination: dict) -> Optional[dict]:
        """Convert destination document to JSON-serializable format"""
        if not destination:
            return None

        return {
            'id': str(destination['_id']),
            'name': destination['name'],
            'type': destination['type'],
            'region': destination['region'],
            'cost': destination['cost'],
            'weather': destination.get('weather', ''),
            'bestSeason': destination.get('bestSeason', ''),
            'activities': destination.get('activities', []),
            'safetyRating': destination.get('safetyRating', 4),
            'userRating': destination.get('userRating', 0),
            'image': destination.get('image', ''),
            'description': destination.get('description', '')
        }
