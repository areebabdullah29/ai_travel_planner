from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List


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


class PreferencesUpdate(BaseModel):
    budgetRange: Optional[Dict[str, int]] = None
    travelStyles: Optional[List[str]] = None
    preferredRegions: Optional[List[str]] = None
    tripDuration: Optional[int] = Field(None, ge=1, le=90)


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    currentPassword: Optional[str] = None
    newPassword: Optional[str] = Field(None, min_length=6)
    confirmPassword: Optional[str] = None
    preferences: Optional[PreferencesUpdate] = None


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
