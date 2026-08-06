# ============================================================
# Stage 1 — dependency installer (leverages Docker layer caching)
# ============================================================
FROM node:18.20.4-alpine3.20 AS deps
WORKDIR /app

# Copy only what's needed for npm install
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# ============================================================
# Stage 2 — runtime (small, non-root, healthchecked)
# ============================================================
FROM node:18.20.4-alpine3.20
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install wget for lightweight healthchecks
RUN apk add --no-cache wget

# Copy production node_modules from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Environment
ENV NODE_ENV=production
EXPOSE 5000

# Read-only filesystem with tmpfs for writable paths
# Run as non-root user with dropped capabilities
# (security hardening applied at compose level via read_only, cap_drop, security_opt)

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health | grep -q '"success":true' || exit 1

# Start
CMD ["npm", "start"]
