import { fetchWeather } from '../sources.js';
import { esc } from '../epub.js';
import type { DigestModule } from '../types.js';

// A weather section for one location. Inject multiple instances for multiple places.
export function weatherModule(cfg: { lat: number; lon: number; label: string }): DigestModule {
  return {
    id: `weather:${cfg.label}`,
    async build() {
      const w = await fetchWeather(cfg.lat, cfg.lon);
      if (!w) return [];
      const now = w.nowC != null ? `Now ${w.nowC}°C${w.condition ? ', ' + esc(w.condition) : ''}. ` : '';
      return [{
        title: `Weather · ${cfg.label}`,
        html: `<h2>Weather · ${esc(cfg.label)}</h2><p>${now}Today ${w.minC}–${w.maxC}°C, precipitation ${w.precipMm} mm. (yr.no)</p>`,
      }];
    },
  };
}
