from pydantic import BaseModel, Field
from typing import Optional, List


class DestinationBase(BaseModel):
    """Base destination schema"""
    name: str = Field(..., min_length=1)
    type: str
    region: str
    cost: float
    weather: Optional[str] = None
    bestSeason: Optional[str] = None
    activities: Optional[List[str]] = None
    safetyRating: Optional[float] = None
    userRating: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None


class DestinationCreate(DestinationBase):
    """Destination creation schema"""
    pass


class DestinationUpdate(BaseModel):
    """Destination update schema"""
    name: Optional[str] = None
    type: Optional[str] = None
    region: Optional[str] = None
    cost: Optional[float] = None
    weather: Optional[str] = None
    bestSeason: Optional[str] = None
    activities: Optional[List[str]] = None
    safetyRating: Optional[float] = None
    userRating: Optional[float] = None
    image: Optional[str] = None
    description: Optional[str] = None


class DestinationResponse(DestinationBase):
    """Destination response schema"""
    id: str = Field(alias="_id")
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "_id": "507f1f77bcf86cd799439013",
                "name": "Islamabad",
                "type": "Capital",
                "region": "Punjab",
                "cost": 5000,
                "weather": "Pleasant",
                "bestSeason": "Spring",
                "activities": ["hiking", "sightseeing"],
                "safetyRating": 8.5,
                "userRating": 4.5,
                "image": "https://...",
                "description": "Beautiful capital city",
                "createdAt": "2024-01-01T00:00:00"
            }
        }
