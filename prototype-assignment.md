# Prototype Assignment

You are required to develop a **web application** with the requirements given below.

---

## Home Page

### Search Bar
Enter a query like:

> “Plan a 3-day trip to northern Pakistan under 25,000 PKR”

On search:
- Extract basic parameters (destination, days, budget)
- Use simple string parsing or a mock NLP module

### Recommended Destinations
- Show sample Recommended Destination cards dynamically
- Data source: JSON, mock database, or static API

---

## Guest User Access

- Guest users can browse and use the app without registration
- Registration/Login is optional
- Required only for saving trips or personalized plans

### Travel Suggestions
Examples:
- Top Adventure Spots under 20,000 PKR
- Best Weekend Destinations Near You

---

## User Registration and Profile Management

### Registration Form
- Email
- Name
- Password

### Profile Preferences
Users can save:
- Budget range
- Travel style (Adventure, Relaxation, Family, etc.)
- Duration

---

# Destination Recommendation

## Data Sources
- Public APIs (TripAdvisor, Google Places)
- Prebuilt database

Dataset name: `destinations`

---

## Destination Attributes

| Attribute | Description |
|-----------|-------------|
| name | Name of the destination |
| type | Travel type |
| region | Geographical region |
| cost | Average trip cost (PKR) |
| weather | Typical weather |
| best_season | Recommended season |
| activities | List of activities |
| safety_rating | Rating 1–5 |
| user_rating | Rating 1–5 |
| image | File path or URL |

---

## Sample JSON

```json
[
  {
    "name": "Hunza Valley",
    "type": "Adventure",
    "region": "Gilgit Baltistan",
    "cost": 25000,
    "weather": "Cool",
    "best_season": "Summer",
    "activities": ["Hiking", "Sightseeing", "Photography"],
    "safety_rating": 5,
    "user_rating": 4.8,
    "image": "hunza.jpg"
  },
  {
    "name": "Gwadar Beach",
    "type": "Relaxation",
    "region": "Balochistan",
    "cost": 18000,
    "weather": "Warm",
    "best_season": "Winter",
    "activities": ["Swimming", "Sunbathing", "Boat Ride"],
    "safety_rating": 4,
    "user_rating": 4.5,
    "image": "gwadar.jpg"
  },
  {
    "name": "Murree",
    "type": "Family",
    "region": "Punjab",
    "cost": 15000,
    "weather": "Cold",
    "best_season": "All Year",
    "activities": ["Shopping", "Cable Car", "Hiking"],
    "safety_rating": 4,
    "user_rating": 4.3,
    "image": "murree.jpg"
  }
]
```

---

# Machine Learning Recommendations

Use:
- Content-Based Filtering
- Collaborative Filtering

For new users, use a cold-start heuristic based on popular destinations.

Display recommended destinations with images, costs, and weather info.

---

# Budget Estimation & Cost Optimization

| Item | Cost (PKR) |
|--------|-----------|
| Hotel | 10,000 |
| Travel | 8,000 |
| Meals | 5,000 |
| **Total** | **23,000** |

---

# Admin Dashboard

Admin can manage:
- Destination data
- Pricing
- Seasonal updates
- User activity statistics
- Feedback
- AI models and datasets

---

# Tech Stack

## Frontend
- React.js / Vue.js
- HTML, CSS, JavaScript

## Backend
- Python (Flask / Django)

## AI/ML
- scikit-learn
- TensorFlow
- spaCy / Transformers

## Database
- MySQL / MongoDB

## APIs
- Google Maps API
- Weather API
- Travel Advisor API

---

# Supervisor

**Name:** Amna Bibi  
**Email:** amna.bibi@vu.edu.pk  
**Teams ID:** aamna.bibi26@outlook.com  
