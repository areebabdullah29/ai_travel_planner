from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, Dict, Any, List


class TripModel:
    """Trip model for async MongoDB operations"""

    collection_name = "trips"

    @staticmethod
    def _get_collection(db: AsyncIOMotorDatabase):
        return db[TripModel.collection_name]

    @staticmethod
    async def create(db: AsyncIOMotorDatabase, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new trip"""
        destination_id = None
        if data.get("destinationId"):
            try:
                destination_id = ObjectId(data["destinationId"])
            except Exception:
                destination_id = None

        trip = {
            "userId": ObjectId(user_id),
            "destinationId": destination_id,
            "startDate": data.get("startDate", ""),
            "endDate": data.get("endDate", ""),
            "budget": data.get("budget", 0),
            "itinerary": data.get("itinerary", []),
            "status": data.get("status", "planned"),
            "planData": data.get("planData", {}),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        result = await TripModel._get_collection(db).insert_one(trip)
        trip["_id"] = result.inserted_id
        return TripModel.serialize(trip)

    @staticmethod
    async def find_by_user(
        db: AsyncIOMotorDatabase, user_id: str, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find all trips for a user with optional status filter"""
        query = {"userId": ObjectId(user_id)}
        if status:
            query["status"] = status

        pipeline = [
            {"$match": query},
            {
                "$lookup": {
                    "from": "destinations",
                    "localField": "destinationId",
                    "foreignField": "_id",
                    "as": "destination",
                }
            },
            {"$unwind": {"path": "$destination", "preserveNullAndEmptyArrays": True}},
            {"$sort": {"createdAt": -1}},
        ]

        cursor = TripModel._get_collection(db).aggregate(pipeline)
        trips = await cursor.to_list(length=None)
        return [TripModel.serialize_with_destination(t) for t in trips]

    @staticmethod
    async def find_by_id(
        db: AsyncIOMotorDatabase, trip_id: str, user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Find trip by ID"""
        try:
            query = {"_id": ObjectId(trip_id)}
            if user_id:
                query["userId"] = ObjectId(user_id)

            pipeline = [
                {"$match": query},
                {
                    "$lookup": {
                        "from": "destinations",
                        "localField": "destinationId",
                        "foreignField": "_id",
                        "as": "destination",
                    }
                },
                {"$unwind": {"path": "$destination", "preserveNullAndEmptyArrays": True}},
                {"$limit": 1},
            ]

            cursor = TripModel._get_collection(db).aggregate(pipeline)
            trips_list = await cursor.to_list(length=1)
            if trips_list:
                return TripModel.serialize_with_destination(trips_list[0])
            return None
        except Exception:
            return None

    @staticmethod
    async def update(
        db: AsyncIOMotorDatabase, trip_id: str, user_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update trip"""
        update_data = {"updatedAt": datetime.utcnow()}

        allowed_fields = ["startDate", "endDate", "budget", "itinerary", "status", "planData"]
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]

        result = await TripModel._get_collection(db).find_one_and_update(
            {"_id": ObjectId(trip_id), "userId": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True,
        )

        if result:
            return await TripModel.find_by_id(db, trip_id)
        return None

    @staticmethod
    async def delete(db: AsyncIOMotorDatabase, trip_id: str, user_id: str) -> bool:
        """Delete trip"""
        try:
            result = await TripModel._get_collection(db).delete_one(
                {"_id": ObjectId(trip_id), "userId": ObjectId(user_id)}
            )
            return result.deleted_count > 0
        except Exception:
            return False

    @staticmethod
    def serialize(trip: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Convert trip document to JSON-serializable format"""
        if not trip:
            return None

        return {
            "id": str(trip["_id"]),
            "_id": str(trip["_id"]),
            "userId": str(trip["userId"]),
            "destinationId": str(trip["destinationId"]) if trip.get("destinationId") else None,
            "startDate": trip.get("startDate", ""),
            "endDate": trip.get("endDate", ""),
            "budget": trip.get("budget", 0),
            "itinerary": trip.get("itinerary", []),
            "status": trip.get("status", "planned"),
            "planData": trip.get("planData", {}),
            "createdAt": trip.get("createdAt", datetime.utcnow()).isoformat()
            if trip.get("createdAt")
            else None,
            "updatedAt": trip.get("updatedAt", datetime.utcnow()).isoformat()
            if trip.get("updatedAt")
            else None,
        }

    @staticmethod
    def serialize_with_destination(trip: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Serialize trip with embedded destination"""
        if not trip:
            return None

        serialized = TripModel.serialize(trip)

        if "destination" in trip and trip["destination"]:
            from .destination import DestinationModel
            serialized["destination"] = DestinationModel.serialize(trip["destination"])

        return serialized
