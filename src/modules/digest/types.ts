// The digest is composed of MODULE INSTANCES over a shared context. A module is a
// configured factory output — inject the same module type multiple times with different
// config to get multiple sections (e.g. three weather modules for three locations).

export interface DigestContext {
  date: string; // YYYY-MM-DD
  location: { lat: number; lon: number; label: string };
  // Extended over time: events?: CalendarEvent[]; diary?: ...; travel?: ...
}

// A rendered section. The builder turns each block into a page/chapter.
export interface Block { title: string; html: string; }

export interface DigestModule {
  id: string;
  // Decide relevance + render. Return [] to contribute nothing today.
  build(ctx: DigestContext): Promise<Block[]>;
}
