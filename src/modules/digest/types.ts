// The digest is composed of MODULE INSTANCES over a shared context. A module is a
// configured factory output — inject the same module type multiple times with different
// config to get multiple sections (e.g. three weather modules for three locations).

export interface DigestContext {
  date: string; // YYYY-MM-DD
  location: { lat: number; lon: number; label: string };
  // Extended over time: events?: CalendarEvent[]; diary?: ...; travel?: ...
}

// A rendered section. Blocks flow onto the current page unless newPage is set, which
// starts a fresh chapter (so front-matter flows together; articles get their own page).
export interface Block { title: string; html: string; newPage?: boolean; kind?: 'article' }

export interface DigestModule {
  id: string;
  // Decide relevance + render. Return [] to contribute nothing today.
  build(ctx: DigestContext): Promise<Block[]>;
}
