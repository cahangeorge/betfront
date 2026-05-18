FROM node:22-slim AS build
WORKDIR /app

# Install build deps for sqlite + native modules
RUN apt-get update && apt-get install -y --no-install-recommends python3 make gcc g++     && corepack enable && corepack prepare pnpm@9 --activate     && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---- runtime ----
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates     && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001
CMD ["node", "./dist/server/entry.mjs"]
