/**
 * Database wrapper using better-sqlite3 (Native SQLite for Node.js)
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');

let db: Database.Database | null = null;

// Initialize database
export function initDatabase(): Database.Database {
    if (db) return db;

    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    db = new Database(DB_PATH, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

    // Enable WAL mode for concurrency and performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Migration: Add converted_path column if it doesn't exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(media)").all() as any[];

        if (!tableInfo.some(col => col.name === 'converted_path')) {
            db.prepare('ALTER TABLE media ADD COLUMN converted_path TEXT').run();
            console.log('✅ Added converted_path column to media table');
        }

        if (!tableInfo.some(col => col.name === 'episode_title')) {
            db.prepare('ALTER TABLE media ADD COLUMN episode_title TEXT').run();
            console.log('✅ Added episode_title column to media table');
        }
    } catch (e) {
        console.error('Migration error:', e);
    }

    return db;
}

// Get the database instance
export function getDb(): Database.Database {
    if (!db) {
        // Auto-initialize if not ready
        return initDatabase();
    }
    return db;
}

// Helper: Get one row
export function getOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const database = getDb();
    try {
        return database.prepare(sql).get(...params) as T | undefined;
    } catch (err) {
        console.error('DB Error in getOne:', err);
        throw err;
    }
}

// Helper: Get all rows
export function getAll<T>(sql: string, params: unknown[] = []): T[] {
    const database = getDb();
    try {
        return database.prepare(sql).all(...params) as T[];
    } catch (err) {
        console.error('DB Error in getAll:', err);
        throw err;
    }
}

// Helper: Run SQL (INSERT, UPDATE, DELETE)
export function run(sql: string, params: unknown[] = []): Database.RunResult {
    const database = getDb();
    try {
        return database.prepare(sql).run(...params);
    } catch (err) {
        console.error('DB Error in run:', err);
        throw err;
    }
}

// Helper: Insert and return last ID
export function insert(sql: string, params: unknown[] = []): number {
    const result = run(sql, params);
    return result.lastInsertRowid as number;
}

// Helper: Execute raw SQL
export function exec(sql: string): void {
    const database = getDb();
    database.exec(sql);
}

export default {
    initDatabase,
    getDb,
    getOne,
    getAll,
    run,
    insert,
    exec,
};
