# Stage 1: Build & Deploy
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@10

# Copy root workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy API source code
COPY apps/api/src ./apps/api/src

# Compile TypeScript to JavaScript
RUN pnpm --filter @habitpulse/api build

# Prune devDependencies into standalone production deployment
RUN pnpm --filter @habitpulse/api --prod deploy --legacy /app/deployed

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Run container as unprivileged node user
USER node

# Copy production bundle and compiled dist
COPY --chown=node:node --from=builder /app/deployed ./
COPY --chown=node:node --from=builder /app/apps/api/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/server.js"]
