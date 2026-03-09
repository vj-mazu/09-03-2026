# Docker
FROM node:18-alpine AS base

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# --- Backend ---
FROM base AS backend
COPY server/package*.json ./server/
RUN cd server && npm ci --production
COPY server/ ./server/

# --- Frontend Build ---
FROM base AS frontend-build
COPY client/package*.json ./client/
RUN cd client && npm install --legacy-peer-deps
COPY client/ ./client/
RUN cd client && npm run build

# --- Production Image ---
FROM node:18-alpine AS production
WORKDIR /app

# Copy backend
COPY --from=backend /app/server ./server

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/status || exit 1

CMD ["node", "server/index.js"]
