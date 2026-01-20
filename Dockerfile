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
# Install only production deps, but we need tsx which is in devDeps currently. 
# Ideally we move tsx to dependencies or use a separate build step for server.
# For now, we install all to ensure tsx is available, or we explicitly install tsx.
RUN npm ci --include=dev 
# (Optimization: In a real strict env, we'd compile TS to JS and drop tsx)

COPY --from=builder /app/dist ./dist
COPY src ./src
COPY tsconfig.json ./

# Expose API Port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
