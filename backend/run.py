#!/usr/bin/env python3
"""
Travel Buddy API - Main Entry Point
Run this file to start the Flask development server.
"""

import os
from app import create_app

# Create the Flask application
app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    # Get configuration from environment
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'

    print(f"""
    ╔══════════════════════════════════════════════╗
    ║     🌍 Travel Buddy API Server               ║
    ╠══════════════════════════════════════════════╣
    ║  Running on: http://{host}:{port}              ║
    ║  Environment: {os.getenv('FLASK_ENV', 'development'):<19}       ║
    ║  Debug Mode: {'On' if debug else 'Off':<20}       ║
    ╚══════════════════════════════════════════════╝
    """)

    app.run(host=host, port=port, debug=debug)
