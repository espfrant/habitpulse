# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/tsconfig.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source code and configs
COPY apps/web ./apps/web

# Build static SPA bundle with Vite
RUN pnpm --filter @habitpulse/web build

# Stage 2: Nginx Web Server
FROM nginx:1.27-alpine AS runner

# Copy custom Nginx configuration with reverse proxy for /api and /docs
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy production static assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
