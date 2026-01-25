# Stage 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Build Vite frontend
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Install all dependencies including tsx for TypeScript execution
# In production, we'll use Bun runtime which has built-in TypeScript support
RUN npm ci --include=dev 

COPY --from=builder /app/dist ./dist
COPY src ./src
COPY tsconfig.json ./

# Install DragonflyDB for high-performance caching
# Use official DragonflyDB Alpine package
RUN apk add --no-cache curl && \
    curl -fsSL https://github.com/dragonflydb/dragonfly/releases/latest/download/dragonfly_linux_amd64.tar.gz | tar -xz && \
    mv dragonfly /usr/local/bin/ && \
    chmod +x /usr/local/bin/dragonfly

# Create startup script for DragonflyDB
COPY <<EOF /app/start-dragonfly.sh
#!/bin/sh
echo "🐉 Starting DragonflyDB..."
dragonfly --dir /tmp/dragonfly --port 6379 &
echo "DragonflyDB started with PID: \$!"
EOF
RUN chmod +x /app/start-dragonfly.sh

# Expose ports
EXPOSE 5000 6379

# Health check for both services
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start command with DragonflyDB
CMD ["/bin/sh", "-c", "./start-dragonfly.sh && npm start"]
