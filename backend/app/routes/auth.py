from flask import Blueprint
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity

from app.models.user import UserModel
from app.utils import get_json_body, json_response, validate_required_fields

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = get_json_body()
    missing = validate_required_fields(data, ['name', 'email', 'password'])
    if missing:
        return json_response(error=f'{missing} is required', status=400)

    if UserModel.find_by_email(data['email']):
        return json_response(error='Email already registered', status=409)

    if len(data['password']) < 6:
        return json_response(error='Password must be at least 6 characters', status=400)

    user = UserModel.create_user(
        name=data['name'],
        email=data['email'],
        password=data['password'],
        preferences=data.get('preferences')
    )

    access_token = create_access_token(identity=user['id'])
    refresh_token = create_refresh_token(identity=user['id'])

    return json_response(
        data={'user': user, 'token': access_token, 'refreshToken': refresh_token},
        message='User registered successfully',
        status=201
    )


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = get_json_body()
    if not data.get('email') or not data.get('password'):
        return json_response(error='Email and password are required', status=400)

    user = UserModel.find_by_email(data['email'])
    if not user or not UserModel.verify_password(user['password'], data['password']):
        return json_response(error='Invalid email or password', status=401)

    serialized_user = UserModel.serialize(user)
    access_token = create_access_token(identity=serialized_user['id'])
    refresh_token = create_refresh_token(identity=serialized_user['id'])

    return json_response(
        data={'user': serialized_user, 'token': access_token, 'refreshToken': refresh_token},
        message='Login successful'
    )


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    current_user_id = get_jwt_identity()

    return json_response(data={'token': create_access_token(identity=current_user_id)})


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    user = UserModel.find_by_id(get_jwt_identity())
    if not user:
        return json_response(error='User not found', status=404)
    return json_response(data=UserModel.serialize(user))


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    data = get_json_body()
    user = UserModel.update_profile(get_jwt_identity(), data)
    if not user:
        return json_response(error='User not found', status=404)
    return json_response(data=user, message='Profile updated successfully')


@auth_bp.route('/preferences', methods=['PUT'])
@jwt_required()
def update_preferences():
    """Update user preferences"""
    data = get_json_body()
    if not data.get('preferences'):
        return json_response(error='Preferences data is required', status=400)

    user = UserModel.update_preferences(get_jwt_identity(), data['preferences'])
    if not user:
        return json_response(error='User not found', status=404)
    return json_response(data=user, message='Preferences updated successfully')
