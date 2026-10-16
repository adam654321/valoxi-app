import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
// Idle clients can lose their WebSocket connection. Without an error listener,
// the pool's EventEmitter throws and terminates the entire server process.
// Query errors still reject normally and are handled by the requesting route.
pool.on('error', () => {
  console.error('[DB_POOL] Idle database connection lost; the pool will replace the disconnected client.');
});
export const db = drizzle({ client: pool, schema });
/** Query builders shared by the pool handle and a transaction handle. */
export type DatabaseExecutor = Pick<typeof db, 'select' | 'insert' | 'update' | 'delete'>;