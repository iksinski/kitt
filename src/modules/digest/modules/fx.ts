import { fetchUsdPln } from '../sources.js';
import type { DigestModule } from '../types.js';

export function fxModule(): DigestModule {
  return {
    id: 'fx',
    async build() {
      const fx = await fetchUsdPln();
      return fx ? [{ title: 'USD / PLN', html: `<h2>USD / PLN</h2><p>${fx.rate} (NBP, ${fx.date})</p>` }] : [];
    },
  };
}
