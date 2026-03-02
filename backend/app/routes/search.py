from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request

from app.models.user import UserModel
from app.models.destination import DestinationModel
from app.services.nlp_parser import NLPParser
from app.services.recommendation import RecommendationService

search_bp = Blueprint('search', __name__)


@search_bp.route('', methods=['POST'])
def search():
    """
    NLP-powered search endpoint.
    Parses natural language query and returns recommendations.
    """
    data = request.get_json()

    if not data.get('query'):
        return jsonify({
            'success': False,
            'error': 'Search query is required'
        }), 400

    query = data['query']

    # Parse the query using NLP
    parsed_params = NLPParser.parse_query(query)

    # Get user preferences if authenticated
    user_preferences = None
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if user_id:
            user = UserModel.find_by_id(user_id)
            if user:
                user_preferences = user.get('preferences')
    except Exception:
        pass

    # Get recommendations
    limit = data.get('limit', 10)
    recommendations = RecommendationService.get_recommendations(
        parsed_params,
        user_preferences,
        limit
    )

    # If no recommendations and we have a destination name, try direct search
    if not recommendations and parsed_params.get('destination'):
        recommendations = DestinationModel.search(parsed_params['destination'])

    # Generate budget estimate if we have enough data
    budget_estimate = None
    if recommendations and parsed_params.get('days'):
        top_destination = recommendations[0]
        budget_estimate = NLPParser.generate_budget_estimate(
            top_destination['cost'],
            parsed_params['days']
        )

    # Generate itinerary for top recommendation
    sample_itinerary = None
    if recommendations and parsed_params.get('days'):
        sample_itinerary = RecommendationService.generate_itinerary(
            recommendations[0],
            parsed_params['days']
        )

    return jsonify({
        'success': True,
        'data': {
            'parsedQuery': parsed_params,
            'recommendations': recommendations,
            'budgetEstimate': budget_estimate,
            'sampleItinerary': sample_itinerary
        }
    })


@search_bp.route('/quick', methods=['GET'])
def quick_search():
    """Quick search by keyword"""
    keyword = request.args.get('q', '')

    if not keyword or len(keyword) < 2:
        return jsonify({
            'success': False,
            'error': 'Search keyword must be at least 2 characters'
        }), 400

    results = DestinationModel.search(keyword)

    return jsonify({
        'success': True,
        'data': results,
        'count': len(results)
    })


@search_bp.route('/similar/<destination_id>', methods=['GET'])
def get_similar(destination_id):
    """Get similar destinations"""
    limit = int(request.args.get('limit', 5))

    similar = RecommendationService.get_similar_destinations(destination_id, limit)

    return jsonify({
        'success': True,
        'data': similar
    })


@search_bp.route('/popular', methods=['GET'])
def get_popular():
    """Get popular destinations (for cold start)"""
    limit = int(request.args.get('limit', 10))

    popular = RecommendationService.get_popular_destinations(limit)

    return jsonify({
        'success': True,
        'data': popular
    })


@search_bp.route('/parse', methods=['POST'])
def parse_query():
    """Parse natural language query and return extracted parameters"""
    data = request.get_json()

    if not data.get('query'):
        return jsonify({
            'success': False,
            'error': 'Query is required'
        }), 400

    parsed = NLPParser.parse_query(data['query'])

    return jsonify({
        'success': True,
        'data': parsed
    })


@search_bp.route('/budget-estimate', methods=['POST'])
def estimate_budget():
    """Get budget estimate for a trip"""
    data = request.get_json()

    if not data.get('destinationId') or not data.get('days'):
        return jsonify({
            'success': False,
            'error': 'destinationId and days are required'
        }), 400

    destination = DestinationModel.find_by_id(data['destinationId'])

    if not destination:
        return jsonify({
            'success': False,
            'error': 'Destination not found'
        }), 404

    budget_estimate = NLPParser.generate_budget_estimate(
        destination['cost'],
        data['days']
    )

    return jsonify({
        'success': True,
        'data': {
            'destination': destination['name'],
            'days': data['days'],
            'estimate': budget_estimate
        }
    })


@search_bp.route('/itinerary', methods=['POST'])
def generate_itinerary():
    """Generate sample itinerary for a destination"""
    data = request.get_json()

    if not data.get('destinationId') or not data.get('days'):
        return jsonify({
            'success': False,
            'error': 'destinationId and days are required'
        }), 400

    destination = DestinationModel.find_by_id(data['destinationId'])

    if not destination:
        return jsonify({
            'success': False,
            'error': 'Destination not found'
        }), 404

    itinerary = RecommendationService.generate_itinerary(
        destination,
        data['days']
    )

    return jsonify({
        'success': True,
        'data': {
            'destination': destination,
            'days': data['days'],
            'itinerary': itinerary
        }
    })
