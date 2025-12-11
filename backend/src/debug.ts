import { getAll, initDatabase } from './db.js';

console.log('--- DB DEBUG START ---');
try {
    initDatabase();
    // Find entries that might look like 'oof' or just recent ones
    const badRows = getAll(`
    SELECT id, file_path, title, episode_title, season_number, episode_number, match_method, tmdb_type 
    FROM media 
    ORDER BY updated_at DESC 
    LIMIT 20
  `);
    console.log(JSON.stringify(badRows, null, 2));
} catch (e) {
    console.error(e);
}
console.log('--- DB DEBUG END ---');
