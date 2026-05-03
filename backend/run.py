#!/usr/bin/env python3
"""
Travel Buddy API - FastAPI Entry Point
Run this file to start the FastAPI development server.
"""

import os
import sys
import uvicorn

# Set encoding to UTF-8
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

if __name__ == "__main__":
    host = os.getenv("FASTAPI_HOST", "0.0.0.0")
    port = int(os.getenv("FASTAPI_PORT", 5000))
    reload = os.getenv("FASTAPI_RELOAD", "true").lower() == "true"

    print(f"""
    Travel Buddy API Server (FastAPI)
    Running on: http://{host}:{port}
    Environment: {os.getenv('ENVIRONMENT', 'development')}
    Reload: {'On' if reload else 'Off'}
    API Docs: http://localhost:{port}/docs
    """)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
    )
