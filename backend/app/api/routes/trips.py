from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from app.core.database import get_db
from app.models.trip import TripModel
from app.schemas.trip import TripCreate, TripUpdate, TripStatusUpdate, TripResponse
from app.api.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=List[TripResponse])
async def get_trips(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all trips for current user"""
    trips = await TripModel.find_by_user(db, current_user["id"], status_filter)
    return [TripResponse(**trip) for trip in trips]


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get single trip by ID"""
    trip = await TripModel.find_by_id(db, trip_id, current_user["id"])
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripResponse(**trip)


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
async def create_trip(
    trip_data: TripCreate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new trip"""
    if trip_data.budget is None and not trip_data.planData:
        raise HTTPException(
            status_code=400, detail="budget or planData is required"
        )

    trip = await TripModel.create(db, current_user["id"], trip_data.dict())
    return TripResponse(**trip)


@router.put("/{trip_id}", response_model=TripResponse)
async def update_trip(
    trip_id: str,
    trip_data: TripUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update trip"""
    trip = await TripModel.update(db, trip_id, current_user["id"], trip_data.dict(exclude_unset=True))
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripResponse(**trip)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete trip"""
    deleted = await TripModel.delete(db, trip_id, current_user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Trip not found")
    return None


@router.put("/{trip_id}/itinerary", response_model=TripResponse)
async def update_itinerary(
    trip_id: str,
    trip_data: TripUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update trip itinerary"""
    if not trip_data.itinerary:
        raise HTTPException(status_code=400, detail="Itinerary data is required")

    trip = await TripModel.update(
        db, trip_id, current_user["id"], {"itinerary": trip_data.itinerary}
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripResponse(**trip)


@router.patch("/{trip_id}/status", response_model=TripResponse)
async def update_trip_status(
    trip_id: str,
    status_data: TripStatusUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update trip status"""
    trip = await TripModel.update(
        db, trip_id, current_user["id"], {"status": status_data.status}
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return TripResponse(**trip)
