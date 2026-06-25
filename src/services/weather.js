const WMO = {
  0:  { text: 'Açık',            emoji: '☀️' },
  1:  { text: 'Az bulutlu',      emoji: '🌤' },
  2:  { text: 'Parçalı bulutlu', emoji: '⛅' },
  3:  { text: 'Kapalı',          emoji: '☁️' },
  45: { text: 'Sisli',           emoji: '🌫' },
  48: { text: 'Buzlu sis',       emoji: '🌫' },
  51: { text: 'Hafif çisenti',   emoji: '🌦' },
  53: { text: 'Çisenti',         emoji: '🌦' },
  55: { text: 'Yoğun çisenti',   emoji: '🌧' },
  61: { text: 'Hafif yağmur',    emoji: '🌧' },
  63: { text: 'Yağmur',          emoji: '🌧' },
  65: { text: 'Yoğun yağmur',    emoji: '🌧' },
  71: { text: 'Hafif kar',       emoji: '🌨' },
  73: { text: 'Kar',             emoji: '❄️' },
  75: { text: 'Yoğun kar',       emoji: '❄️' },
  80: { text: 'Sağanak',         emoji: '🌦' },
  82: { text: 'Yoğun sağanak',   emoji: '⛈' },
  85: { text: 'Kar sağanağı',    emoji: '🌨' },
  95: { text: 'Fırtına',         emoji: '⛈' },
  99: { text: 'Şiddetli fırtına',emoji: '🌩' },
};

function resolveWmo(code) {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? { text: 'Bilinmiyor', emoji: '🌡' };
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
