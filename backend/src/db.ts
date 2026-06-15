import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta la variable DATABASE_URL en el archivo .env');
  process.exit(1);
}

// PostgreSQL local NO usa SSL — Supabase y otros cloud sí
const isLocal = process.env.DATABASE_URL.includes('localhost') ||
                process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de conexiones:', err);
});

// Test de conexión inmediato al iniciar
pool.query('SELECT 1')
  .then(() => console.log('✅ Base de datos conectada correctamente'))
  .catch((err) => {
    console.error('❌ ERROR conectando a PostgreSQL:');
    console.error('   ', err.message);
    console.error('   Revisa tu archivo .env y que PostgreSQL esté corriendo');
  });

export default pool;
