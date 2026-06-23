// Data sources for the daily digest. All free, no API keys.

export interface Story { title: string; url: string | null; points: number; comments: number; hnId: number; }

export async function fetchTopStories(n: number): Promise<Story[]> {
  const r = await fetch(`https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${n}`);
  const d: any = await r.json();
  return (d.hits ?? []).map((h: any) => ({
    title: h.title, url: h.url ?? null, points: h.points ?? 0, comments: h.num_comments ?? 0, hnId: Number(h.objectID),
  }));
}

export interface Weather { nowC: number | null; maxC: number; minC: number; precipMm: number; }
export async function fetchWeather(lat: number, lon: number): Promise<Weather | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=1&timezone=auto`);
    const d: any = await r.json();
    return { nowC: d.current?.temperature_2m ?? null, maxC: d.daily.temperature_2m_max[0], minC: d.daily.temperature_2m_min[0], precipMm: d.daily.precipitation_sum[0] };
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
