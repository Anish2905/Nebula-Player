import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, exec } from './db.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
    console.log('🔄 Running database migrations...');

    // Initialize database first
    await initDatabase();

    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of migrationFiles) {
        console.log(`  📄 Executing ${file}...`);
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
        exec(sql);
    }

    console.log('✅ Migrations complete!');
    process.exit(0);
}

runMigrations().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
