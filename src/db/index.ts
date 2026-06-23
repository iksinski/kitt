import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

try { process.loadEnvFile(); } catch { /* .env optional in some envs */ }

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const client = postgres(url);
export const db = drizzle(client, { schema });
