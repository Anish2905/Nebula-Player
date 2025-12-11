import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { initDatabase } from './db.js';

// Routes
import mediaRoutes from './routes/media.js';
import videoRoutes from './routes/video.js';
import playbackRoutes from './routes/playback.js';
import searchRoutes from './routes/search.js';
import settingsRoutes from './routes/settings.js';
import conversionRoutes from './routes/conversion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));


app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limit for local use
    message: { error: 'Too many requests, please try again later' }
});

app.use('/api/', apiLimiter);

// Static files for posters/backdrops
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

// API Routes
app.use('/api/media', mediaRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/playback', playbackRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/conversion', conversionRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    const publicPath = path.join(__dirname, '..', 'public');
    app.use(express.static(publicPath));

    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.sendFile(path.join(publicPath, 'index.html'));
    });
}

import { runMigrations } from './migrate.js';

// Initialize database and start server
async function start() {
    try {
        console.log('🔄 Initializing database...');
        await initDatabase();
        await runMigrations();
        console.log('✅ Database initialized');

        app.listen(PORT, () => {
            console.log(`🎬 Media Player API running on http://localhost:${PORT}`);
            console.log(`📁 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();

export default app;
