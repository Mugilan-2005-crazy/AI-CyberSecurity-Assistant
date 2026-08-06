# ============================================================
# Stage 1 — Build React app
# ============================================================
FROM node:18.20.4-alpine3.20 AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ============================================================
# Stage 2 — Serve with nginx (alpine, lightweight)
# ============================================================
FROM nginx:1.27.4-alpine
WORKDIR /usr/share/nginx/html

# Copy built assets from builder
COPY --from=builder /app/dist ./

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d

# Expose port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ | grep -q '<!doctype html>' || exit 1

CMD ["nginx", "-g", "daemon off;"]
