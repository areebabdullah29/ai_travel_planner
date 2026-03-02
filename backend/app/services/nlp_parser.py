import re
from typing import Dict, Any, List


class NLPParser:
    """
    Natural Language Processing parser for travel queries.
    Extracts destination, budget, duration, travel type, and activities
    from natural language input.
    """

    # Keywords for travel types
    TRAVEL_TYPE_KEYWORDS = {
        'Adventure': ['adventure', 'hiking', 'trekking', 'camping', 'mountaineering', 'rafting', 'extreme'],
        'Relaxation': ['relax', 'relaxation', 'beach', 'peaceful', 'calm', 'spa', 'resort'],
        'Family': ['family', 'kids', 'children', 'family-friendly'],
        'Cultural': ['culture', 'cultural', 'history', 'historical', 'heritage', 'museum', 'food tour'],
        'Romantic': ['romantic', 'honeymoon', 'couple', 'anniversary']
    }

    # Keywords for activities
    ACTIVITY_KEYWORDS = [
        'hiking', 'trekking', 'camping', 'mountaineering', 'rafting', 'skiing',
        'swimming', 'sunbathing', 'boating', 'fishing', 'photography', 'stargazing',
        'sightseeing', 'shopping', 'food tour', 'museum', 'historical sites'
    ]

    # Pakistan regions
    REGIONS = [
        'gilgit baltistan', 'gilgit', 'baltistan', 'hunza',
        'khyber pakhtunkhwa', 'kpk', 'swat', 'naran', 'kaghan',
        'punjab', 'lahore', 'murree', 'islamabad',
        'sindh', 'karachi',
        'balochistan', 'gwadar',
        'azad kashmir', 'kashmir', 'neelum'
    ]

    # Popular destinations
    DESTINATIONS = [
        'hunza valley', 'hunza', 'skardu', 'fairy meadows', 'nanga parbat',
        'swat valley', 'swat', 'kalam', 'malam jabba',
        'murree', 'nathia gali', 'ayubia',
        'naran kaghan', 'naran', 'kaghan', 'lake saif ul malook',
        'lahore', 'badshahi mosque', 'lahore fort',
        'islamabad', 'faisal mosque', 'margalla hills',
        'karachi', 'clifton beach', 'sea view',
        'gwadar', 'gwadar beach'
    ]

    @staticmethod
    def parse_query(query: str) -> Dict[str, Any]:
        """
        Parse natural language query and extract travel parameters.

        Args:
            query: Natural language search query

        Returns:
            Dictionary containing extracted parameters
        """
        query_lower = query.lower()

        result = {
            'destination': NLPParser._extract_destination(query_lower),
            'region': NLPParser._extract_region(query_lower),
            'budget': NLPParser._extract_budget(query_lower),
            'days': NLPParser._extract_days(query_lower),
            'travelType': NLPParser._extract_travel_type(query_lower),
            'activities': NLPParser._extract_activities(query_lower)
        }

        # Clean up None values
        return {k: v for k, v in result.items() if v is not None}

    @staticmethod
    def _extract_destination(query: str) -> str:
        """Extract destination from query"""
        for dest in NLPParser.DESTINATIONS:
            if dest in query:
                return dest.title()
        return None

    @staticmethod
    def _extract_region(query: str) -> str:
        """Extract region from query"""
        # Map variations to standard region names
        region_map = {
            'gilgit baltistan': 'Gilgit Baltistan',
            'gilgit': 'Gilgit Baltistan',
            'baltistan': 'Gilgit Baltistan',
            'hunza': 'Gilgit Baltistan',
            'khyber pakhtunkhwa': 'Khyber Pakhtunkhwa',
            'kpk': 'Khyber Pakhtunkhwa',
            'swat': 'Khyber Pakhtunkhwa',
            'naran': 'Khyber Pakhtunkhwa',
            'kaghan': 'Khyber Pakhtunkhwa',
            'punjab': 'Punjab',
            'lahore': 'Punjab',
            'murree': 'Punjab',
            'sindh': 'Sindh',
            'karachi': 'Sindh',
            'balochistan': 'Balochistan',
            'gwadar': 'Balochistan',
            'islamabad': 'Federal',
            'azad kashmir': 'Azad Kashmir',
            'kashmir': 'Azad Kashmir',
            'northern': 'Gilgit Baltistan'
        }

        for keyword, region in region_map.items():
            if keyword in query:
                return region

        return None

    @staticmethod
    def _extract_budget(query: str) -> int:
        """Extract budget from query"""
        # Pattern for budget amounts
        patterns = [
            r'under\s*(?:pkr\s*)?(\d{1,3}(?:,\d{3})*|\d+)\s*(?:pkr|rs|rupees)?',
            r'(?:pkr\s*)?(\d{1,3}(?:,\d{3})*|\d+)\s*(?:pkr|rs|rupees)?\s*budget',
            r'budget\s*(?:of\s*)?(?:pkr\s*)?(\d{1,3}(?:,\d{3})*|\d+)',
            r'(?:pkr\s*)?(\d{1,3}(?:,\d{3})*|\d+)\s*(?:pkr|rs|rupees)',
            r'(\d+)k',  # e.g., "25k"
        ]

        for pattern in patterns:
            match = re.search(pattern, query)
            if match:
                amount = match.group(1).replace(',', '')
                budget = int(amount)
                # Handle "k" notation
                if 'k' in pattern:
                    budget *= 1000
                return budget

        return None

    @staticmethod
    def _extract_days(query: str) -> int:
        """Extract trip duration from query"""
        patterns = [
            r'(\d+)\s*(?:day|days)',
            r'(\d+)\s*(?:night|nights)',
            r'(\d+)\s*(?:d)\b',
            r'for\s*(\d+)\s*(?:day|days|night|nights)?'
        ]

        for pattern in patterns:
            match = re.search(pattern, query)
            if match:
                return int(match.group(1))

        # Check for week patterns
        week_match = re.search(r'(\d+)\s*(?:week|weeks)', query)
        if week_match:
            return int(week_match.group(1)) * 7

        return None

    @staticmethod
    def _extract_travel_type(query: str) -> str:
        """Extract travel type from query"""
        for travel_type, keywords in NLPParser.TRAVEL_TYPE_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query:
                    return travel_type

        return None

    @staticmethod
    def _extract_activities(query: str) -> List[str]:
        """Extract activities from query"""
        found_activities = []

        for activity in NLPParser.ACTIVITY_KEYWORDS:
            if activity in query:
                found_activities.append(activity.title())

        return found_activities if found_activities else None

    @staticmethod
    def generate_budget_estimate(destination_cost: int, days: int) -> Dict[str, int]:
        """
        Generate budget estimate based on destination base cost and days.

        Args:
            destination_cost: Base cost of destination
            days: Number of days

        Returns:
            Budget breakdown dictionary
        """
        # Calculate costs based on days
        daily_accommodation = int(destination_cost * 0.25)
        daily_meals = int(destination_cost * 0.15)
        daily_activities = int(destination_cost * 0.1)

        travel = int(destination_cost * 0.3)  # Fixed travel cost
        accommodation = daily_accommodation * days
        meals = daily_meals * days
        activities = daily_activities * days
        miscellaneous = int((travel + accommodation + meals + activities) * 0.1)

        total = travel + accommodation + meals + activities + miscellaneous

        return {
            'travel': travel,
            'accommodation': accommodation,
            'meals': meals,
            'activities': activities,
            'miscellaneous': miscellaneous,
            'total': total
        }
