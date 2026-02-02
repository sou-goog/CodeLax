import { Pool } from 'pg';

const poolerUrl = 'postgresql://neondb_owner:npg_inVkT52AcXrL@ep-wispy-brook-ahtjrnh3-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('🔌 Connecting to database to wake it up...');

const pool = new Pool({ 
    connectionString: poolerUrl,
    connectionTimeoutMillis: 30000 // 30 second timeout
});

pool.query('SELECT NOW() as current_time, version() as pg_version')
    .then(result => {
        console.log('✅ Database is awake!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL version:', result.rows[0].pg_version.split(',')[0]);
    })
    .catch(error => {
        console.error('❌ Connection failed:', error.message);
    })
    .finally(() => {
        pool.end();
        console.log('🔌 Connection closed');
    });
