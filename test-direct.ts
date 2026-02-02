import { Pool } from 'pg';

// Direct connection (no pooler)
const directUrl = 'postgresql://neondb_owner:npg_rcCjYqhOz57Q@ep-noisy-recipe-ahnmgc0t.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

console.log('🔌 Testing DIRECT connection (no pooler)...\n');

const pool = new Pool({ 
    connectionString: directUrl,
    connectionTimeoutMillis: 20000,
    ssl: { rejectUnauthorized: false }
});

pool.query('SELECT NOW() as time, version() as version')
    .then(result => {
        console.log('✅ SUCCESS! Database is awake and responding!');
        console.log('Time:', result.rows[0].time);
        console.log('PostgreSQL:', result.rows[0].version.split(' ')[1]);
        console.log('\n🚀 Now you can run: bunx prisma db push');
    })
    .catch(error => {
        console.error('❌ FAILED');
        console.error('Error code:', error.code);
        console.error('Message:', error.message);
        
        if (error.message.includes('ETIMEDOUT')) {
            console.error('\n💡 Database is suspended. Please:');
            console.error('   1. Visit https://console.neon.tech');
            console.error('   2. Click your database project');
            console.error('   3. Wait 10-20 seconds for it to wake');
            console.error('   4. Try this test again');
        }
    })
    .finally(() => {
        pool.end();
    });
