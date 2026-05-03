from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import UserModel
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    RefreshTokenRequest,
)
from app.api.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: RegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Register a new user"""
    # Check if email already exists
    existing_user = await UserModel.find_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Create user
    user = await UserModel.create_user(
        db,
        name=user_data.name,
        email=user_data.email,
        password=user_data.password,
        preferences=user_data.preferences,
    )

    # Generate tokens
    access_token = create_access_token({"sub": user["id"]})
    refresh_token = create_refresh_token({"sub": user["id"]})

    return TokenResponse(
        user=UserResponse(**user),
        token=access_token,
        refreshToken=refresh_token,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Login user and return JWT tokens"""
    # Find user by email
    user_doc = await UserModel.find_by_email(db, credentials.email)
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Verify password
    if not UserModel.verify_password(user_doc["password"], credentials.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Serialize user
    user = UserModel.serialize(user_doc)

    # Generate tokens
    access_token = create_access_token({"sub": user["id"]})
    refresh_token = create_refresh_token({"sub": user["id"]})

    return TokenResponse(
        user=UserResponse(**user),
        token=access_token,
        refreshToken=refresh_token,
    )


@router.post("/refresh")
async def refresh(
    req: RefreshTokenRequest,
):
    """Refresh access token using refresh token"""
    user_id = decode_token(req.refreshToken)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    access_token = create_access_token({"sub": user_id})
    return {"token": access_token}


@router.get("/profile", response_model=UserResponse)
async def get_profile(
    current_user=Depends(get_current_user),
):
    """Get current user profile"""
    return UserResponse(**current_user)
