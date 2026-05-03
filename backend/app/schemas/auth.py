from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any


class UserBase(BaseModel):
    """Base user schema"""
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class UserCreate(UserBase):
    """User creation schema"""
    password: str = Field(..., min_length=6)
    preferences: Optional[Dict[str, Any]] = None


class UserUpdate(BaseModel):
    """User update schema"""
    name: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    """User response schema"""
    id: str
    preferences: Optional[Dict[str, Any]] = None
    role: str = "user"
    createdAt: Optional[str] = None


class RegisterRequest(UserCreate):
    """User registration request"""
    pass


class LoginRequest(BaseModel):
    """User login request"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response"""
    user: UserResponse
    token: str = Field(description="Access token")
    refreshToken: str = Field(description="Refresh token")


class RefreshTokenRequest(BaseModel):
    """Refresh token request"""
    refreshToken: str
