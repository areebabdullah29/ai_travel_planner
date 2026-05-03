from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.database import get_db
from app.models.destination import DestinationModel
from app.models.user import UserModel
from app.services.nlp_parser import NLPParser
from app.services.recommendation import RecommendationService
from app.api.dependencies import get_optional_user

router = APIRouter()


class SearchRequest(BaseModel):
    """Search request schema"""
    query: str
    limit: Optional[int] = 10


class BudgetEstimateRequest(BaseModel):
    """Budget estimate request schema"""
    destinationId: str
    days: int


class ItineraryRequest(BaseModel):
    """Itinerary request schema"""
    destinationId: str
    days: int


class ParseQueryRequest(BaseModel):
    """Parse query request schema"""
    query: str


@router.post("")
async def search(
    req: SearchRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Search for destinations based on query"""
    if not req.query:
        raise HTTPException(status_code=400, detail="Search query is required")

    parsed_params = NLPParser.parse_query(req.query)

    user_preferences = None
    if current_user:
        user_preferences = current_user.get("preferences")

    recommendations = RecommendationService.get_recommendations(
        parsed_params, user_preferences, req.limit
    )

    if not recommendations and parsed_params.get("destination"):
        recommendations = await DestinationModel.search(db, parsed_params["destination"])

    budget_estimate = None
    sample_itinerary = None

    if recommendations and parsed_params.get("days"):
        budget_estimate = NLPParser.generate_budget_estimate(
            recommendations[0]["cost"], parsed_params["days"]
        )
        sample_itinerary = RecommendationService.generate_itinerary(
            recommendations[0], parsed_params["days"]
        )

    return {
        "success": True,
        "data": {
            "parsedQuery": parsed_params,
            "recommendations": recommendations,
            "budgetEstimate": budget_estimate,
            "sampleItinerary": sample_itinerary,
        },
    }


@router.get("/quick")
async def quick_search(
    q: str = Query(..., min_length=2),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Quick search by keyword"""
    results = await DestinationModel.search(db, q)
    return {
        "success": True,
        "data": results,
        "message": "Quick search results",
    }


@router.get("/similar/{destination_id}")
async def get_similar(
    destination_id: str,
    limit: int = Query(5, ge=1, le=50),
):
    """Get similar destinations"""
    similar = RecommendationService.get_similar_destinations(destination_id, limit)
    return {"success": True, "data": similar}


@router.get("/popular")
async def get_popular(
    limit: int = Query(10, ge=1, le=100),
):
    """Get popular destinations"""
    popular = RecommendationService.get_popular_destinations(limit)
    return {"success": True, "data": popular}


@router.post("/parse")
async def parse_query(
    req: ParseQueryRequest,
):
    """Parse natural language query"""
    if not req.query:
        raise HTTPException(status_code=400, detail="Query is required")

    parsed = NLPParser.parse_query(req.query)
    return {"success": True, "data": parsed}


@router.post("/budget-estimate")
async def estimate_budget(
    req: BudgetEstimateRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Estimate budget for a destination"""
    if not req.destinationId or not req.days:
        raise HTTPException(status_code=400, detail="destinationId and days are required")

    destination = await DestinationModel.find_by_id(db, req.destinationId)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    budget_estimate = NLPParser.generate_budget_estimate(destination["cost"], req.days)
    return {
        "success": True,
        "data": {
            "destination": destination["name"],
            "days": req.days,
            "estimate": budget_estimate,
        },
    }


@router.post("/itinerary")
async def generate_itinerary(
    req: ItineraryRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate sample itinerary for a destination"""
    if not req.destinationId or not req.days:
        raise HTTPException(status_code=400, detail="destinationId and days are required")

    destination = await DestinationModel.find_by_id(db, req.destinationId)
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")

    itinerary = RecommendationService.generate_itinerary(destination, req.days)
    return {
        "success": True,
        "data": {
            "destination": destination,
            "days": req.days,
            "itinerary": itinerary,
        },
    }
