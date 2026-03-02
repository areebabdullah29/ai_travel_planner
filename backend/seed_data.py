#!/usr/bin/env python3
"""
Seed script to populate the database with initial destination data.
Run this script after setting up MongoDB to add sample destinations.
"""

import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, mongo


# Sample destinations data (from frontend destinations.json)
DESTINATIONS = [
    {
        "name": "Hunza Valley",
        "type": "Adventure",
        "region": "Gilgit Baltistan",
        "cost": 25000,
        "weather": "Cool",
        "bestSeason": "Summer",
        "activities": ["Hiking", "Sightseeing", "Photography", "Camping"],
        "safetyRating": 5,
        "userRating": 4.8,
        "image": "https://images.unsplash.com/photo-1586076346498-3d59e921dc0f?w=800",
        "description": "Hunza Valley is a breathtaking mountainous region known for its stunning landscapes, ancient forts, and warm hospitality."
    },
    {
        "name": "Gwadar Beach",
        "type": "Relaxation",
        "region": "Balochistan",
        "cost": 18000,
        "weather": "Warm",
        "bestSeason": "Winter",
        "activities": ["Swimming", "Sunbathing", "Boat Ride", "Fishing"],
        "safetyRating": 4,
        "userRating": 4.5,
        "image": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "description": "Gwadar offers pristine beaches, crystal clear waters, and a peaceful retreat from city life."
    },
    {
        "name": "Murree",
        "type": "Family",
        "region": "Punjab",
        "cost": 15000,
        "weather": "Cold",
        "bestSeason": "All Year",
        "activities": ["Shopping", "Cable Car", "Hiking", "Snow Activities"],
        "safetyRating": 4,
        "userRating": 4.3,
        "image": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
        "description": "Murree is a popular hill station known for its scenic beauty, colonial architecture, and vibrant bazaars."
    },
    {
        "name": "Swat Valley",
        "type": "Adventure",
        "region": "Khyber Pakhtunkhwa",
        "cost": 22000,
        "weather": "Pleasant",
        "bestSeason": "Spring",
        "activities": ["Hiking", "River Rafting", "Historical Sites", "Skiing"],
        "safetyRating": 4,
        "userRating": 4.6,
        "image": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        "description": "Known as the Switzerland of Pakistan, Swat Valley offers lush green meadows, rivers, and Buddhist heritage sites."
    },
    {
        "name": "Lahore",
        "type": "Cultural",
        "region": "Punjab",
        "cost": 12000,
        "weather": "Hot",
        "bestSeason": "Winter",
        "activities": ["Food Tours", "Historical Sites", "Shopping", "Museums"],
        "safetyRating": 5,
        "userRating": 4.7,
        "image": "https://images.unsplash.com/photo-1567157577867-05ccb1388e66?w=800",
        "description": "Lahore, the cultural heart of Pakistan, offers rich history, delicious cuisine, and vibrant nightlife."
    },
    {
        "name": "Skardu",
        "type": "Adventure",
        "region": "Gilgit Baltistan",
        "cost": 30000,
        "weather": "Cold",
        "bestSeason": "Summer",
        "activities": ["Trekking", "Mountaineering", "Camping", "Lake Visits"],
        "safetyRating": 4,
        "userRating": 4.9,
        "image": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800",
        "description": "Skardu is a gateway to the world's highest peaks, offering stunning lakes, deserts, and adventure opportunities."
    },
    {
        "name": "Karachi Beach",
        "type": "Relaxation",
        "region": "Sindh",
        "cost": 10000,
        "weather": "Warm",
        "bestSeason": "Winter",
        "activities": ["Beach Activities", "Seafood", "Water Sports", "Shopping"],
        "safetyRating": 3,
        "userRating": 4.0,
        "image": "https://images.unsplash.com/photo-1520454974749-611b7248ffdb?w=800",
        "description": "Karachi's beaches offer urban beach experiences with water sports, delicious seafood, and sunset views."
    },
    {
        "name": "Naran Kaghan",
        "type": "Family",
        "region": "Khyber Pakhtunkhwa",
        "cost": 20000,
        "weather": "Cool",
        "bestSeason": "Summer",
        "activities": ["Lake Visits", "Boating", "Hiking", "Jeep Safari"],
        "safetyRating": 4,
        "userRating": 4.5,
        "image": "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800",
        "description": "Naran Kaghan valley features beautiful lakes including Lake Saif-ul-Malook and stunning mountain scenery."
    },
    {
        "name": "Fairy Meadows",
        "type": "Adventure",
        "region": "Gilgit Baltistan",
        "cost": 28000,
        "weather": "Cold",
        "bestSeason": "Summer",
        "activities": ["Camping", "Trekking", "Photography", "Stargazing"],
        "safetyRating": 4,
        "userRating": 4.8,
        "image": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
        "description": "Fairy Meadows offers breathtaking views of Nanga Parbat, the world's ninth highest mountain."
    },
    {
        "name": "Islamabad",
        "type": "Cultural",
        "region": "Federal",
        "cost": 8000,
        "weather": "Pleasant",
        "bestSeason": "Spring",
        "activities": ["Museums", "Hiking", "Shopping", "Parks"],
        "safetyRating": 5,
        "userRating": 4.4,
        "image": "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800",
        "description": "Islamabad, the capital city, combines modern architecture with natural beauty and the Margalla Hills."
    }
]

