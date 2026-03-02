from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.trip import TripModel

trips_bp = Blueprint('trips', __name__)


@trips_bp.route('', methods=['GET'])
@jwt_required()
def get_trips():
    """Get all trips for current user"""
    current_user_id = get_jwt_identity()

    status = request.args.get('status')
    trips = TripModel.find_by_user(current_user_id, status)

    return jsonify({
        'success': True,
        'data': trips,
        'count': len(trips)
    })


@trips_bp.route('/<trip_id>', methods=['GET'])
@jwt_required()
def get_trip(trip_id):
    """Get single trip by ID"""
    current_user_id = get_jwt_identity()
    trip = TripModel.find_by_id(trip_id, current_user_id)

    if not trip:
        return jsonify({
            'success': False,
            'error': 'Trip not found'
        }), 404

    return jsonify({
        'success': True,
        'data': trip
    })


@trips_bp.route('', methods=['POST'])
@jwt_required()
def create_trip():
    """Create a new trip"""
    current_user_id = get_jwt_identity()
    data = request.get_json()

    # Validate required fields
    required_fields = ['destinationId', 'startDate', 'endDate', 'budget']
    for field in required_fields:
        if not data.get(field):
            return jsonify({
                'success': False,
                'error': f'{field} is required'
            }), 400

    trip = TripModel.create(current_user_id, data)

    return jsonify({
        'success': True,
        'message': 'Trip created successfully',
        'data': trip
    }), 201


@trips_bp.route('/<trip_id>', methods=['PUT'])
@jwt_required()
def update_trip(trip_id):
    """Update trip"""
    current_user_id = get_jwt_identity()
    data = request.get_json()

    trip = TripModel.update(trip_id, current_user_id, data)

    if not trip:
        return jsonify({
            'success': False,
            'error': 'Trip not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Trip updated successfully',
        'data': trip
    })


@trips_bp.route('/<trip_id>', methods=['DELETE'])
@jwt_required()
def delete_trip(trip_id):
    """Delete trip"""
    current_user_id = get_jwt_identity()
    success = TripModel.delete(trip_id, current_user_id)

    if not success:
        return jsonify({
            'success': False,
            'error': 'Trip not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Trip deleted successfully'
    })


@trips_bp.route('/<trip_id>/itinerary', methods=['PUT'])
@jwt_required()
def update_itinerary(trip_id):
    """Update trip itinerary"""
    current_user_id = get_jwt_identity()
    data = request.get_json()

    if 'itinerary' not in data:
        return jsonify({
            'success': False,
            'error': 'Itinerary data is required'
        }), 400

    trip = TripModel.update(trip_id, current_user_id, {'itinerary': data['itinerary']})

    if not trip:
        return jsonify({
            'success': False,
            'error': 'Trip not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Itinerary updated successfully',
        'data': trip
    })


@trips_bp.route('/<trip_id>/status', methods=['PATCH'])
@jwt_required()
def update_trip_status(trip_id):
    """Update trip status"""
    current_user_id = get_jwt_identity()
    data = request.get_json()

    if 'status' not in data:
        return jsonify({
            'success': False,
            'error': 'Status is required'
        }), 400

    valid_statuses = ['planned', 'ongoing', 'completed']
    if data['status'] not in valid_statuses:
        return jsonify({
            'success': False,
            'error': f'Status must be one of: {", ".join(valid_statuses)}'
        }), 400

    trip = TripModel.update(trip_id, current_user_id, {'status': data['status']})

    if not trip:
        return jsonify({
            'success': False,
            'error': 'Trip not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Trip status updated successfully',
        'data': trip
    })
