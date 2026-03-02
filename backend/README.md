# Travel Buddy API

Flask REST API backend for the Travel Buddy travel recommendation platform. Provides NLP-powered destination search, user authentication, trip planning, and content-based recommendations for Pakistani travel destinations.

## Tech Stack

- **Framework:** Flask 3.0 with application factory pattern
- **Database:** MongoDB (via Flask-PyMongo)
- **Auth:** JWT access + refresh tokens (Flask-JWT-Extended)
- **NLP:** Regex-based query parser (extracts destination, budget, duration, travel type, activities)
- **Recommendations:** Content-based scoring engine

## Prerequisites

- Python 3.9+
- MongoDB 6.0+ running locally (or a connection URI)

## Setup

### 1. Clone and navigate to the backend

```bash
cd backend
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note:** `spacy` and `scikit-learn` are listed in requirements but the current NLP parser uses only `re` (regex). The spaCy model download step is not required unless you extend the parser.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
FLASK_ENV=development
SECRET_KEY=your-super-secret-key-change-this
JWT_SECRET_KEY=your-jwt-secret-key-change-this
MONGO_URI=mongodb://localhost:27017/travel_buddy
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### 5. Start MongoDB

Make sure MongoDB is running before starting the server:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows — start from Services or run:
mongod
```

### 6. Seed the database

Populates 10 Pakistani destinations and creates an admin user:

```bash
python seed_data.py
```

Default admin credentials created by the seed script:
- **Email:** `admin@travelbuddy.pk`
- **Password:** `admin123`

### 7. Run the development server

```bash
python run.py
```

The server starts on `http://localhost:5000` by default.

Verify it's running:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{ "status": "healthy", "message": "Travel Buddy API is running" }
```

---

## API Reference

All responses follow the shape `{ "success": bool, "data": ..., "error": ... }`.

### Authentication — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login, returns JWT tokens |
| POST | `/refresh` | Refresh token | Get new access token |
| GET | `/profile` | JWT | Get current user profile |
| PUT | `/profile` | JWT | Update name / preferences |
| PUT | `/preferences` | JWT | Update travel preferences |

**Register body:**
```json
{
  "name": "Areeba",
  "email": "areeba@example.com",
  "password": "secret123"
}
```

**Login response includes:**
```json
{
  "token": "<access_token>",
  "refreshToken": "<refresh_token>",
  "user": { ... }
}
```

Pass the access token in subsequent requests:
```
Authorization: Bearer <access_token>
```

---

### Destinations — `/api/destinations`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | List destinations (filterable) |
| GET | `/<id>` | No | Get single destination |
| POST | `/` | Admin JWT | Create destination |
| PUT | `/<id>` | Admin JWT | Update destination |
| DELETE | `/<id>` | Admin JWT | Delete destination |
| GET | `/filters/regions` | No | List unique regions |
| GET | `/filters/types` | No | List unique travel types |

**Query parameters for `GET /`:**

| Param | Type | Example |
|-------|------|---------|
| `type` | string | `Adventure` |
| `region` | string | `Gilgit Baltistan` |
| `minBudget` | int | `10000` |
| `maxBudget` | int | `30000` |
| `activities` | comma-list | `Hiking,Camping` |
| `sortBy` | string | `userRating` |
| `sortOrder` | `asc`/`desc` | `desc` |
| `limit` | int | `20` |
| `skip` | int | `0` |

---

### Trips — `/api/trips` (all require JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user's trips (filter by `?status=planned`) |
| GET | `/<id>` | Get single trip |
| POST | `/` | Create a trip |
| PUT | `/<id>` | Update trip |
| DELETE | `/<id>` | Delete trip |
| PUT | `/<id>/itinerary` | Update trip itinerary |
| PATCH | `/<id>/status` | Update status (`planned`/`ongoing`/`completed`) |

**Create trip body:**
```json
{
  "destinationId": "<destination_id>",
  "startDate": "2025-06-01",
  "endDate": "2025-06-07",
  "budget": 25000
}
```

---

### Search — `/api/search`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Optional JWT | NLP-powered search |
| GET | `/quick?q=<keyword>` | No | Keyword search |
| GET | `/popular` | No | Top-rated destinations |
| GET | `/similar/<id>` | No | Similar destinations |
| POST | `/parse` | No | Debug: parse query only |
| POST | `/budget-estimate` | No | Estimate trip budget |
| POST | `/itinerary` | No | Generate sample itinerary |

**NLP search example:**
```json
POST /api/search
{
  "query": "adventure trip to Hunza for 5 days under 30000 rupees",
  "limit": 5
}
```

The parser extracts: destination, region, budget, duration, travel type, and activities from natural language. If authenticated, user preferences boost recommendation scores.

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py          # App factory (Flask, extensions, blueprints)
│   ├── config.py            # Config classes (development / production / testing)
│   ├── models/
│   │   ├── user.py          # User CRUD + bcrypt password hashing
│   │   ├── destination.py   # Destination CRUD + text search
│   │   └── trip.py          # Trip CRUD
│   ├── routes/
│   │   ├── auth.py          # /api/auth endpoints
│   │   ├── destinations.py  # /api/destinations endpoints
│   │   ├── trips.py         # /api/trips endpoints
│   │   └── search.py        # /api/search endpoints
│   ├── services/
│   │   ├── nlp_parser.py    # Regex NLP query parser
│   │   └── recommendation.py # Content-based scoring engine
│   └── ml/
│       ├── query_parser.py  # (ML extension placeholder)
│       └── recommender.py   # (ML extension placeholder)
├── run.py                   # Entry point
├── seed_data.py             # DB seeder (destinations + admin user)
├── requirements.txt
└── .env.example
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `development` | `development`, `production`, or `testing` |
| `FLASK_DEBUG` | `true` | Enable debug mode |
| `FLASK_HOST` | `0.0.0.0` | Bind address |
| `FLASK_PORT` | `5000` | Port |
| `SECRET_KEY` | *(insecure default)* | Flask session secret |
| `JWT_SECRET_KEY` | *(insecure default)* | JWT signing key |
| `MONGO_URI` | `mongodb://localhost:27017/travel_buddy` | MongoDB connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

> **Always set `SECRET_KEY` and `JWT_SECRET_KEY` to strong random values in production.**

---

## Common Issues

**`pymongo.errors.ServerSelectionTimeoutError`** — MongoDB is not running. Start it with `mongod` or your system's service manager.

**`ModuleNotFoundError: No module named 'app'`** — Run `python run.py` or `python seed_data.py` from the `backend/` directory (not from inside `app/`).

**CORS errors in browser** — Make sure the frontend origin is listed in `CORS_ORIGINS` in your `.env`.

**JWT token expired** — Access tokens expire after 24 hours. Use `POST /api/auth/refresh` with your refresh token (valid 30 days) to get a new one.
