# TravelBuddy — AI-Powered Travel Planning

A full-stack Final Year Project (FYP) that lets users plan personalised trips through an intelligent AI chat interface. Users describe their destination, budget, and duration in plain language; TravelBuddy generates a complete day-by-day itinerary, restaurant picks, cost breakdown, and practical travel information — all adjusted to their exact budget.

---

## Overview

TravelBuddy combines a conversational AI interface (powered by Claude) with a Flask/MongoDB backend to deliver a seamless travel planning experience. The AI understands natural language inputs like *"Paris for 7 days with a budget of 600K PKR"*, validates the budget against real destination minimums, and generates a fully detailed trip plan. Trips are saved per user, accessible across devices, and persist even when the backend is offline (localStorage fallback).

**Supervisor:** Amna Bibi — amna.bibi@vu.edu.pk
**University:** Virtual University of Pakistan

---

## Key Features

- **Natural language trip planning** — describe your trip in one sentence and the AI extracts destination, duration, and budget automatically
- **Budget validation** — warns users if their budget is too low for a destination and suggests alternatives or shorter durations
- **Multi-currency support** — PKR, USD, EUR, GBP, AED, SAR, CAD, AUD, INR, TRY with live conversion
- **AI-generated itineraries** — day-by-day schedules, restaurant recommendations, cost breakdowns, and practical travel info
- **User accounts** — register/login with JWT authentication; trips are saved per user
- **Offline fallback** — full app functionality via localStorage when the backend is unavailable
- **Search history** — per-user history of previous searches and generated plans
- **Responsive design** — works on mobile, tablet, and desktop

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7 | Build tool and dev server |
| Tailwind CSS | 4 | Utility-first styling (`@tailwindcss/vite` plugin) |
| Framer Motion | 12 | Animations and page transitions |
| React Router DOM | 7 | Client-side routing |
| Lucide React | 0.575 | Icon library |
| Anthropic SDK | 0.78 | Claude AI API client |
| Axios | 1.13 | HTTP client for backend calls |
| clsx + tailwind-merge | — | Conditional class utilities |

**Key frontend files:**

```
frontend/src/
├── pages/
│   ├── Home.tsx          # Hero with search bar and destination chips
│   ├── TripPlanner.tsx   # AI chat interface + plan generation
│   ├── Itinerary.tsx     # Tabbed results (Itinerary / Restaurants / Costs / Info)
│   ├── Dashboard.tsx     # Saved trips grid + search history
│   ├── Login.tsx         # Split-screen auth page
│   └── Register.tsx      # 2-step registration wizard
├── context/
│   ├── AuthContext.tsx   # Auth state + login/logout/register
│   └── TripContext.tsx   # Trip state + localStorage persistence
├── services/
│   └── claudeService.ts  # Claude API calls + mock plan generator
├── components/layout/    # Header, Footer, Layout
├── data/
│   └── destinations.json # Destination database (Bali, Bangkok, Tokyo, Singapore, Dubai, London …)
└── types/index.ts        # Shared TypeScript interfaces
```

---

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Runtime |
| Flask | 3.0 | Web framework |
| Flask-PyMongo | 2.3 | MongoDB ODM |
| Flask-JWT-Extended | 4.6 | JWT authentication |
| Flask-CORS | 4.0 | Cross-origin resource sharing |
| PyMongo | 4.6 | MongoDB driver |
| bcrypt | 4.1 | Password hashing |
| marshmallow | 3.20 | Request validation |
| spaCy | 3.7 | NLP for query parsing |
| scikit-learn | 1.3 | ML recommendation engine |
| NumPy | 1.26 | Numerical operations |
| python-dotenv | 1.0 | Environment variable management |

**API endpoints:**

```
POST   /api/auth/register       Register a new user
POST   /api/auth/login          Login and receive JWT tokens
GET    /api/auth/profile        Get authenticated user profile
PUT    /api/auth/preferences    Update user travel preferences
POST   /api/auth/refresh        Refresh access token

GET    /api/trips               Get all trips for current user
POST   /api/trips               Save a new trip plan
PATCH  /api/trips/:id/status    Update trip status (planned/ongoing/completed)
DELETE /api/trips/:id           Delete a trip

GET    /api/destinations        List/search destinations
GET    /api/destinations/:id    Get destination details

GET    /api/search              Search destinations (NLP-powered)

GET    /api/health              Health check
```

