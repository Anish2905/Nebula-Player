FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:18-alpine
WORKDIR /app

# Install FFmpeg for metadata extraction
RUN apk add --no-cache ffmpeg

# Copy backend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/package.json ./
COPY --from=backend-builder /app/backend/migrations ./migrations

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./public

# Create directories
RUN mkdir -p /app/database /app/public/images

# Environment
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/database/database.sqlite

EXPOSE 3001

# Note: Add static file serving to backend for production
CMD ["node", "dist/server.js"]
