# Multi-stage Dockerfile for Journal App
# Supports: linux/amd64, linux/arm64, linux/arm/v7

# Stage 1: Build the frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY components.json ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY eslint.config.js ./

# Install dependencies
RUN npm ci --only=production=false

# Copy frontend source
COPY src ./src
COPY public ./public
COPY index.html ./

# Build frontend
RUN npm run build:client

# Stage 2: Build the backend
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.server.json ./

# Install dependencies (includes native compilation for better-sqlite3)
RUN npm ci --only=production=false

# Copy server source
COPY server ./server

# Build backend
RUN npm run build:server

# Stage 3: Production image
FROM node:18-alpine

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache python3 make g++ && \
    apk add --no-cache --virtual .gyp-runtime-deps \
    libstdc++ \
    && apk del .gyp-runtime-deps

# Install production dependencies only (rebuild native modules for target arch)
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from previous stages
COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-builder /app/dist ./server-dist

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for database
RUN mkdir -p /data

# Create non-root user
RUN addgroup -g 1001 user && \
    adduser -D -u 1001 -G user user && \
    chown -R user:user /app /data

# Set environment variables defaults
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/journal.db \
    TZ=UTC

# Switch to non-root user
USER user

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]

# Run the application
CMD ["node", "server-dist/server/index.js"]
