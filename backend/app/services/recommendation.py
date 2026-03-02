from typing import List, Dict, Any, Optional
from app.models.destination import DestinationModel


class RecommendationService:
    """
    Recommendation service for travel destinations.
    Uses content-based filtering to recommend destinations
    based on user preferences and search parameters.
    """

    @staticmethod
    def get_recommendations(
        params: Dict[str, Any],
        user_preferences: Optional[Dict] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get destination recommendations based on search parameters.

        Args:
            params: Extracted search parameters from NLP parser
            user_preferences: User's stored preferences (optional)
            limit: Maximum number of recommendations

        Returns:
            List of recommended destinations with scores
        """
        # Get all destinations
        destinations = DestinationModel.find_all(limit=100)

        if not destinations:
            return []

        # Score each destination
        scored_destinations = []
        for dest in destinations:
            score = RecommendationService._calculate_score(dest, params, user_preferences)
            if score > 0:
                dest['matchScore'] = score
                scored_destinations.append(dest)

        # Sort by score descending
        scored_destinations.sort(key=lambda x: x['matchScore'], reverse=True)

        return scored_destinations[:limit]

    @staticmethod
    def _calculate_score(
        destination: Dict,
        params: Dict[str, Any],
        user_preferences: Optional[Dict] = None
    ) -> float:
        """
        Calculate match score for a destination.

        Args:
            destination: Destination data
            params: Search parameters
            user_preferences: User preferences (optional)

        Returns:
            Match score (0-100)
        """
        score = 0
        max_score = 0

        # Region match (25 points)
        if params.get('region'):
            max_score += 25
            if destination['region'].lower() == params['region'].lower():
                score += 25

        # Travel type match (25 points)
        if params.get('travelType'):
            max_score += 25
            if destination['type'] == params['travelType']:
                score += 25

        # Budget match (20 points)
        if params.get('budget'):
            max_score += 20
            if destination['cost'] <= params['budget']:
                # Higher score for better budget fit
                budget_ratio = destination['cost'] / params['budget']
                if budget_ratio >= 0.5:
                    score += 20
                else:
                    score += int(20 * budget_ratio * 2)

        # Activities match (20 points)
        if params.get('activities'):
            max_score += 20
            dest_activities = [a.lower() for a in destination.get('activities', [])]
            search_activities = [a.lower() for a in params['activities']]

            matching = sum(1 for a in search_activities if a in dest_activities)
            if matching > 0:
                score += int(20 * (matching / len(search_activities)))

        # Destination name match (bonus 10 points)
        if params.get('destination'):
            if params['destination'].lower() in destination['name'].lower():
                score += 10
                max_score += 10

        # User rating bonus (up to 5 points)
        user_rating = destination.get('userRating', 0)
        if user_rating >= 4.5:
            score += 5
        elif user_rating >= 4.0:
            score += 3
        elif user_rating >= 3.5:
            score += 1

        # User preferences bonus (if available)
        if user_preferences:
            # Preferred regions
            preferred_regions = user_preferences.get('preferredRegions', [])
            if destination['region'] in preferred_regions:
                score += 5

            # Travel styles
            travel_styles = user_preferences.get('travelStyles', [])
            if destination['type'] in travel_styles:
                score += 5

            # Budget range
            budget_range = user_preferences.get('budgetRange', {})
            min_budget = budget_range.get('min', 0)
            max_budget = budget_range.get('max', float('inf'))
            if min_budget <= destination['cost'] <= max_budget:
                score += 5

        # Normalize score to 0-100
        if max_score > 0:
            normalized_score = (score / max_score) * 100
        else:
            # If no specific criteria, base on rating only
            normalized_score = user_rating * 20

        return round(normalized_score, 2)

    @staticmethod
    def get_similar_destinations(destination_id: str, limit: int = 5) -> List[Dict]:
        """
        Get destinations similar to the given destination.

        Args:
            destination_id: ID of the reference destination
            limit: Maximum number of similar destinations

        Returns:
            List of similar destinations
        """
        reference = DestinationModel.find_by_id(destination_id)
        if not reference:
            return []

        # Use reference destination's attributes as search params
        params = {
            'region': reference['region'],
            'travelType': reference['type'],
            'budget': int(reference['cost'] * 1.5)  # Allow 50% higher budget
        }

        recommendations = RecommendationService.get_recommendations(params, limit=limit + 1)

        # Exclude the reference destination
        return [r for r in recommendations if r['id'] != destination_id][:limit]

    @staticmethod
    def get_popular_destinations(limit: int = 10) -> List[Dict]:
        """
        Get popular destinations for new users (cold start).

        Args:
            limit: Maximum number of destinations

        Returns:
            List of popular destinations
        """
        return DestinationModel.find_all(
            sort_by='userRating',
            sort_order=-1,
            limit=limit
        )

    @staticmethod
    def generate_itinerary(destination: Dict, days: int) -> List[Dict]:
        """
        Generate a sample itinerary for a destination.

        Args:
            destination: Destination data
            days: Number of days

        Returns:
            List of itinerary days with activities
        """
        activities = destination.get('activities', [])
        itinerary = []

        for day in range(1, days + 1):
            day_plan = {
                'day': day,
                'activities': []
            }

            if day == 1:
                # First day: arrival and light activities
                day_plan['activities'] = [
                    {
                        'name': f'Arrival at {destination["name"]}',
                        'time': '10:00',
                        'duration': '2 hours',
                        'type': 'transport',
                        'cost': 0
                    },
                    {
                        'name': 'Hotel Check-in & Rest',
                        'time': '12:00',
                        'duration': '2 hours',
                        'type': 'accommodation',
                        'cost': 0
                    },
                    {
                        'name': 'Local Area Exploration',
                        'time': '15:00',
                        'duration': '3 hours',
                        'type': 'activity',
                        'cost': 500
                    },
                    {
                        'name': 'Dinner',
                        'time': '19:00',
                        'duration': '2 hours',
                        'type': 'meal',
                        'cost': 1000
                    }
                ]
            elif day == days:
                # Last day: checkout and departure
                day_plan['activities'] = [
                    {
                        'name': 'Breakfast',
                        'time': '08:00',
                        'duration': '1 hour',
                        'type': 'meal',
                        'cost': 500
                    },
                    {
                        'name': 'Hotel Checkout',
                        'time': '10:00',
                        'duration': '1 hour',
                        'type': 'accommodation',
                        'cost': 0
                    },
                    {
                        'name': 'Souvenir Shopping',
                        'time': '11:00',
                        'duration': '2 hours',
                        'type': 'activity',
                        'cost': 2000
                    },
                    {
                        'name': 'Departure',
                        'time': '14:00',
                        'duration': '3 hours',
                        'type': 'transport',
                        'cost': 0
                    }
                ]
            else:
                # Middle days: main activities
                activity_index = (day - 2) % len(activities) if activities else 0
                main_activity = activities[activity_index] if activities else 'Sightseeing'

                day_plan['activities'] = [
                    {
                        'name': 'Breakfast',
                        'time': '08:00',
                        'duration': '1 hour',
                        'type': 'meal',
                        'cost': 500
                    },
                    {
                        'name': main_activity,
                        'time': '09:30',
                        'duration': '4 hours',
                        'type': 'activity',
                        'cost': 1500
                    },
                    {
                        'name': 'Lunch',
                        'time': '13:30',
                        'duration': '1.5 hours',
                        'type': 'meal',
                        'cost': 800
                    },
                    {
                        'name': 'Photography & Exploration',
                        'time': '15:00',
                        'duration': '3 hours',
                        'type': 'activity',
                        'cost': 500
                    },
                    {
                        'name': 'Dinner',
                        'time': '19:00',
                        'duration': '2 hours',
                        'type': 'meal',
                        'cost': 1000
                    }
                ]

            itinerary.append(day_plan)

        return itinerary
