from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app.models.user import UserModel
from app.models.destination import DestinationModel
from app.services.nlp_parser import NLPParser
from app.services.recommendation import RecommendationService
from app.utils import get_json_body, json_response, parse_int

search_bp = Blueprint('search', __name__)


def _get_authenticated_preferences():
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if not user_id:
            return None
        user = UserModel.find_by_id(user_id)
        return user.get('preferences') if user else None
    except Exception:
        return None


@search_bp.route('', methods=['POST'])
def search():
    data = get_json_body()
    if not data.get('query'):
        return json_response(error='Search query is required', status=400)

    parsed_params = NLPParser.parse_query(data['query'])
    user_preferences = _get_authenticated_preferences()
    recommendations = RecommendationService.get_recommendations(
        parsed_params,
        user_preferences,
        data.get('limit', 10)
    )

    if not recommendations and parsed_params.get('destination'):
        recommendations = DestinationModel.search(parsed_params['destination'])

    budget_estimate = (
        NLPParser.generate_budget_estimate(recommendations[0]['cost'], parsed_params['days'])
        if recommendations and parsed_params.get('days') else None
    )

    sample_itinerary = (
        RecommendationService.generate_itinerary(recommendations[0], parsed_params['days'])
        if recommendations and parsed_params.get('days') else None
    )

    return json_response(data={
        'parsedQuery': parsed_params,
        'recommendations': recommendations,
        'budgetEstimate': budget_estimate,
        'sampleItinerary': sample_itinerary
    })


@search_bp.route('/quick', methods=['GET'])
def quick_search():
    keyword = request.args.get('q', '')
    if not keyword or len(keyword) < 2:
        return json_response(error='Search keyword must be at least 2 characters', status=400)

    results = DestinationModel.search(keyword)
    return json_response(data=results, message='Quick search results', status=200)


@search_bp.route('/similar/<destination_id>', methods=['GET'])
def get_similar(destination_id):
    limit = parse_int(request.args.get('limit'), 5)
    similar = RecommendationService.get_similar_destinations(destination_id, limit)
    return json_response(data=similar)


@search_bp.route('/popular', methods=['GET'])
def get_popular():
    limit = parse_int(request.args.get('limit'), 10)
    popular = RecommendationService.get_popular_destinations(limit)
    return json_response(data=popular)


@search_bp.route('/parse', methods=['POST'])
def parse_query():
    data = get_json_body()
    if not data.get('query'):
        return json_response(error='Query is required', status=400)

    parsed = NLPParser.parse_query(data['query'])
    return json_response(data=parsed)


@search_bp.route('/budget-estimate', methods=['POST'])
def estimate_budget():
    data = get_json_body()
    if not data.get('destinationId') or not data.get('days'):
        return json_response(error='destinationId and days are required', status=400)

    destination = DestinationModel.find_by_id(data['destinationId'])
    if not destination:
        return json_response(error='Destination not found', status=404)

    budget_estimate = NLPParser.generate_budget_estimate(destination['cost'], data['days'])
    return json_response(data={
        'destination': destination['name'],
        'days': data['days'],
        'estimate': budget_estimate
    })


@search_bp.route('/itinerary', methods=['POST'])
def generate_itinerary():
    data = get_json_body()
    if not data.get('destinationId') or not data.get('days'):
        return json_response(error='destinationId and days are required', status=400)

    destination = DestinationModel.find_by_id(data['destinationId'])
    if not destination:
        return json_response(error='Destination not found', status=404)

    itinerary = RecommendationService.generate_itinerary(destination, data['days'])
    return json_response(data={
        'destination': destination,
        'days': data['days'],
        'itinerary': itinerary
    })
