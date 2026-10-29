import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

// Load .env.local if not in production (allows standalone usage)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

// Lazy initialization - pool is created on first use, not at module load
// This is critical for Docker/K8s where env vars aren't available at build time

// Access the global object to persist the pool across module reloads in development
const globalForDb = global;
if (!globalForDb._postgresPool) {
  globalForDb._postgresPool = null;
}

function getPool() {
  if (!globalForDb._postgresPool) {
    // Debug: Show ALL relevant env vars
    console.log('[server-reldb] ENV DEBUG:', {
      DB_HOST: process.env.DB_HOST,
      POSTGRES_HOST: process.env.POSTGRES_HOST,
      DB_USER: process.env.DB_USER,
      POSTGRES_USER: process.env.POSTGRES_USER,
      DB_NAME: process.env.DB_NAME,
      POSTGRES_DB: process.env.POSTGRES_DB,
      NODE_ENV: process.env.NODE_ENV,
    });
    
    const host = process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost';
    console.log('[server-reldb] Using HOST:', host);
    
    globalForDb._postgresPool = new Pool({
      host,
      port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
      user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
      database: process.env.DB_NAME || process.env.POSTGRES_DB || 'cmc',
    });
  }
  return globalForDb._postgresPool;
}

export default function connectToDatabase() {
  return getPool();
}