# Default admin user
ADMIN_USER = {
    "name": "Admin",
    "email": "admin@travelbuddy.pk",
    "password": "admin123",  # Will be hashed
    "role": "admin",
    "preferences": {
        "budgetRange": {"min": 0, "max": 100000},
        "travelStyles": ["Adventure", "Cultural", "Family"],
        "preferredRegions": ["Gilgit Baltistan", "Punjab"],
        "tripDuration": 7
    }
}


def seed_destinations():
    """Seed destinations collection"""
    destinations_collection = mongo.db.destinations

    # Clear existing data
    destinations_collection.delete_many({})
    print("Cleared existing destinations")

    # Add timestamps to each destination
    for dest in DESTINATIONS:
        dest['createdAt'] = datetime.utcnow()
        dest['updatedAt'] = datetime.utcnow()

    # Insert destinations
    result = destinations_collection.insert_many(DESTINATIONS)
    print(f"Inserted {len(result.inserted_ids)} destinations")

    return result.inserted_ids


def seed_admin_user():
    """Seed admin user"""
    import bcrypt

    users_collection = mongo.db.users

    # Check if admin already exists
    existing = users_collection.find_one({"email": ADMIN_USER["email"]})
    if existing:
        print("Admin user already exists, skipping...")
        return None

    # Hash password
    hashed_password = bcrypt.hashpw(
        ADMIN_USER["password"].encode('utf-8'),
        bcrypt.gensalt()
    )

    admin = {
        "name": ADMIN_USER["name"],
        "email": ADMIN_USER["email"],
        "password": hashed_password,
        "role": ADMIN_USER["role"],
        "preferences": ADMIN_USER["preferences"],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    result = users_collection.insert_one(admin)
    print(f"Created admin user: {ADMIN_USER['email']}")

    return result.inserted_id


def create_indexes():
    """Create database indexes for better performance"""
    # Destinations indexes
    mongo.db.destinations.create_index("name")
    mongo.db.destinations.create_index("type")
    mongo.db.destinations.create_index("region")
    mongo.db.destinations.create_index("cost")
    mongo.db.destinations.create_index([("name", "text"), ("description", "text")])

    # Users indexes
    mongo.db.users.create_index("email", unique=True)

    # Trips indexes
    mongo.db.trips.create_index("userId")
    mongo.db.trips.create_index("status")
    mongo.db.trips.create_index([("userId", 1), ("status", 1)])

    print("Created database indexes")


def main():
    """Main seed function"""
    print("\n" + "=" * 50)
    print("🌱 Seeding Travel Buddy Database")
    print("=" * 50 + "\n")

    # Create Flask app context
    app = create_app('development')

    with app.app_context():
        try:
            # Create indexes
            create_indexes()

            # Seed destinations
            seed_destinations()

            # Seed admin user
            seed_admin_user()

            print("\n" + "=" * 50)
            print("✅ Database seeding completed successfully!")
            print("=" * 50)
            print("\nAdmin credentials:")
            print(f"  Email: {ADMIN_USER['email']}")
            print(f"  Password: {ADMIN_USER['password']}")
            print("=" * 50 + "\n")

        except Exception as e:
            print(f"\n❌ Error seeding database: {e}")
            sys.exit(1)


if __name__ == '__main__':
    main()
