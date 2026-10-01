# Standalone Stock Picker for Railway
FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runtime
WORKDIR /app

# Production deps only
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# App code + built client + migrations
COPY server.ts ./
COPY server/ ./server/
COPY drizzle/ ./drizzle/
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV SQLITE_PATH=/data/stock-picker.db

# Railway injects PORT; server.ts reads it
EXPOSE 3000
CMD ["bun", "server.ts"]
