from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.trip import TripModel
from app.utils import get_json_body, json_response, parse_int

trips_bp = Blueprint('trips', __name__)


@trips_bp.route('', methods=['GET'])
@jwt_required()
def get_trips():
    """Get all trips for current user"""
    trips = TripModel.find_by_user(get_jwt_identity(), request.args.get('status'))
    return json_response(data=trips, message='Trips fetched successfully')


@trips_bp.route('/<trip_id>', methods=['GET'])
@jwt_required()
def get_trip(trip_id):
    """Get single trip by ID"""
    trip = TripModel.find_by_id(trip_id, get_jwt_identity())
    if not trip:
        return json_response(error='Trip not found', status=404)
    return json_response(data=trip)


@trips_bp.route('', methods=['POST'])
@jwt_required()
def create_trip():
    """Create a new trip"""
    data = get_json_body()
    if data.get('budget') is None and not data.get('planData'):
        return json_response(error='budget or planData is required', status=400)

    trip = TripModel.create(get_jwt_identity(), data)
    return json_response(data=trip, message='Trip created successfully', status=201)


@trips_bp.route('/<trip_id>', methods=['PUT'])
@jwt_required()
def update_trip(trip_id):
    """Update trip"""
    trip = TripModel.update(trip_id, get_jwt_identity(), get_json_body())
    if not trip:
        return json_response(error='Trip not found', status=404)
    return json_response(data=trip, message='Trip updated successfully')


@trips_bp.route('/<trip_id>', methods=['DELETE'])
@jwt_required()
def delete_trip(trip_id):
    """Delete trip"""
    if not TripModel.delete(trip_id, get_jwt_identity()):
        return json_response(error='Trip not found', status=404)
    return json_response(message='Trip deleted successfully')


@trips_bp.route('/<trip_id>/itinerary', methods=['PUT'])
@jwt_required()
def update_itinerary(trip_id):
    """Update trip itinerary"""
    data = get_json_body()
    if 'itinerary' not in data:
        return json_response(error='Itinerary data is required', status=400)

    trip = TripModel.update(trip_id, get_jwt_identity(), {'itinerary': data['itinerary']})
    if not trip:
        return json_response(error='Trip not found', status=404)
    return json_response(data=trip, message='Itinerary updated successfully')


@trips_bp.route('/<trip_id>/status', methods=['PATCH'])
@jwt_required()
def update_trip_status(trip_id):
    """Update trip status"""
    data = get_json_body()
    status = data.get('status')
    if status not in ['planned', 'ongoing', 'completed']:
        return json_response(error='Status is required and must be planned, ongoing, or completed', status=400)

    trip = TripModel.update(trip_id, get_jwt_identity(), {'status': status})
    if not trip:
        return json_response(error='Trip not found', status=404)
    return json_response(data=trip, message='Trip status updated successfully')
