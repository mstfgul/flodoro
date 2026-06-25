const WMO = {
  0:  { text: 'Clear',           emoji: '☀️' },
  1:  { text: 'Mostly clear',    emoji: '🌤' },
  2:  { text: 'Partly cloudy',   emoji: '⛅' },
  3:  { text: 'Overcast',        emoji: '☁️' },
  45: { text: 'Foggy',           emoji: '🌫' },
  48: { text: 'Icy fog',         emoji: '🌫' },
  51: { text: 'Light drizzle',   emoji: '🌦' },
  53: { text: 'Drizzle',         emoji: '🌦' },
  55: { text: 'Heavy drizzle',   emoji: '🌧' },
  61: { text: 'Light rain',      emoji: '🌧' },
  63: { text: 'Rain',            emoji: '🌧' },
  65: { text: 'Heavy rain',      emoji: '🌧' },
  71: { text: 'Light snow',      emoji: '🌨' },
  73: { text: 'Snow',            emoji: '❄️' },
  75: { text: 'Heavy snow',      emoji: '❄️' },
  80: { text: 'Showers',         emoji: '🌦' },
  82: { text: 'Heavy showers',   emoji: '⛈' },
  85: { text: 'Snow showers',    emoji: '🌨' },
  95: { text: 'Thunderstorm',    emoji: '⛈' },
  99: { text: 'Severe storm',    emoji: '🌩' },
};

function resolveWmo(code) {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { text: 'Unknown', emoji: '🌡' };
}

export async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&wind_speed_unit=kmh&timezone=auto`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('Weather API error');
  const data = await res.json();
  const c = data.current;
  return {
    temp: Math.round(c.temperature_2m),
    wind: Math.round(c.wind_speed_10m),
    humidity: c.relative_humidity_2m,
    ...resolveWmo(c.weather_code),
  };
}
