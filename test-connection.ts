import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

console.log('Testing connection to:');
console.log('Host:', connectionString?.match(/@([^\/]+)\//)?.[1] || 'unknown');
console.log('\n🔌 Connecting...\n');

const pool = new Pool({ 
    connectionString,
    connectionTimeoutMillis: 15000
});

pool.query('SELECT NOW() as time, current_database() as db')
    .then(result => {
        console.log('✅ Connection successful!');
        console.log('Database:', result.rows[0].db);
        console.log('Server time:', result.rows[0].time);
        console.log('\n✨ Ready to push Prisma schema!');
    })
    .catch(error => {
        console.error('❌ Connection failed!');
        console.error('Error:', error.message);
        console.error('\nPlease check:');
        console.error('1. Database is not suspended (visit Neon console)');
        console.error('2. Connection string is correct in .env');
        console.error('3. Firewall/network allows connections');
    })
    .finally(() => {
        pool.end();
    });
