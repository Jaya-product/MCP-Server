# ==============================================================================
# Multi-stage Dockerfile for Google Workspace MCP Server
# ==============================================================================

# Stage 1: Build TypeScript source
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and build
COPY src ./src
COPY bin ./bin
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV MCP_TRANSPORT=streamable-http
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8080

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built JavaScript files from builder stage
COPY --from=builder /app/dist ./dist

# Create directory for persistent token volume with appropriate permissions
RUN mkdir -p /app/.credentials && chown -R node:node /app

# Run as non-root node user for security
USER node

# Expose default HTTP port
EXPOSE 8080

# Start server
CMD ["node", "dist/src/index.js"]
