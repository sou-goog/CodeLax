import { Pool } from 'pg';
import * as readline from 'readline';

const poolerUrl = 'postgresql://neondb_owner:npg_inVkT52AcXrL@ep-wispy-brook-ahtjrnh3-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: poolerUrl });

async function listTables() {
    const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    `);
    return result.rows.map(r => r.table_name);
}

async function showTableData(tableName: string) {
    console.log(`\n📊 Data from table: ${tableName}`);
    console.log('─'.repeat(80));
    
    const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT 10`);
    
    if (result.rows.length === 0) {
        console.log('(empty table)');
    } else {
        console.table(result.rows);
    }
}

async function main() {
    try {
        console.log('🔍 Fetching tables from database...\n');
        
        const tables = await listTables();
        
        console.log('📁 Available tables:');
        tables.forEach((table, i) => console.log(`  ${i + 1}. ${table}`));
        
        console.log('\n');
        
        for (const table of tables) {
            await showTableData(table);
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

main();
