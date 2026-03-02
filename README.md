# AI-Powered Travel Buddy

Smart Travel Recommendation & Planning Web App using Artificial Intelligence

---

## Project Overview

AI-Powered Travel Buddy is an intelligent web-based travel planning system that generates personalized trips using Artificial Intelligence. The platform analyzes budget, duration, weather, and interests to recommend destinations, itineraries, restaurants, activities, and estimated trip costs.

**Supervisor:** Amna Bibi (amna.bibi@vu.edu.pk)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js, TypeScript, Tailwind CSS, Vite |
| **Backend** | Python (Flask) |
| **Database** | MongoDB / MySQL |
| **AI/ML** | scikit-learn, spaCy, Transformers |
| **APIs** | Google Maps API, Weather API, Travel Advisor API |

---

## Development Roadmap

### Phase 1: Frontend Foundation Setup [COMPLETED]

| Step | Task | Status |
|------|------|--------|
| 1.1 | Install dependencies (React Router, Axios, Tailwind CSS, React Icons) | Done |
| 1.2 | Configure Tailwind CSS with custom theme | Done |
| 1.3 | Create folder structure (components, pages, services, types, data, hooks) | Done |
| 1.4 | Setup React Router with all routes | Done |
| 1.5 | Create Layout components (Header, Footer) | Done |

**Files Created:**
- `src/components/layout/Header.tsx` - Navigation bar
- `src/components/layout/Footer.tsx` - Footer with links
- `src/components/DestinationCard.tsx` - Reusable destination card
- `src/pages/Home.tsx` - Landing page with search
- `src/pages/Login.tsx` - Login form
- `src/pages/Register.tsx` - Registration form
- `src/pages/Profile.tsx` - User preferences
- `src/pages/Destinations.tsx` - Browse destinations
- `src/pages/TripPlanner.tsx` - Trip planning page
- `src/types/index.ts` - TypeScript interfaces
- `src/data/destinations.json` - Mock destination data

---

### Phase 2: Build Core UI Pages & Components [PENDING]

| Step | Task | Description |
|------|------|-------------|
| 2.1 | Destination Detail Page | Full destination info with weather, activities, map placeholder |
| 2.2 | Search Component Enhancement | Auto-suggestions, recent searches |
| 2.3 | Itinerary Builder UI | Drag-drop day planner, activity cards |
| 2.4 | Budget Calculator Component | Interactive budget breakdown |
| 2.5 | Weather Widget | Display weather for destinations |
| 2.6 | Map Component Placeholder | Prepare for Google Maps integration |
| 2.7 | Admin Dashboard | Manage destinations, view analytics |
| 2.8 | Loading States & Skeletons | Better UX during data fetching |

---

### Phase 3: Backend Setup (Python Flask) [COMPLETED]

| Step | Task | Status |
|------|------|--------|
| 3.1 | Initialize Flask project | Done |
| 3.2 | Setup Database (MongoDB) | Done |
| 3.3 | Create Data Models | Done |
| 3.4 | Build REST APIs | Done |
| 3.5 | Add JWT Authentication | Done |
| 3.6 | CORS Configuration | Done |
| 3.7 | Error Handling | Done |

**Files Created:**
- `backend/app/__init__.py` - Flask app factory with extensions
- `backend/app/config.py` - Configuration classes (dev/prod/test)
- `backend/app/models/user.py` - User model with bcrypt hashing
- `backend/app/models/destination.py` - Destination CRUD operations
- `backend/app/models/trip.py` - Trip management with itineraries
- `backend/app/routes/auth.py` - Authentication endpoints
- `backend/app/routes/destinations.py` - Destination CRUD + filters
- `backend/app/routes/trips.py` - Trip management endpoints
- `backend/app/routes/search.py` - NLP-powered search
- `backend/app/services/nlp_parser.py` - Natural language query parser
- `backend/app/services/recommendation.py` - Content-based recommendations
- `backend/seed_data.py` - Database seeder script

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/destinations` | List all destinations (with filters) |
| GET | `/api/destinations/:id` | Get single destination |
| POST | `/api/destinations` | Add destination (admin) |
| PUT | `/api/destinations/:id` | Update destination (admin) |
| DELETE | `/api/destinations/:id` | Delete destination (admin) |
| GET | `/api/destinations/filters/regions` | Get all regions |
| GET | `/api/destinations/filters/types` | Get all travel types |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login (returns JWT) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/profile` | Get user profile |
| PUT | `/api/auth/profile` | Update user profile |
| PUT | `/api/auth/preferences` | Update user preferences |
| POST | `/api/trips` | Save a trip |
| GET | `/api/trips` | Get user's saved trips |
| GET | `/api/trips/:id` | Get single trip details |
| PUT | `/api/trips/:id` | Update trip |
| DELETE | `/api/trips/:id` | Delete trip |
| PUT | `/api/trips/:id/itinerary` | Update trip itinerary |
| PATCH | `/api/trips/:id/status` | Update trip status |
| POST | `/api/search` | NLP-powered search with recommendations |
| GET | `/api/search/quick` | Quick keyword search |
| GET | `/api/search/similar/:id` | Get similar destinations |
| GET | `/api/search/popular` | Get popular destinations |
| POST | `/api/search/parse` | Parse NLP query |
| POST | `/api/search/budget-estimate` | Get budget estimate |
| POST | `/api/search/itinerary` | Generate sample itinerary |

---

### Phase 4: AI/ML Features Implementation [PENDING]

