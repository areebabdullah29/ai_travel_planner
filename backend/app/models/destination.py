from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional, Dict, Any


class DestinationModel:
    """Destination model for async MongoDB operations"""

    collection_name = "destinations"

    @staticmethod
    def _get_collection(db: AsyncIOMotorDatabase):
        return db[DestinationModel.collection_name]

    @staticmethod
    async def create(db: AsyncIOMotorDatabase, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new destination"""
        destination = {
            "name": data["name"],
            "type": data["type"],
            "region": data["region"],
            "cost": data["cost"],
            "weather": data.get("weather", ""),
            "bestSeason": data.get("bestSeason", ""),
            "activities": data.get("activities", []),
            "safetyRating": data.get("safetyRating", 4),
            "userRating": data.get("userRating", 0),
            "image": data.get("image", ""),
            "description": data.get("description", ""),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
        }

        result = await DestinationModel._get_collection(db).insert_one(destination)
        destination["_id"] = result.inserted_id
        return DestinationModel.serialize(destination)

    @staticmethod
    def _build_query(filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not filters:
            return {}

        query = {}
        if filters.get("type"):
            query["type"] = filters["type"]
        if filters.get("region"):
            query["region"] = filters["region"]

        min_budget = filters.get("minBudget")
        max_budget = filters.get("maxBudget")
        if min_budget is not None or max_budget is not None:
            query["cost"] = {}
            if max_budget is not None:
                query["cost"]["$lte"] = max_budget
            if min_budget is not None:
                query["cost"]["$gte"] = min_budget

        if filters.get("activities"):
            query["activities"] = {"$in": filters["activities"]}

        return query

    @staticmethod
    async def find_all(
        db: AsyncIOMotorDatabase,
        filters: Optional[Dict[str, Any]] = None,
        sort_by: str = "userRating",
        sort_order: int = -1,
        limit: int = 50,
        skip: int = 0,
    ) -> List[Dict[str, Any]]:
        """Find all destinations with optional filtering"""
        query = DestinationModel._build_query(filters)
        cursor = (
            DestinationModel._get_collection(db)
            .find(query)
            .sort(sort_by, sort_order)
            .skip(skip)
            .limit(limit)
        )
        destinations = await cursor.to_list(length=limit)
        return [DestinationModel.serialize(d) for d in destinations]

    @staticmethod
    async def find_by_id(
        db: AsyncIOMotorDatabase, destination_id: str
    ) -> Optional[Dict[str, Any]]:
        """Find destination by ID"""
        try:
            destination = await DestinationModel._get_collection(db).find_one(
                {"_id": ObjectId(destination_id)}
            )
            return DestinationModel.serialize(destination) if destination else None
        except Exception:
            return None

    @staticmethod
    async def update(
        db: AsyncIOMotorDatabase, destination_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update destination"""
        update_data = {"updatedAt": datetime.utcnow()}

        allowed_fields = [
            "name",
            "type",
            "region",
            "cost",
            "weather",
            "bestSeason",
            "activities",
            "safetyRating",
            "userRating",
            "image",
            "description",
        ]

        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]

        result = await DestinationModel._get_collection(db).find_one_and_update(
            {"_id": ObjectId(destination_id)},
            {"$set": update_data},
            return_document=True,
        )
        return DestinationModel.serialize(result) if result else None

    @staticmethod
    async def delete(db: AsyncIOMotorDatabase, destination_id: str) -> bool:
        """Delete destination"""
        try:
            result = await DestinationModel._get_collection(db).delete_one(
                {"_id": ObjectId(destination_id)}
            )
            return result.deleted_count > 0
        except Exception:
            return False

    @staticmethod
    async def search(
        db: AsyncIOMotorDatabase, query: str
    ) -> List[Dict[str, Any]]:
        """Search destinations by name or description"""
        regex_query = {"$regex": query, "$options": "i"}
        cursor = DestinationModel._get_collection(db).find(
            {
                "$or": [
                    {"name": regex_query},
                    {"description": regex_query},
                    {"region": regex_query},
                    {"activities": regex_query},
                ]
            }
        ).limit(20)

        destinations = await cursor.to_list(length=20)
        return [DestinationModel.serialize(d) for d in destinations]

    @staticmethod
    async def get_regions(db: AsyncIOMotorDatabase) -> List[str]:
        """Get all unique regions"""
        return await DestinationModel._get_collection(db).distinct("region")

    @staticmethod
    async def get_types(db: AsyncIOMotorDatabase) -> List[str]:
        """Get all unique travel types"""
        return await DestinationModel._get_collection(db).distinct("type")

    @staticmethod
    def serialize(destination: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Convert destination document to JSON-serializable format"""
        if not destination:
            return None

        return {
            "id": str(destination["_id"]),
            "_id": str(destination["_id"]),
            "name": destination["name"],
            "type": destination["type"],
            "region": destination["region"],
            "cost": destination["cost"],
            "weather": destination.get("weather", ""),
            "bestSeason": destination.get("bestSeason", ""),
            "activities": destination.get("activities", []),
            "safetyRating": destination.get("safetyRating", 4),
            "userRating": destination.get("userRating", 0),
            "image": destination.get("image", ""),
            "description": destination.get("description", ""),
            "createdAt": destination.get("createdAt", datetime.utcnow()).isoformat()
            if destination.get("createdAt")
            else None,
        }
