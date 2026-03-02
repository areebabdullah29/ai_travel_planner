"""
ML-based Recommender System
This module will use scikit-learn for collaborative filtering in Phase 4.

For now, it wraps the basic recommendation service.
"""

from typing import List, Dict, Any, Optional
from app.services.recommendation import RecommendationService


class MLRecommender:
    """
    ML-powered recommendation system using collaborative filtering.

    This is a placeholder for Phase 4 implementation.
    Currently wraps the basic RecommendationService.
    """

    def __init__(self):
        """Initialize the recommender. ML model training will be added in Phase 4."""
        self.basic_recommender = RecommendationService()
        # TODO: Initialize ML components
        # self.user_item_matrix = None
        # self.similarity_matrix = None

    def get_recommendations(
        self,
        user_id: str = None,
        params: Dict[str, Any] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get recommendations using ML-based collaborative filtering.

        Args:
            user_id: User ID for personalized recommendations
            params: Search parameters
            limit: Maximum number of recommendations

        Returns:
            List of recommended destinations
        """
        # For now, use content-based recommendations
        user_preferences = None

        if user_id:
            from app.models.user import UserModel
            user = UserModel.find_by_id(user_id)
            if user:
                user_preferences = user.get('preferences')

        return RecommendationService.get_recommendations(
            params or {},
            user_preferences,
            limit
        )

    def train_model(self, user_interactions: List[Dict]) -> None:
        """
        Train the collaborative filtering model.
        Will be implemented in Phase 4.

        Args:
            user_interactions: List of user-destination interactions
        """
        # TODO: Implement collaborative filtering training
        # 1. Build user-item matrix
        # 2. Calculate similarity matrix
        # 3. Train the model
        pass

    def get_user_based_recommendations(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get recommendations based on similar users.
        Will use collaborative filtering in Phase 4.

        Args:
            user_id: Target user ID
            limit: Maximum recommendations

        Returns:
            List of recommended destinations
        """
        # Placeholder - will use collaborative filtering
        return RecommendationService.get_popular_destinations(limit)

    def get_item_based_recommendations(
        self,
        destination_id: str,
        limit: int = 5
    ) -> List[Dict]:
        """
        Get recommendations based on similar items.

        Args:
            destination_id: Reference destination ID
            limit: Maximum recommendations

        Returns:
            List of similar destinations
        """
        return RecommendationService.get_similar_destinations(destination_id, limit)

    def calculate_similarity(
        self,
        dest1: Dict,
        dest2: Dict
    ) -> float:
        """
        Calculate similarity between two destinations.

        Args:
            dest1: First destination
            dest2: Second destination

        Returns:
            Similarity score (0-1)
        """
        score = 0.0

        # Type similarity
        if dest1.get('type') == dest2.get('type'):
            score += 0.3

        # Region similarity
        if dest1.get('region') == dest2.get('region'):
            score += 0.2

        # Cost similarity (within 30% range)
        cost1 = dest1.get('cost', 0)
        cost2 = dest2.get('cost', 0)
        if cost1 > 0 and cost2 > 0:
            cost_ratio = min(cost1, cost2) / max(cost1, cost2)
            if cost_ratio >= 0.7:
                score += 0.2

        # Activities similarity
        activities1 = set(a.lower() for a in dest1.get('activities', []))
        activities2 = set(a.lower() for a in dest2.get('activities', []))
        if activities1 and activities2:
            intersection = len(activities1 & activities2)
            union = len(activities1 | activities2)
            if union > 0:
                jaccard = intersection / union
                score += 0.3 * jaccard

        return score