| Step | Task | Description |
|------|------|-------------|
| 4.1 | NLP Query Parser | Extract destination, budget, duration, activities from natural language |
| 4.2 | Recommendation Engine | Content-based filtering using destination attributes |
| 4.3 | Collaborative Filtering | Recommend based on similar user preferences |
| 4.4 | Budget Estimator | Calculate travel + hotel + meals + activities |
| 4.5 | Itinerary Generator | Create day-by-day plans based on duration & interests |
| 4.6 | Cold Start Handling | Popular destinations for new users |

**NLP Query Examples:**

| Input | Extracted Parameters |
|-------|---------------------|
| "Plan a 3-day trip to northern Pakistan under 25,000 PKR" | `{days: 3, region: "northern", budget: 25000}` |
| "Family vacation to Murree" | `{type: "Family", destination: "Murree"}` |
| "Adventure trip with hiking and camping" | `{type: "Adventure", activities: ["hiking", "camping"]}` |

---

### Phase 5: API Integration & Polish [PENDING]

| Step | Task | Description |
|------|------|-------------|
| 5.1 | Weather API Integration | Real-time weather for destinations |
| 5.2 | Google Maps Integration | Display locations, routes, distances |
| 5.3 | Connect Frontend to Backend | Axios services for all API calls |
| 5.4 | Authentication Context | Global auth state management |
| 5.5 | Error Handling | Toast notifications, error boundaries |
| 5.6 | Responsive Design Polish | Mobile, tablet, desktop testing |
| 5.7 | Performance Optimization | Lazy loading, code splitting |
| 5.8 | Testing | Unit tests, integration tests |
| 5.9 | Deployment | Deploy frontend and backend |

---

## Project Structure

```
areeba-fyp/
├── frontend/                    # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── DestinationCard.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── WeatherWidget.tsx
│   │   │   └── BudgetCalculator.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── Destinations.tsx
│   │   │   ├── DestinationDetail.tsx
│   │   │   ├── TripPlanner.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── authService.ts
│   │   │   └── destinationService.ts
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── data/
│   │   │   └── destinations.json
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── backend/                     # Flask Backend (To be created)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── destinations.py
│   │   │   ├── trips.py
│   │   │   └── search.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── destination.py
│   │   │   └── trip.py
│   │   ├── services/
│   │   │   ├── recommendation.py
│   │   │   └── nlp_parser.py
│   │   └── ml/
│   │       ├── query_parser.py
│   │       └── recommender.py
│   ├── requirements.txt
│   └── run.py
│
├── README.md                    # This file
├── task.md                      # Project requirements
└── prototype-assignment.md      # Assignment details
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB or MySQL

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

### Backend Setup (Phase 3)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Backend runs at: http://localhost:5000

---

## Features Checklist

### Home Page
- [x] Natural language search bar
- [x] Quick suggestion chips
- [x] Featured destinations grid
- [ ] Weather highlights
- [ ] Personalized greetings (after login)

### User Management
- [x] Registration form UI
- [x] Login form UI
- [x] Profile preferences UI
- [ ] Google OAuth integration
- [ ] JWT authentication

### Destinations
- [x] Destination cards with images
- [x] Filter by type, region, budget
- [x] Search functionality
- [ ] Destination detail page
- [ ] User reviews

### Trip Planning
- [x] NLP query parsing (basic)
- [x] Destination recommendations
- [x] Budget estimation
- [x] Sample itinerary display
- [ ] Save trips
- [ ] Edit itinerary
- [ ] Share trips

### AI/ML Features
- [x] Basic query parsing (frontend)
- [ ] Advanced NLP with spaCy/BERT
- [ ] Content-based recommendations
- [ ] Collaborative filtering
- [ ] Smart budget optimization

### Admin Dashboard
- [ ] Manage destinations
- [ ] View analytics
- [ ] Update pricing
- [ ] Manage users

---

## Database Schema

### Users Collection/Table
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "password": "hashed_string",
  "preferences": {
    "budgetRange": { "min": 10000, "max": 50000 },
    "travelStyles": ["Adventure", "Family"],
    "preferredRegions": ["Gilgit Baltistan"],
    "tripDuration": 5
  },
  "createdAt": "datetime"
}
```

### Destinations Collection/Table
```json
{
  "_id": "ObjectId",
  "name": "Hunza Valley",
  "type": "Adventure",
  "region": "Gilgit Baltistan",
  "cost": 25000,
  "weather": "Cool",
  "bestSeason": "Summer",
  "activities": ["Hiking", "Sightseeing"],
  "safetyRating": 5,
  "userRating": 4.8,
  "image": "url",
  "description": "string"
}
```

### Trips Collection/Table
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "destinationId": "ObjectId",
  "startDate": "date",
  "endDate": "date",
  "budget": 25000,
  "itinerary": [
    {
      "day": 1,
      "activities": [
        { "name": "Arrival", "time": "10:00", "cost": 0 }
      ]
    }
  ],
  "status": "planned",
  "createdAt": "datetime"
}
```

---

## Current Progress

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Frontend Foundation | Completed | 100% |
| Phase 2: Core UI Components | Not Started | 0% |
| Phase 3: Backend Setup | Not Started | 0% |
| Phase 4: AI/ML Features | Not Started | 0% |
| Phase 5: Integration & Polish | Not Started | 0% |

**Overall Progress: ~20%**

---

## Next Steps

1. Continue with **Phase 2** - Build remaining UI components
2. Set up **Flask backend** with database
3. Implement **authentication** flow
4. Add **NLP query parsing** on backend
5. Integrate **external APIs** (Weather, Maps)

---

## License

This project is developed for educational purposes as part of Virtual University coursework.
