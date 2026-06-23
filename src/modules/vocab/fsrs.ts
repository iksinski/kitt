import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from 'ts-fsrs';

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

// Our DB-facing card shape (camelCase, maps 1:1 to the fsrs_cards table).
export interface CardState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

function toFsrs(c: CardState): Card {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.lastReview ?? undefined,
  } as Card;
}

function fromFsrs(c: Card): CardState {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    lastReview: c.last_review ?? null,
  };
}

export const RATINGS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;
export type RatingName = keyof typeof RATINGS;

export function newCard(now: Date = new Date()): CardState {
  return fromFsrs(createEmptyCard(now));
}

export function review(state: CardState, rating: RatingName, now: Date = new Date()): CardState {
  const { card } = scheduler.next(toFsrs(state), now, RATINGS[rating]);
  return fromFsrs(card);
}
