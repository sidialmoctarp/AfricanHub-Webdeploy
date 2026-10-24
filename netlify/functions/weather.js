// Netlify Function: proxies OpenWeatherMap so the API key stays on the server.
// Set OPENWEATHER_API_KEY in Netlify: Site configuration > Environment variables.
exports.handler = async (event) => {
  const key = process.env.OPENWEATHER_API_KEY;
  const { lat, lon } = event.queryStringParameters || {};
  const num = v => v !== undefined && v !== '' && Number.isFinite(Number(v));

  if (!key) return json(503, { message: 'Weather service not configured' });
  if (!num(lat) || !num(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json(400, { message: 'Invalid coordinates' });

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${Number(lat)}&lon=${Number(lon)}&units=metric&appid=${key}`;
    const res = await fetch(url);
    return json(res.status, await res.json(), { 'Cache-Control': 'public, max-age=600' });
  } catch (e) {
    return json(502, { message: 'Weather provider unreachable' });
  }
};

const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
