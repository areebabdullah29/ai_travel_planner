from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)

from app.models.user import UserModel

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()

    # Validate required fields
    required_fields = ['name', 'email', 'password']
    for field in required_fields:
        if not data.get(field):
            return jsonify({
                'success': False,
                'error': f'{field} is required'
            }), 400

    # Check if email already exists
    existing_user = UserModel.find_by_email(data['email'])
    if existing_user:
        return jsonify({
            'success': False,
            'error': 'Email already registered'
        }), 409

    # Validate password length
    if len(data['password']) < 6:
        return jsonify({
            'success': False,
            'error': 'Password must be at least 6 characters'
        }), 400

    # Create user
    user = UserModel.create_user(
        name=data['name'],
        email=data['email'],
        password=data['password'],
        preferences=data.get('preferences')
    )

    # Generate tokens
    access_token = create_access_token(identity=user['id'])
    refresh_token = create_refresh_token(identity=user['id'])

    return jsonify({
        'success': True,
        'message': 'User registered successfully',
        'data': {
            'user': user,
            'token': access_token,
            'refreshToken': refresh_token
        }
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()

    # Validate required fields
    if not data.get('email') or not data.get('password'):
        return jsonify({
            'success': False,
            'error': 'Email and password are required'
        }), 400

    # Find user
    user = UserModel.find_by_email(data['email'])
    if not user:
        return jsonify({
            'success': False,
            'error': 'Invalid email or password'
        }), 401

    # Verify password
    if not UserModel.verify_password(user['password'], data['password']):
        return jsonify({
            'success': False,
            'error': 'Invalid email or password'
        }), 401

    # Serialize user and generate tokens
    serialized_user = UserModel.serialize(user)
    access_token = create_access_token(identity=serialized_user['id'])
    refresh_token = create_refresh_token(identity=serialized_user['id'])

    return jsonify({
        'success': True,
        'message': 'Login successful',
        'data': {
            'user': serialized_user,
            'token': access_token,
            'refreshToken': refresh_token
        }
    })


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    current_user_id = get_jwt_identity()
    access_token = create_access_token(identity=current_user_id)

    return jsonify({
        'success': True,
        'data': {
            'token': access_token
        }
    })


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    current_user_id = get_jwt_identity()
    user = UserModel.find_by_id(current_user_id)

    if not user:
        return jsonify({
            'success': False,
            'error': 'User not found'
        }), 404

    return jsonify({
        'success': True,
        'data': UserModel.serialize(user)
    })


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    current_user_id = get_jwt_identity()
    data = request.get_json()

    user = UserModel.update_profile(current_user_id, data)

    if not user:
        return jsonify({
            'success': False,
            'error': 'User not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Profile updated successfully',
        'data': user
    })


@auth_bp.route('/preferences', methods=['PUT'])
@jwt_required()
def update_preferences():
    """Update user preferences"""
    current_user_id = get_jwt_identity()
    data = request.get_json()

    if not data.get('preferences'):
        return jsonify({
            'success': False,
            'error': 'Preferences data is required'
        }), 400

    user = UserModel.update_preferences(current_user_id, data['preferences'])

    if not user:
        return jsonify({
            'success': False,
            'error': 'User not found'
        }), 404

    return jsonify({
        'success': True,
        'message': 'Preferences updated successfully',
        'data': user
    })
