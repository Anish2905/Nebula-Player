
import db from './src/db.js';

const mediaCount = db.getOne('SELECT COUNT(*) as count FROM media');
console.log('Media count:', mediaCount);

const subtitleCount = db.getOne('SELECT COUNT(*) as count FROM subtitle_tracks');
console.log('Subtitle track count:', subtitleCount);

const tracks = db.getAll('SELECT * FROM subtitle_tracks LIMIT 5');
console.log('Sample tracks:', tracks);
