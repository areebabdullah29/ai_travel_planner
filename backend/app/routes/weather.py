import os
import requests
from flask import Blueprint, request
from app.utils import json_response

weather_bp = Blueprint('weather', __name__)

OWM_API_KEY = os.getenv('OPENWEATHER_API_KEY', '')
OPENTRIPMAP_KEY = os.getenv('OPENTRIPMAP_API_KEY', '')


@weather_bp.route('/weather/<city>', methods=['GET'])
def get_weather(city):
    if not OWM_API_KEY:
        return json_response(error='Weather API key not configured', status=503)
    try:
        r = requests.get(
            'https://api.openweathermap.org/data/2.5/weather',
            params={'q': city, 'appid': OWM_API_KEY, 'units': 'metric'},
            timeout=10,
        )
        if not r.ok:
            return json_response(error='City not found or weather unavailable', status=404)
        d = r.json()
        return json_response(data={
            'city': d['name'],
            'country': d['sys']['country'],
            'temp': round(d['main']['temp']),
            'feels_like': round(d['main']['feels_like']),
            'humidity': d['main']['humidity'],
            'description': d['weather'][0]['description'].title(),
            'icon': d['weather'][0]['icon'],
            'wind_speed': d['wind']['speed'],
            'visibility': d.get('visibility', 0) // 1000,
        })
    except requests.Timeout:
        return json_response(error='Weather service timeout', status=504)
    except Exception as e:
        return json_response(error=str(e), status=500)


@weather_bp.route('/forecast/<city>', methods=['GET'])
def get_forecast(city):
    if not OWM_API_KEY:
        return json_response(error='Weather API key not configured', status=503)
    try:
        r = requests.get(
            'https://api.openweathermap.org/data/2.5/forecast',
            params={'q': city, 'appid': OWM_API_KEY, 'units': 'metric', 'cnt': 8},
            timeout=10,
        )
        if not r.ok:
            return json_response(error='Forecast unavailable', status=404)
        data = r.json()
        forecasts = [
            {
                'time': item['dt_txt'],
                'temp': round(item['main']['temp']),
                'description': item['weather'][0]['description'].title(),
                'icon': item['weather'][0]['icon'],
                'humidity': item['main']['humidity'],
                'wind_speed': item['wind']['speed'],
            }
            for item in data['list']
        ]
        return json_response(data=forecasts)
    except Exception as e:
        return json_response(error=str(e), status=500)


def _get_coords(city: str):
    """Get lat/lon via OpenTripMap geoname endpoint."""
    try:
        r = requests.get(
            'https://api.opentripmap.com/0.1/en/places/geoname',
            params={'name': city, 'apikey': OPENTRIPMAP_KEY},
            timeout=10,
        )
        if not r.ok:
            return None, None
        d = r.json()
        return d.get('lat'), d.get('lon')
    except Exception:
        return None, None


@weather_bp.route('/hotels/<city>', methods=['GET'])
def get_hotels(city):
    if not OPENTRIPMAP_KEY:
        return json_response(error='Hotels API key not configured', status=503)
    try:
        lat, lon = _get_coords(city)
        if lat is None or lon is None:
            return json_response(error='Location not found', status=404)
        radius = int(request.args.get('radius', 10000))
        r = requests.get(
            'https://api.opentripmap.com/0.1/en/places/radius',
            params={
                'radius': radius, 'lon': lon, 'lat': lat,
                'kinds': 'accomodations', 'limit': 15,
                'apikey': OPENTRIPMAP_KEY,
            },
            timeout=15,
        )
        if not r.ok:
            return json_response(error='Hotels data unavailable', status=502)
        hotels = [
            {
                'name': f['properties']['name'],
                'xid': f['properties'].get('xid', ''),
                'kinds': f['properties'].get('kinds', ''),
                'dist': round(f['properties'].get('dist', 0)),
                'rate': f['properties'].get('rate', 0),
            }
            for f in r.json().get('features', [])
            if f.get('properties', {}).get('name')
        ]
        return json_response(data={'hotels': hotels, 'city': city, 'lat': lat, 'lon': lon})
    except Exception as e:
        return json_response(error=str(e), status=500)


@weather_bp.route('/places/<city>', methods=['GET'])
def get_places(city):
    if not OPENTRIPMAP_KEY:
        return json_response(error='Places API key not configured', status=503)
    try:
        lat, lon = _get_coords(city)
        if lat is None or lon is None:
            return json_response(error='Location not found', status=404)
        kinds = request.args.get('kinds', 'interesting_places,tourist_object')
        radius = int(request.args.get('radius', 15000))
        r = requests.get(
            'https://api.opentripmap.com/0.1/en/places/radius',
            params={
                'radius': radius, 'lon': lon, 'lat': lat,
                'kinds': kinds, 'rate': '3', 'limit': 20,
                'apikey': OPENTRIPMAP_KEY,
            },
            timeout=15,
        )
        if not r.ok:
            return json_response(error='Places data unavailable', status=502)
        places = []
        for f in r.json().get('features', []):
            props = f.get('properties', {})
            coords = f.get('geometry', {}).get('coordinates', [])
            if props.get('name'):
                places.append({
                    'name': props['name'],
                    'xid': props.get('xid', ''),
                    'kinds': props.get('kinds', '').split(',')[:3],
                    'rate': props.get('rate', 0),
                    'lon': coords[0] if len(coords) > 1 else None,
                    'lat': coords[1] if len(coords) > 1 else None,
                })
        return json_response(data=places)
    except Exception as e:
        return json_response(error=str(e), status=500)


@weather_bp.route('/exchange-rates', methods=['GET'])
def get_exchange_rates():
    try:
        r = requests.get('https://open.er-api.com/v6/latest/PKR', timeout=10)
        if not r.ok:
            return json_response(error='Exchange rates unavailable', status=502)
        data = r.json()
        rates = data.get('rates', {})
        relevant = {
            k: rates[k]
            for k in ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'AUD', 'INR', 'TRY']
            if k in rates
        }
        return json_response(data={
            'base': 'PKR',
            'rates': relevant,
            'updated': data.get('time_last_update_utc'),
        })
    except Exception as e:
        return json_response(error=str(e), status=500)
