const fs = require('fs');
const path = require('path');
const dir = '/host_system/mnt/host/e/torrent';
const basename = 'Stranger.Things.S05E01';

try {
    const files = fs.readdirSync(dir);
    console.log('--- SHARED DIR CONTENTS ---');
    console.log(JSON.stringify(files, null, 2));

    console.log('--- MATCHING ---');
    const matches = files.filter(f => {
        const fLower = f.toLowerCase();
        // Mimic exact logic
        const match = f.startsWith(basename) && (fLower.endsWith('.srt') || fLower.endsWith('.vtt'));
        if (match) console.log(`MATCH: ${f}`);
        return match;
    });
    console.log(`Total Matches: ${matches.length}`);
} catch (err) {
    console.error('ERROR:', err);
}
