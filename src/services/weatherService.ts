const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export interface WeatherData {
  city: string
  country: string
  temp: number
  feels_like: number
  humidity: number
  description: string
  icon: string
  wind_speed: number
  visibility: number
}

export interface ForecastItem {
  time: string
  temp: number
  description: string
  icon: string
  humidity: number
  wind_speed: number
}

export interface RealHotel {
  name: string
  xid: string
  kinds: string
  dist: number
  rate: number
}

export interface RealPlace {
  name: string
  xid: string
  kinds: string[]
  rate: number
  lat: number | null
  lon: number | null
}

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  updated: string
}

// ── wttr.in response shape (subset we use) ───────────────────────────────
interface WttrCondition {
  FeelsLikeC: string
  humidity: string
  temp_C: string
  visibility: string
  weatherDesc: { value: string }[]
  windspeedKmph: string
  weatherCode: string
}
interface WttrHourly {
  time: string
  tempC: string
  humidity: string
  windspeedKmph: string
  weatherDesc: { value: string }[]
  weatherCode: string
}
interface WttrDay {
  date: string
  hourly: WttrHourly[]
}
interface WttrResponse {
  nearest_area: { areaName: { value: string }[]; country: { value: string }[] }[]
  current_condition: WttrCondition[]
  weather: WttrDay[]
}

// Map wttr weatherCode → OpenWeatherMap-style icon code so we reuse the OWM CDN
function wttrCodeToIcon(code: string, isDay = true): string {
  const n = Number(code)
  const d = isDay ? 'd' : 'n'
  if (n === 113) return `01${d}`                       // Sunny / Clear
  if (n === 116) return `02${d}`                       // Partly cloudy
  if (n === 119 || n === 122) return `04${d}`          // Cloudy / Overcast
  if ([143, 248, 260].includes(n)) return `50${d}`     // Mist / Fog
  if ([176, 263, 266, 293, 296].includes(n)) return `09${d}` // Light rain
  if ([299, 302, 305, 308].includes(n)) return `10${d}` // Rain
  if ([200, 386, 389, 392, 395].includes(n)) return `11${d}` // Thunder
  if ([179, 182, 185, 281, 284, 311, 314, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(n)) return `13${d}` // Snow/sleet
  return `03${d}` // default: scattered clouds
}

/**
 * Fetch live weather directly from wttr.in — no API key required.
 * Falls back to null on error.
 */
export async function fetchWeather(city: string): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data: WttrResponse = await res.json()
    const c = data.current_condition[0]
    const area = data.nearest_area[0]
    const hour = new Date().getHours()
    return {
      city: area?.areaName[0]?.value ?? city,
      country: area?.country[0]?.value ?? '',
      temp: Number(c.temp_C),
      feels_like: Number(c.FeelsLikeC),
      humidity: Number(c.humidity),
      description: c.weatherDesc[0]?.value ?? 'Clear',
      icon: wttrCodeToIcon(c.weatherCode, hour >= 6 && hour < 20),
      wind_speed: Math.round(Number(c.windspeedKmph) / 3.6), // km/h → m/s
      visibility: Number(c.visibility),
    }
  } catch {
    return null
  }
}

/**
 * Fetch hourly forecast directly from wttr.in — no API key required.
 */
export async function fetchForecast(city: string): Promise<ForecastItem[]> {
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data: WttrResponse = await res.json()
    const items: ForecastItem[] = []
    for (const day of data.weather.slice(0, 3)) {
      for (const h of day.hourly) {
        const timeLabel = `${day.date} ${h.time.padStart(4, '0').slice(0, 2)}:00`
        items.push({
          time: timeLabel,
          temp: Number(h.tempC),
          description: h.weatherDesc[0]?.value ?? 'Clear',
          icon: wttrCodeToIcon(h.weatherCode, Number(h.time) >= 600 && Number(h.time) < 2000),
          humidity: Number(h.humidity),
          wind_speed: Math.round(Number(h.windspeedKmph) / 3.6),
        })
      }
    }
    return items.slice(0, 8)
  } catch {
    return []
  }
}

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`)
    if (!res.ok) return null
    const json = await res.json()
    return (json.data ?? json) as T
  } catch {
    return null
  }
}

export async function fetchHotels(city: string): Promise<RealHotel[]> {
  const data = await apiFetch<{ hotels: RealHotel[] }>(`/api/hotels/${encodeURIComponent(city)}`)
  return data?.hotels ?? []
}

export async function fetchPlaces(city: string): Promise<RealPlace[]> {
  const data = await apiFetch<RealPlace[]>(`/api/places/${encodeURIComponent(city)}`)
  return data ?? []
}

export async function fetchExchangeRates(): Promise<ExchangeRates | null> {
  return apiFetch<ExchangeRates>('/api/exchange-rates')
}

export function weatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
}

export function weatherEmoji(description: string): string {
  const d = description.toLowerCase()
  if (d.includes('clear') || d.includes('sunny')) return '☀️'
  if (d.includes('partly') || d.includes('few clouds')) return '🌤️'
  if (d.includes('cloud') || d.includes('overcast')) return '☁️'
  if (d.includes('rain') || d.includes('drizzle')) return '🌧️'
  if (d.includes('snow')) return '❄️'
  if (d.includes('thunder') || d.includes('storm')) return '⛈️'
  if (d.includes('mist') || d.includes('fog') || d.includes('haze')) return '🌫️'
  if (d.includes('wind')) return '💨'
  return '🌤️'
}

export function getWeatherAdvisory(description: string, temp: number): string | null {
  const d = description.toLowerCase()
  if (d.includes('thunder') || d.includes('storm')) return 'Thunderstorm warning — avoid outdoor activities'
  if (d.includes('heavy rain') || d.includes('torrential')) return 'Heavy rain — carry an umbrella and expect delays'
  if (temp >= 42) return 'Extreme heat — stay hydrated and limit sun exposure'
  if (temp <= 0) return 'Below freezing — dress in warm layers'
  if (d.includes('snow') || d.includes('blizzard')) return 'Snowfall expected — check road conditions'
  if (d.includes('fog') || d.includes('mist')) return 'Low visibility — allow extra travel time'
  return null
}

export function formatForecastDay(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
