from datetime import datetime
from bson import ObjectId
from typing import List, Optional

from app import mongo


class TripModel:
    """Trip model for database operations"""

    collection_name = 'trips'

    @staticmethod
    def get_collection():
        return mongo.db[TripModel.collection_name]

    @staticmethod
    def create(user_id: str, data: dict) -> dict:
        """Create a new trip"""
        # destinationId is optional — frontend plans use a static JSON file, not MongoDB destinations
        destination_id = None
        if data.get('destinationId'):
            try:
                destination_id = ObjectId(data['destinationId'])
            except Exception:
                destination_id = None

        trip = {
            'userId': ObjectId(user_id),
            'destinationId': destination_id,
            'startDate': data.get('startDate', ''),
            'endDate': data.get('endDate', ''),
            'budget': data.get('budget', 0),
            'itinerary': data.get('itinerary', []),
            'status': data.get('status', 'planned'),
            'planData': data.get('planData', {}),  # Full TripPlan JSON from frontend
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }

        result = TripModel.get_collection().insert_one(trip)
        trip['_id'] = result.inserted_id
        return TripModel.serialize(trip)

    @staticmethod
    def find_by_user(user_id: str, status: str = None) -> List[dict]:
        """Find all trips for a user"""
        query = {'userId': ObjectId(user_id)}

        if status:
            query['status'] = status

        trips = TripModel.get_collection().aggregate([
            {'$match': query},
            {
                '$lookup': {
                    'from': 'destinations',
                    'localField': 'destinationId',
                    'foreignField': '_id',
                    'as': 'destination'
                }
            },
            {'$unwind': {'path': '$destination', 'preserveNullAndEmptyArrays': True}},
            {'$sort': {'createdAt': -1}}
        ])

        return [TripModel.serialize_with_destination(t) for t in trips]

    @staticmethod
    def find_by_id(trip_id: str, user_id: str = None) -> Optional[dict]:
        """Find trip by ID"""
        try:
            query = {'_id': ObjectId(trip_id)}
            if user_id:
                query['userId'] = ObjectId(user_id)

            trips = TripModel.get_collection().aggregate([
                {'$match': query},
                {
                    '$lookup': {
                        'from': 'destinations',
                        'localField': 'destinationId',
                        'foreignField': '_id',
                        'as': 'destination'
                    }
                },
                {'$unwind': {'path': '$destination', 'preserveNullAndEmptyArrays': True}},
                {'$limit': 1}
            ])

            trips_list = list(trips)
            if trips_list:
                return TripModel.serialize_with_destination(trips_list[0])
            return None
        except Exception:
            return None

    @staticmethod
    def update(trip_id: str, user_id: str, data: dict) -> Optional[dict]:
        """Update trip"""
        update_data = {'updatedAt': datetime.utcnow()}

        allowed_fields = ['startDate', 'endDate', 'budget', 'itinerary', 'status', 'planData']

        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]

        result = TripModel.get_collection().find_one_and_update(
            {'_id': ObjectId(trip_id), 'userId': ObjectId(user_id)},
            {'$set': update_data},
            return_document=True
        )

        if result:
            return TripModel.find_by_id(trip_id)
        return None

    @staticmethod
    def delete(trip_id: str, user_id: str) -> bool:
        """Delete trip"""
        try:
            result = TripModel.get_collection().delete_one({
                '_id': ObjectId(trip_id),
                'userId': ObjectId(user_id)
            })
            return result.deleted_count > 0
        except Exception:
            return False

    @staticmethod
    def serialize(trip: dict) -> Optional[dict]:
        """Convert trip document to JSON-serializable format"""
        if not trip:
            return None

        return {
            'id': str(trip['_id']),
            'userId': str(trip['userId']),
            'destinationId': str(trip['destinationId']) if trip.get('destinationId') else None,
            'startDate': trip.get('startDate', ''),
            'endDate': trip.get('endDate', ''),
            'budget': trip.get('budget', 0),
            'itinerary': trip.get('itinerary', []),
            'status': trip.get('status', 'planned'),
            'planData': trip.get('planData', {}),
            'createdAt': trip.get('createdAt', datetime.utcnow()).isoformat()
        }

    @staticmethod
    def serialize_with_destination(trip: dict) -> Optional[dict]:
        """Serialize trip with embedded destination"""
        if not trip:
            return None

        serialized = TripModel.serialize(trip)

        if 'destination' in trip and trip['destination']:
            from .destination import DestinationModel
            serialized['destination'] = DestinationModel.serialize(trip['destination'])

        return serialized
