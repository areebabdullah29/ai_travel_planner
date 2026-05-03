from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from app.core.database import get_db
from app.models.destination import DestinationModel
from app.models.user import UserModel
from app.schemas.destination import (
    DestinationCreate,
    DestinationUpdate,
    DestinationResponse,
)
from app.api.dependencies import get_current_user, get_optional_user

router = APIRouter()


async def is_admin(user_id: str, db: AsyncIOMotorDatabase) -> bool:
    """Check if user is admin"""
    user = await UserModel.find_by_id(db, user_id)
    return bool(user and user.get("role") == "admin")


@router.get("", response_model=List[DestinationResponse])
async def get_destinations(
    type: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    minBudget: Optional[int] = Query(None),
    maxBudget: Optional[int] = Query(None),
    activities: Optional[str] = Query(None),
    sortBy: str = Query("userRating"),
    sortOrder: str = Query("desc"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all destinations with optional filtering"""
    filters = {}
    if type:
        filters["type"] = type
    if region:
        filters["region"] = region
    if minBudget is not None:
        filters["minBudget"] = minBudget
    if maxBudget is not None:
        filters["maxBudget"] = maxBudget
    if activities:
        filters["activities"] = activities.split(",")

    sort_order_int = -1 if sortOrder == "desc" else 1

    destinations = await DestinationModel.find_all(
        db,
        filters=filters,
        sort_by=sortBy,
        sort_order=sort_order_int,
        limit=limit,
        skip=skip,
    )

    return [DestinationResponse(**dest) for dest in destinations]


@router.get("/{destination_id}", response_model=DestinationResponse)
async def get_destination(
    destination_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get single destination by ID"""
    destination = await DestinationModel.find_by_id(db, destination_id)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    return DestinationResponse(**destination)


@router.post("", response_model=DestinationResponse, status_code=status.HTTP_201_CREATED)
async def create_destination(
    dest_data: DestinationCreate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new destination (admin only)"""
    if not await is_admin(current_user["id"], db):
        raise HTTPException(status_code=403, detail="Admin access required")

    destination = await DestinationModel.create(db, dest_data.dict())
    return DestinationResponse(**destination)


@router.put("/{destination_id}", response_model=DestinationResponse)
async def update_destination(
    destination_id: str,
    dest_data: DestinationUpdate,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Update destination (admin only)"""
    if not await is_admin(current_user["id"], db):
        raise HTTPException(status_code=403, detail="Admin access required")

    destination = await DestinationModel.update(db, destination_id, dest_data.dict(exclude_unset=True))
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    return DestinationResponse(**destination)


@router.delete("/{destination_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_destination(
    destination_id: str,
    current_user=Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Delete destination (admin only)"""
    if not await is_admin(current_user["id"], db):
        raise HTTPException(status_code=403, detail="Admin access required")

    deleted = await DestinationModel.delete(db, destination_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Destination not found")
    return None


@router.get("/filters/regions", response_model=List[str])
async def get_regions(
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all unique regions"""
    regions = await DestinationModel.get_regions(db)
    return regions or []


@router.get("/filters/types", response_model=List[str])
async def get_types(
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Get all unique travel types"""
    types = await DestinationModel.get_types(db)
    return types or []
