// Data sources for the daily digest. All free, no API keys.

export interface Story { title: string; url: string | null; points: number; comments: number; hnId: number; }

export async function fetchTopStories(n: number): Promise<Story[]> {
  const r = await fetch(`https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${n}`);
  const d: any = await r.json();
  return (d.hits ?? []).map((h: any) => ({
    title: h.title, url: h.url ?? null, points: h.points ?? 0, comments: h.num_comments ?? 0, hnId: Number(h.objectID),
  }));
}

export interface Weather { nowC: number | null; maxC: number; minC: number; precipMm: number; condition: string; }

// MET Norway (yr.no) requires an identifying User-Agent or it blocks the request.
const MET_UA = 'kitt-digest/1.0 (github.com/iksinski/kitt; pasieczny.igor@gmail.com)';
const SYMBOLS: Record<string, string> = {
  clearsky: 'clear', fair: 'fair', partlycloudy: 'partly cloudy', cloudy: 'cloudy', fog: 'fog',
  lightrain: 'light rain', rain: 'rain', heavyrain: 'heavy rain',
  lightrainshowers: 'light showers', rainshowers: 'showers', heavyrainshowers: 'heavy showers',
  lightsnow: 'light snow', snow: 'snow', heavysnow: 'heavy snow', sleet: 'sleet', lightsleet: 'light sleet',
  rainandthunder: 'rain & thunder', thunderstorm: 'thunderstorm',
};
const humanize = (code?: string): string => {
  if (!code) return '';
  const base = code.replace(/_(day|night|polartwilight)$/, '');
  return SYMBOLS[base] ?? base.replace(/_/g, ' ');
};

export async function fetchWeather(lat: number, lon: number): Promise<Weather | null> {
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': MET_UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const d: any = await r.json();
    const ts: any[] = d.properties.timeseries;
    const now = ts[0];
    const next = ts.slice(0, 24);
    const temps = next.map((t) => t.data.instant.details.air_temperature).filter((x) => x != null);
    const precip = next.reduce((s, t) => s + (t.data.next_1_hours?.details?.precipitation_amount ?? 0), 0);
    return {
      nowC: now.data.instant.details.air_temperature ?? null,
      maxC: Math.max(...temps),
      minC: Math.min(...temps),
      precipMm: Math.round(precip * 10) / 10,
      condition: humanize(now.data.next_6_hours?.summary?.symbol_code ?? now.data.next_1_hours?.summary?.symbol_code),
    };
  } catch { return null; }
}

export async function fetchUsdPln(): Promise<{ rate: number; date: string } | null> {
  try {
    const r = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json');
    const d: any = await r.json();
    return { rate: d.rates[0].mid, date: d.rates[0].effectiveDate };
  } catch { return null; }
}

export interface DueWord { id: string; word: string; stem: string; }
export async function fetchDueVocab(limit: number): Promise<DueWord[]> {
  try {
    const r = await fetch(`http://127.0.0.1:${process.env.PORT ?? 8787}/vocab/words/due?limit=${limit}`);
    const d: any = await r.json();
    return d.due ?? [];
  } catch { return []; }
}
