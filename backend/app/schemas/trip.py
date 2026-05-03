from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ItineraryItem(BaseModel):
    """Itinerary item schema"""
    day: int
    activity: str
    time: Optional[str] = None


class TripBase(BaseModel):
    """Base trip schema"""
    destinationId: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    budget: Optional[float] = None
    status: str = "planned"


class TripCreate(BaseModel):
    """Trip creation schema"""
    destinationId: Optional[str] = None
    budget: Optional[float] = None
    planData: Optional[Dict[str, Any]] = None


class TripUpdate(BaseModel):
    """Trip update schema"""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    budget: Optional[float] = None
    itinerary: Optional[List[ItineraryItem]] = None
    status: Optional[str] = None
    planData: Optional[Dict[str, Any]] = None


class TripStatusUpdate(BaseModel):
    """Trip status update schema"""
    status: str = Field(..., pattern="^(planned|ongoing|completed)$")


class TripResponse(BaseModel):
    """Trip response schema"""
    id: str = Field(alias="_id")
    userId: str
    destinationId: Optional[str] = None
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    budget: Optional[float] = None
    itinerary: Optional[List[ItineraryItem]] = None
    status: str = "planned"
    planData: Optional[Dict[str, Any]] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439012",
                "userId": "507f1f77bcf86cd799439011",
                "destinationId": None,
                "startDate": "2024-06-01",
                "endDate": "2024-06-07",
                "budget": 50000,
                "itinerary": [],
                "status": "planned",
                "planData": {},
                "createdAt": "2024-01-01T00:00:00"
            }
        }
