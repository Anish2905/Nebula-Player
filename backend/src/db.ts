/**
 * Database wrapper using sql.js (pure JavaScript SQLite)
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database.sqlite');

let db: SqlJsDatabase | null = null;

// Initialize database
export async function initDatabase(): Promise<SqlJsDatabase> {
    if (db) return db;

    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Enable WAL mode equivalent (no-op for sql.js but good for documentation)
    db.run('PRAGMA foreign_keys = ON');

    return db;
}

// Save database to disk
export function saveDatabase(): void {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);

    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(DB_PATH, buffer);
}

// Get the database instance
export function getDb(): SqlJsDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// Helper: Get one row
export function getOne<T>(sql: string, params: unknown[] = []): T | undefined {
    const database = getDb();
    const stmt = database.prepare(sql);
    stmt.bind(params);

    if (stmt.step()) {
        const row = stmt.getAsObject() as T;
        stmt.free();
        return row;
    }

    stmt.free();
    return undefined;
}

// Helper: Get all rows
export function getAll<T>(sql: string, params: unknown[] = []): T[] {
    const database = getDb();
    const results: T[] = [];
    const stmt = database.prepare(sql);
    stmt.bind(params);

    while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
    }

    stmt.free();
    return results;
}

// Helper: Run SQL (INSERT, UPDATE, DELETE)
export function run(sql: string, params: unknown[] = []): void {
    const database = getDb();
    database.run(sql, params);
    saveDatabase(); // Auto-save after modifications
}

// Helper: Insert and return last ID
export function insert(sql: string, params: unknown[] = []): number {
    const database = getDb();
    database.run(sql, params);
    const result = database.exec('SELECT last_insert_rowid() as id');
    saveDatabase();
    return result[0]?.values[0]?.[0] as number || 0;
}

// Helper: Execute raw SQL (for migrations)
export function exec(sql: string): void {
    const database = getDb();
    database.exec(sql);
    saveDatabase();
}

export default {
    initDatabase,
    saveDatabase,
    getDb,
    getOne,
    getAll,
    run,
    insert,
    exec,
};
