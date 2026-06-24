import { fetchWeatherDetailed } from '../sources.js';
import { esc } from '../epub.js';
import type { DigestModule } from '../types.js';

// A weather section for one location: now + parts-of-day with yr.no icons.
// Inject multiple instances for multiple places.
export function weatherModule(cfg: { lat: number; lon: number; label: string }): DigestModule {
  return {
    id: `weather:${cfg.label}`,
    async build() {
      const w = await fetchWeatherDetailed(cfg.lat, cfg.lon);
      if (!w) return [];
      const now = w.nowC != null ? `Now ${w.nowC}°C${w.condition ? ', ' + esc(w.condition) : ''}. ` : '';
      const cells = w.parts.map((p) => `<td style="text-align:center;padding:6px 10px;vertical-align:top">` +
        `<img src="icons/${esc(p.symbol)}.png" alt="" width="46" height="46"/><br/>` +
        `<strong>${p.name}</strong><br/>${p.tempC}°C<br/>` +
        `<small>${p.precipMm > 0 ? p.precipMm + ' mm' : '—'}</small></td>`).join('');
      const html =
        `<h2>Weather · ${esc(cfg.label)}</h2>` +
        `<p>${now}Today ${w.minC}–${w.maxC}°C.</p>` +
        `<table style="width:100%;border-collapse:collapse"><tr>${cells}</tr></table>` +
        `<p style="text-align:right"><small>yr.no</small></p>`;
      return [{ title: `Weather · ${cfg.label}`, html }]; // newPage omitted -> flows on the front page
    },
  };
}
