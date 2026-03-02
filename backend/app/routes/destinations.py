from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.destination import DestinationModel
from app.models.user import UserModel

destinations_bp = Blueprint('destinations', __name__)


def is_admin(user_id: str) -> bool:
    """Check if user is admin"""
    user = UserModel.find_by_id(user_id)
    return user and user.get('role') == 'admin'


@destinations_bp.route('', methods=['GET'])
def get_destinations():
    """Get all destinations with optional filtering"""
    # Parse query parameters
    filters = {}

    if request.args.get('type'):
        filters['type'] = request.args.get('type')

    if request.args.get('region'):
        filters['region'] = request.args.get('region')

    if request.args.get('maxBudget'):
        try:
            filters['maxBudget'] = int(request.args.get('maxBudget'))
        except ValueError:
            pass

    if request.args.get('minBudget'):
        try:
            filters['minBudget'] = int(request.args.get('minBudget'))
        except ValueError:
            pass

    if request.args.get('activities'):
        filters['activities'] = request.args.get('activities').split(',')

    # Sorting
    sort_by = request.args.get('sortBy', 'userRating')
    sort_order = -1 if request.args.get('sortOrder', 'desc') == 'desc' else 1

    # Pagination
    try:
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
    except ValueError:
        limit, skip = 50, 0

    destinations = DestinationModel.find_all(
        filters=filters,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        skip=skip
    )

    return jsonify({
        'success': True,
        'data': destinations,
        'count': len(destinations)
    })


@destinations_bp.route('/<destination_id>', methods=['GET'])
def get_destination(destination_id):
    """Get single destination by ID"""
    destination = DestinationModel.find_by_id(destination_id)

    if not destination:
        return jsonify({
            'success': False,
            'error': 'Destination not found'
        }), 404

    return jsonify({
        'success': True,
        'data': destination
    })


@destinations_bp.route('', methods=['POST'])
@jwt_required()
def create_destination():
    """Create a new destination (admin only)"""
    current_user_id = get_jwt_identity()

    if not is_admin(current_user_id):
        return jsonify({
            'success': False,
            'error': 'Admin access required'
        }), 403

    data = request.get_json()

    # Validate required fields
    required_fields = ['name', 'type', 'region', 'cost']
    for field in required_fields:
        if not data.get(field):
            return jsonify({
                'success': False,
                'error': f'{field} is required'
            }), 400

    destination = DestinationModel.create(data)

    return jsonify({
        'success': True,
        'message': 'Destination created successfully',
        'data': destination
    }), 201


@destinations_bp.route('/<destination_id>', methods=['PUT'])
@jwt_required()
def update_destination(destination_id):
    """Update destination (admin only)"""
    current_user_id = get_jwt_identity()

    if not is_admin(current_user_id):
        return jsonify({
            'success': False,
            'error': 'Admin access required'
        }), 403

    data = request.get_json()
    destination = DestinationModel.update(destination_id, data)

    if not destination:
        return jsonify({
            'success': False,
            'error': 'Destination not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Destination updated successfully',
        'data': destination
    })


@destinations_bp.route('/<destination_id>', methods=['DELETE'])
@jwt_required()
def delete_destination(destination_id):
    """Delete destination (admin only)"""
    current_user_id = get_jwt_identity()

    if not is_admin(current_user_id):
        return jsonify({
            'success': False,
            'error': 'Admin access required'
        }), 403

    success = DestinationModel.delete(destination_id)

    if not success:
        return jsonify({
            'success': False,
            'error': 'Destination not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Destination deleted successfully'
    })


@destinations_bp.route('/filters/regions', methods=['GET'])
def get_regions():
    """Get all unique regions"""
    regions = DestinationModel.get_regions()

    return jsonify({
        'success': True,
        'data': regions
    })


@destinations_bp.route('/filters/types', methods=['GET'])
def get_types():
    """Get all unique travel types"""
    types = DestinationModel.get_types()

    return jsonify({
        'success': True,
        'data': types
    })
