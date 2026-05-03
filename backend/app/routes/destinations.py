from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.destination import DestinationModel
from app.models.user import UserModel
from app.utils import get_json_body, json_response, validate_required_fields, parse_int

destinations_bp = Blueprint('destinations', __name__)


def is_admin(user_id: str) -> bool:
    """Check if user is admin"""
    user = UserModel.find_by_id(user_id)
    return bool(user and user.get('role') == 'admin')


@destinations_bp.route('', methods=['GET'])
def get_destinations():
    """Get all destinations with optional filtering"""
    filters = {
        'type': request.args.get('type'),
        'region': request.args.get('region'),
        'maxBudget': parse_int(request.args.get('maxBudget')),
        'minBudget': parse_int(request.args.get('minBudget')),
        'activities': request.args.get('activities') and request.args.get('activities').split(',')
    }

    destinations = DestinationModel.find_all(
        filters={k: v for k, v in filters.items() if v is not None},
        sort_by=request.args.get('sortBy', 'userRating'),
        sort_order=-1 if request.args.get('sortOrder', 'desc') == 'desc' else 1,
        limit=parse_int(request.args.get('limit'), 50),
        skip=parse_int(request.args.get('skip'), 0)
    )

    return json_response(data=destinations, message='Destinations fetched successfully')


@destinations_bp.route('/<destination_id>', methods=['GET'])
def get_destination(destination_id):
    destination = DestinationModel.find_by_id(destination_id)
    if not destination:
        return json_response(error='Destination not found', status=404)
    return json_response(data=destination)


@destinations_bp.route('', methods=['POST'])
@jwt_required()
def create_destination():
    current_user_id = get_jwt_identity()
    if not is_admin(current_user_id):
        return json_response(error='Admin access required', status=403)

    data = get_json_body()
    missing = validate_required_fields(data, ['name', 'type', 'region', 'cost'])
    if missing:
        return json_response(error=f'{missing} is required', status=400)

    destination = DestinationModel.create(data)
    return json_response(data=destination, message='Destination created successfully', status=201)


@destinations_bp.route('/<destination_id>', methods=['PUT'])
@jwt_required()
def update_destination(destination_id):
    if not is_admin(get_jwt_identity()):
        return json_response(error='Admin access required', status=403)

    destination = DestinationModel.update(destination_id, get_json_body())
    if not destination:
        return json_response(error='Destination not found', status=404)
    return json_response(data=destination, message='Destination updated successfully')


@destinations_bp.route('/<destination_id>', methods=['DELETE'])
@jwt_required()
def delete_destination(destination_id):
    if not is_admin(get_jwt_identity()):
        return json_response(error='Admin access required', status=403)

    if not DestinationModel.delete(destination_id):
        return json_response(error='Destination not found', status=404)
    return json_response(message='Destination deleted successfully')


@destinations_bp.route('/filters/regions', methods=['GET'])
def get_regions():
    return json_response(data=DestinationModel.get_regions())


@destinations_bp.route('/filters/types', methods=['GET'])
def get_types():
    return json_response(data=DestinationModel.get_types())