**Key backend files:**

```
backend/
├── run.py                  # App entry point
├── seed_data.py            # Seed MongoDB with sample destinations
├── requirements.txt        # Python dependencies
└── app/
    ├── __init__.py         # App factory (Flask + blueprints)
    ├── config.py           # Environment configs (dev/prod/test)
    ├── models/
    │   ├── user.py         # User model
    │   ├── trip.py         # Trip model (stores full planData)
    │   └── destination.py  # Destination model
    ├── routes/
    │   ├── auth.py         # Auth routes
    │   ├── trips.py        # Trip CRUD routes
    │   ├── destinations.py # Destination routes
    │   └── search.py       # NLP search route
    ├── services/
    │   ├── nlp_parser.py   # Natural language processing
    │   └── recommendation.py # Destination recommendation logic
    └── ml/
        ├── query_parser.py # Query understanding
        └── recommender.py  # ML-based recommendation engine
```

---

## Running Locally

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- **MongoDB** running locally on `mongodb://localhost:27017` (or a MongoDB Atlas URI)
- An **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com))

---

### 1. Clone the repository

```bash
git clone <repository-url>
cd areeba-fyp
```

---

### 2. Backend setup

```bash
cd backend
uv run uvicorn app.main:app --port 5000 --reload  
```


**Create and activate a virtual environment:**

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

**Download the spaCy language model:**

```bash
python -m spacy download en_core_web_sm
```

**Create the environment file:**

```bash
# Create backend/.env
```

Add the following to `backend/.env`:

```env
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-here
MONGO_URI=mongodb://localhost:27017/travel_buddy
CORS_ORIGINS=http://localhost:5173
```

**(Optional) Seed the database with sample destinations:**

```bash
python seed_data.py
```

**Start the backend server:**

```bash
python run.py
```

The API will be available at `http://localhost:5000`. Test it:

```
GET http://localhost:5000/api/health
```

---

### 3. Frontend setup

Open a new terminal:

```bash
cd frontend
```

**Install dependencies:**

```bash
npm install
```

**Create the environment file:**

```bash
# Create frontend/.env
```

Add the following to `frontend/.env`:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
VITE_API_URL=http://localhost:5000
```

> **Note:** `VITE_ANTHROPIC_API_KEY` enables live Claude AI responses. Without it, the app uses a built-in smart mock response system — all features still work.

**Start the development server:**

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

### 4. Build for production

```bash
cd frontend
npm run build
```

The production build will be output to `frontend/dist/`.

---

## Environment Variables Reference

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | Optional | Claude API key for live AI responses |
| `VITE_API_URL` | Optional | Backend URL (defaults to `http://localhost:5000`) |

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `SECRET_KEY` | Yes | Flask secret key |
| `JWT_SECRET_KEY` | Yes | JWT signing secret |
| `FLASK_ENV` | No | `development` or `production` (default: `development`) |
| `CORS_ORIGINS` | No | Allowed frontend origins (default: `http://localhost:5173`) |

---

## Project Structure

```
areeba-fyp/
├── backend/                 # Flask API
│   ├── app/
│   │   ├── models/          # MongoDB models (User, Trip, Destination)
│   │   ├── routes/          # API route blueprints
│   │   ├── services/        # Business logic + NLP
│   │   └── ml/              # Recommendation engine
│   ├── requirements.txt
│   └── run.py
└── frontend/                # React app
    ├── src/
    │   ├── components/      # Reusable UI components
    │   ├── context/         # React context (Auth, Trip state)
    │   ├── data/            # destinations.json (static destination DB)
    │   ├── pages/           # Route-level page components
    │   ├── services/        # API and Claude service calls
    │   └── types/           # TypeScript type definitions
    ├── package.json
    └── vite.config.ts
```
