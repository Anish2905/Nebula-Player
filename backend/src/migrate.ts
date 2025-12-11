import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, exec, getAll, run } from './db.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

export async function runMigrations() {
    console.log('🔄 Running database migrations...');

    // Initialize database first
    await initDatabase();

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.warn(`⚠️ Migrations directory not found: ${MIGRATIONS_DIR}`);
        return;
    }

    // Create migrations table if not exists
    exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const executed = new Set(
        getAll<{ name: string }>('SELECT name FROM migrations').map(r => r.name)
    );

    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of migrationFiles) {
        if (executed.has(file)) {
            continue;
        }

        console.log(`  📄 Executing ${file}...`);
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

        try {
            exec(sql);
            run('INSERT INTO migrations (name) VALUES (?)', [file]);
        } catch (err: any) {
            // Handle specific case where column already exists (idempotency fallback)
            if (err.message && err.message.includes('duplicate column name')) {
                console.warn(`  ⚠️ Column already exists, marking ${file} as migrated.`);
                run('INSERT INTO migrations (name) VALUES (?)', [file]);
                continue;
            }
            console.error(`❌ Failed to execute ${file}. Error details:`, {
                message: err.message,
                code: err.code,
                name: err.name
            });
            throw err;
        }
    }

    console.log('✅ Migrations complete!');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runMigrations().catch(err => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
}

