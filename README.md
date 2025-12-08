# 🎬 Local Media Player

A Netflix-style local media player with automatic TMDB metadata enrichment. Stream your personal video collection through a beautiful, responsive web interface.

![Local Media Player](https://image.tmdb.org/t/p/w1280/placeholder.jpg)

## ✨ Features

- **Netflix-style UI** - Beautiful dark theme with poster grids and hover effects
- **TMDB Integration** - Automatic metadata, posters, and backdrop images
- **Resume Playback** - Pick up where you left off across sessions
- **Continue Watching** - Quick access to in-progress media
- **Search & Filter** - Find content by title, genre, year, or resolution
- **Video.js Player** - Smooth playback with keyboard shortcuts
- **Responsive Design** - Works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **FFmpeg** (for metadata extraction)
- **TMDB API Key** - [Get one free](https://www.themoviedb.org/settings/api)

### Development Setup

```bash
# 1. Clone the repository
git clone <repo>
cd media-player

# 2. Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env: Add your TMDB_API_KEY
npm run migrate
npm run dev

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 4. Open browser
open http://localhost:5173
```

### First-Time Setup

1. Open the app at `http://localhost:5173`
2. Click **Settings** in the top right
3. Add your media folder path (e.g., `D:\Movies`)
4. Click **Scan Library Now**
5. Wait for TMDB metadata enrichment
6. Enjoy your collection! 🎉

## 🐳 Docker Deployment

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your TMDB_API_KEY

# 2. Set media path
export MEDIA_PATH=/path/to/your/videos

# 3. Start container
docker-compose up -d

# 4. Access the app
open http://localhost:3001
```

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/Pause |
| `←` / `→` | Seek ±10 seconds |
| `↑` / `↓` | Volume ±10% |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Esc` | Exit player |

## 📁 Project Structure

```
media-player/
├── backend/
│   ├── src/
│   │   ├── server.ts          # Express app
│   │   ├── db.ts              # SQLite wrapper
│   │   ├── scanner/           # File discovery
│   │   ├── services/          # TMDB, subtitles
│   │   └── routes/            # API endpoints
│   └── migrations/            # Database schema
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Route pages
│   │   ├── hooks/             # Custom hooks
│   │   └── api/               # API client
├── docker-compose.yml
└── Dockerfile
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TMDB_API_KEY` | TMDB API key (required) | - |
| `PORT` | Server port | 3001 |
| `DB_PATH` | SQLite database path | ./database.sqlite |
| `DEFAULT_SCAN_PATHS` | Comma-separated media paths | - |

### Supported Formats

**Browser-compatible (Direct Play):**
- Video: H.264, VP8, VP9, AV1
- Audio: AAC, MP3, Opus, Vorbis
- Container: MP4, WebM

**Other formats** will show a warning but may still work depending on browser.

## ⚠️ Known Limitations

1. **No transcoding** - Only browser-compatible formats play directly
2. **Single user** - No authentication or user profiles
3. **Local only** - No remote/external streaming
4. **English metadata** - TMDB defaults to en-US locale

## 🛠️ Development

```bash
# Backend development (with hot reload)
cd backend && npm run dev

# Frontend development (with HMR)
cd frontend && npm run dev

# Run database migrations
cd backend && npm run migrate
```

## 📄 License

MIT License - feel free to use and modify for personal use.

## 🙏 Credits

- [TMDB](https://www.themoviedb.org/) for metadata API
- [Video.js](https://videojs.com/) for the video player
- [Lucide](https://lucide.dev/) for icons
- [Tailwind CSS](https://tailwindcss.com/) for styling
