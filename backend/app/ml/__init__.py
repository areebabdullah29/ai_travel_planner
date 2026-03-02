"""
ML Module for Travel Buddy
Contains machine learning components for advanced recommendations.

Note: Advanced ML features using spaCy and scikit-learn
will be implemented in Phase 4.
"""

from .query_parser import AdvancedQueryParser
from .recommender import MLRecommender

__all__ = ['AdvancedQueryParser', 'MLRecommender']
