import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import get_settings
from app.core.database import connect_db, close_db

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)

# Must set GOOGLE_API_KEY in os.environ BEFORE importing any google-adk/google-genai
# modules, because the ADK client reads it at initialization time.
settings = get_settings()
if settings.GOOGLE_API_KEY:
    os.environ.setdefault("GOOGLE_API_KEY", settings.GOOGLE_API_KEY)

from app.api.routes import auth, trips, destinations, search, weather, chat, agent  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events"""
    # Startup
    print("Starting Travel Buddy API...")
    await connect_db()
    yield
    # Shutdown
    print("Shutting down Travel Buddy API...")
    await close_db()


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(trips.router, prefix="/api/trips", tags=["trips"])
app.include_router(destinations.router, prefix="/api/destinations", tags=["destinations"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(weather.router, prefix="/api", tags=["weather"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(agent.router, prefix="/api/agent", tags=["agent"])


# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "message": "Travel Buddy API is running",
        },
    }


# Exception handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handle 404 Not Found"""
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Not Found",
            "message": "The requested resource was not found",
        },
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handle 500 Internal Server Error"""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
